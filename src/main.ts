import * as core from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { type Inputs, getInputs } from './inputs.js';
import { parse } from './parse.js';
import { str2array } from './utils.js';

type CommentKind = 'issue' | 'pull_request' | 'discussion';

const validContexts = new Set<CommentKind>(['issue', 'pull_request', 'discussion']);

type CommentContext = {
  kind: CommentKind;
  number: number;
  commentId: number;
  actor: string;
};

// The actor is the event sender: on `edited` / `deleted` events `comment.user` is still the
// original author, so reporting it would attribute another user's edit to them.
const resolveCommentContext = (): CommentContext | null => {
  if (context.eventName === 'issue_comment') {
    const isPr = context.payload.issue?.['pull_request'] != null;
    return {
      kind: isPr ? 'pull_request' : 'issue',
      number: context.payload.issue!.number!,
      commentId: context.payload.comment!.id,
      actor: context.payload.sender!['login'] as string,
    };
  }
  if (context.eventName === 'discussion_comment') {
    const discussion = context.payload['discussion'] as { number: number } | undefined;
    return {
      kind: 'discussion',
      number: discussion!.number,
      commentId: context.payload.comment!.id,
      actor: context.payload.sender!['login'] as string,
    };
  }
  return null;
};

const isValidContext = (inputs: Inputs, kind: CommentKind) => {
  const allowedContexts = str2array(inputs.allowed_contexts);
  const invalidContexts = allowedContexts.filter((c) => !validContexts.has(c as CommentKind));
  if (invalidContexts.length > 0) {
    const list = [...validContexts].map((c) => `"${c}"`).join(', ');
    core.warning(
      `The "allowed_contexts" must be a comma-separated string of ${list}, but received "${invalidContexts.join(',')}".`,
    );
    return false;
  }

  if (!allowedContexts.includes(kind)) {
    core.info(`💡The current context "${kind}" is not in allowed_contexts (${allowedContexts.join(',')}).`);
    return false;
  }

  return true;
};

const validPermissions = new Set(['admin', 'maintain', 'write', 'triage', 'read']);

const hasAllowedPermission = async (inputs: Inputs, actor: string) => {
  if (inputs.allowed_permissions === null) {
    return true;
  }

  const allowedPermissions = str2array(inputs.allowed_permissions);
  const invalidPermissions = allowedPermissions.filter((p) => !validPermissions.has(p));
  if (invalidPermissions.length > 0) {
    const list = [...validPermissions].map((p) => `"${p}"`).join(', ');
    core.warning(
      `The "allowed_permissions" must be a comma-separated string of ${list}, but received "${invalidPermissions.join(',')}".`,
    );
    return false;
  }
  if (allowedPermissions.includes('read')) {
    core.warning('The "allowed_permissions" includes "read", which every GitHub user has on a public repository.');
  }

  let role: string;
  try {
    const { data } = await getOctokit(inputs.github_token).rest.repos.getCollaboratorPermissionLevel({
      ...context.repo,
      username: actor,
    });
    role = data.role_name;
  } catch (e) {
    core.warning(
      `Failed to look up the repository permission of "${actor}", so the trigger has been canceled. ${e instanceof Error ? e.message : String(e)}`,
    );
    return false;
  }

  if (!allowedPermissions.includes(role)) {
    core.info(
      `💡"${actor}" has the "${role}" permission, which is not in allowed_permissions (${allowedPermissions.join(',')}).`,
    );
    return false;
  }

  return true;
};

export const run = async () => {
  const inputs = getInputs();
  core.debug(
    `inputs: ${JSON.stringify(inputs, (key, value: unknown) => (key === 'github_token' ? undefined : value))}`,
  );

  const ctx = resolveCommentContext();
  if (ctx === null) {
    core.warning(
      `This action only supports the "issue_comment" or "discussion_comment" event, but received "${context.eventName}".`,
    );
    core.setOutput('continue', 'false');
    return 0;
  }

  if (!isValidContext(inputs, ctx.kind)) {
    core.setOutput('continue', 'false');
    return 0;
  }

  core.setOutput('number', ctx.number);
  core.setOutput('context', ctx.kind);
  core.setOutput('comment_id', ctx.commentId);
  core.setOutput('actor', ctx.actor);
  if (ctx.kind !== 'discussion') {
    core.setOutput('issue_number', ctx.number);
  }

  const commands = str2array(inputs.command);
  const body = (context.payload.comment?.['body'] ?? '') as string;
  const result = parse(body);
  core.debug(`parse result: ${JSON.stringify(result)}`);

  if (result.error != null) {
    core.setOutput('continue', 'false');
    core.setFailed(`Failed to parse the IssueOps command from the comment.\n${result.error}`);
    return 1;
  }

  if (result.command == null) {
    core.setOutput('continue', 'false');
    core.info('No command was detected in the comment.');
    return 0;
  }

  if (!commands.includes(result.command)) {
    core.setOutput('continue', 'false');
    core.info(
      `The "${result.command}" command was detected in the comment. However, since it is not included in the list of commands ("${commands.join(', ')}"), the trigger has been canceled.`,
    );
    return 0;
  }

  if (context.payload.action === 'deleted') {
    core.setOutput('continue', 'false');
    core.info(`The "${result.command}" command was found in a deleted comment, so the trigger has been canceled.`);
    return 0;
  }

  if (!(await hasAllowedPermission(inputs, ctx.actor))) {
    core.setOutput('continue', 'false');
    return 0;
  }

  core.setOutput('continue', 'true');
  core.setOutput('command', result.command);
  core.setOutput('params', JSON.stringify(result.params));

  return 0;
};
