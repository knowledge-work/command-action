import * as core from '@actions/core';
import { context } from '@actions/github';
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

const resolveCommentContext = (): CommentContext | null => {
  if (context.eventName === 'issue_comment') {
    const isPr = context.payload.issue?.['pull_request'] != null;
    return {
      kind: isPr ? 'pull_request' : 'issue',
      number: context.payload.issue!.number!,
      commentId: context.payload.comment!.id,
      actor: context.payload.comment!['user'].login,
    };
  }
  if (context.eventName === 'discussion_comment') {
    const discussion = context.payload['discussion'] as { number: number } | undefined;
    return {
      kind: 'discussion',
      number: discussion!.number,
      commentId: context.payload.comment!.id,
      actor: context.payload.comment!['user'].login,
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

export const run = async () => {
  const inputs = getInputs();
  core.debug(`inputs: ${JSON.stringify(inputs)}`);

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

  core.setOutput('continue', 'true');
  core.setOutput('command', result.command);
  core.setOutput('params', JSON.stringify(result.params));

  core.info('params:');
  core.info(JSON.stringify(result.params, null, 2));

  return 0;
};
