import * as core from '@actions/core';
import { context } from '@actions/github';
import type { Inputs } from './inputs.js';
import { getInputs } from './inputs.js';
import { str2array } from './utils.js';
import { parse } from './parse.js';

const validContexts = new Set(['issue', 'pull_request']);

const isValidContext = (inputs: Inputs) => {
  if (context.eventName !== 'issue_comment') {
    core.warning(`This action only supports the "issue_comment" event, but received "${context.eventName}".`);
    return false;
  }

  const allowedContexts = str2array(inputs.allowed_contexts);
  const invalidContexts = allowedContexts.filter((c) => !validContexts.has(c));
  if (invalidContexts.length > 0) {
    const list = [...validContexts].map((c) => `"${c}"`).join(' and ');
    core.warning(
      `The "allowed_contexts" must be a comma-separated string of ${list}, but received "${invalidContexts.join(',')}".`,
    );
    return false;
  }

  const isPr = context?.payload?.issue?.['pull_request'] != null;
  if (allowedContexts.length === 1) {
    switch (allowedContexts[0]) {
      case 'issue': {
        if (isPr) {
          core.info(`💡The 'issue' context is not allowed for pull requests.`);
          return false;
        }
        break;
      }
      case 'pull_request': {
        if (!isPr) {
          core.info(`💡The 'pull_request' context is not allowed for issues.`);
          return false;
        }
        break;
      }
    }
  }

  return true;
};

const run = async () => {
  const inputs = getInputs();
  core.debug(`inputs: ${JSON.stringify(inputs)}`);

  if (!isValidContext(inputs)) {
    core.setOutput('continue', 'false');
    return 0;
  }

  core.setOutput('issue_number', context.payload.issue!.number!);
  core.setOutput('comment_id', context.payload.comment!.id);
  core.setOutput('actor', context.payload.comment!['user'].login);

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

try {
  process.exit(await run());
} catch (e) {
  core.setFailed(e as Error);
  process.exit(1);
}
