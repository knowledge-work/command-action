import { beforeEach, expect, test, vi } from 'vitest';
import type { Inputs } from './inputs.js';

const mocks = vi.hoisted(() => ({
  setOutput: vi.fn(),
  setFailed: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  inputs: {
    command: 'foo',
    allowed_contexts: 'issue,pull_request,discussion',
    allowed_permissions: null as string | null,
    github_token: 'test-token',
  } satisfies Inputs,
  getPermission: vi.fn(),
  octokitToken: vi.fn(),
  context: {
    eventName: 'issue_comment' as string,
    payload: {} as Record<string, unknown>,
    repo: { owner: 'o', repo: 'r' },
  },
}));

vi.mock('@actions/core', () => ({
  setOutput: mocks.setOutput,
  setFailed: mocks.setFailed,
  warning: mocks.warning,
  info: mocks.info,
  debug: mocks.debug,
  getInput: (key: string) => mocks.inputs[key as keyof Inputs] ?? '',
}));

vi.mock('@actions/github', () => ({
  context: mocks.context,
  getOctokit: (token: string) => {
    mocks.octokitToken(token);
    return { rest: { repos: { getCollaboratorPermissionLevel: mocks.getPermission } } };
  },
}));

const { run } = await import('./main.js');

const outputFor = (key: string) => mocks.setOutput.mock.calls.find(([k]) => k === key)?.[1];

const matched = (calls: unknown[][], pattern: RegExp): boolean =>
  calls.some(([message]) => (typeof message === 'string' ? pattern.test(message) : false));

type Expected = {
  continue: 'true' | 'false';
  command?: string;
  params?: Record<string, unknown>;
  number?: number;
  issue_number?: number | 'unset';
  context?: 'issue' | 'pull_request' | 'discussion';
  comment_id?: number;
  actor?: string;
  failed?: boolean;
  warning?: RegExp;
  info?: RegExp;
  notInfo?: RegExp;
  notDebug?: RegExp;
  permissionLookup?: { username: string; token: string } | 'none';
  returnCode?: number;
};

type Scenario = {
  name: string;
  eventName: string;
  inputs?: Partial<Inputs>;
  // The role the mocked permission API returns for the sender, or an error it throws.
  permission?: string | Error;
  payload: Record<string, unknown>;
  expected: Expected;
};

const permissionScenario = (
  name: string,
  allowedPermissions: string,
  permission: string | Error,
  expected: Expected,
): Scenario => ({
  name,
  eventName: 'issue_comment',
  inputs: { allowed_contexts: 'issue,pull_request', allowed_permissions: allowedPermissions },
  permission,
  payload: {
    issue: { number: 42 },
    comment: { id: 1001, body: '.foo', user: { login: 'alice' } },
    sender: { login: 'alice' },
  },
  expected,
});

const scenarios: Scenario[] = [
  {
    name: '01: issue_comment on issue emits context=issue with number === issue_number',
    eventName: 'issue_comment',
    inputs: { allowed_contexts: 'issue,pull_request' },
    payload: {
      issue: { number: 42 },
      comment: { id: 1001, body: '.foo', user: { login: 'alice' } },
      sender: { login: 'alice' },
    },
    expected: {
      continue: 'true',
      command: 'foo',
      context: 'issue',
      number: 42,
      issue_number: 42,
      comment_id: 1001,
      actor: 'alice',
      params: {},
    },
  },
  {
    name: '02: issue_comment on PR (issue.pull_request set) emits context=pull_request with number === issue_number',
    eventName: 'issue_comment',
    inputs: { allowed_contexts: 'issue,pull_request' },
    payload: {
      issue: {
        number: 99,
        pull_request: { url: 'https://api.github.com/repos/o/r/pulls/99' },
      },
      comment: { id: 2002, body: '.foo', user: { login: 'bob' } },
      sender: { login: 'bob' },
    },
    expected: {
      continue: 'true',
      command: 'foo',
      context: 'pull_request',
      number: 99,
      issue_number: 99,
      comment_id: 2002,
      actor: 'bob',
      params: {},
    },
  },
  {
    name: '03: discussion_comment emits context=discussion with number set and issue_number unset (regression guard)',
    eventName: 'discussion_comment',
    inputs: { allowed_contexts: 'issue,pull_request,discussion' },
    payload: {
      discussion: { number: 7 },
      comment: { id: 4004, body: '.foo', user: { login: 'carol' } },
      sender: { login: 'carol' },
    },
    expected: {
      continue: 'true',
      command: 'foo',
      context: 'discussion',
      number: 7,
      issue_number: 'unset',
      comment_id: 4004,
      actor: 'carol',
      params: {},
    },
  },
  {
    name: '04: issue_comment filtered out when allowed_contexts excludes issue',
    eventName: 'issue_comment',
    inputs: { allowed_contexts: 'discussion' },
    payload: {
      issue: { number: 42 },
      comment: { id: 1001, body: '.foo', user: { login: 'alice' } },
      sender: { login: 'alice' },
    },
    expected: {
      continue: 'false',
      info: /not in allowed_contexts/,
    },
  },
  {
    name: '05: issue_comment on PR filtered out when allowed_contexts excludes pull_request',
    eventName: 'issue_comment',
    inputs: { allowed_contexts: 'issue' },
    payload: {
      issue: {
        number: 99,
        pull_request: { url: 'https://api.github.com/repos/o/r/pulls/99' },
      },
      comment: { id: 2002, body: '.foo', user: { login: 'bob' } },
      sender: { login: 'bob' },
    },
    expected: {
      continue: 'false',
      info: /not in allowed_contexts/,
    },
  },
  {
    name: '06: discussion_comment filtered out when allowed_contexts excludes discussion',
    eventName: 'discussion_comment',
    inputs: { allowed_contexts: 'issue,pull_request' },
    payload: {
      discussion: { number: 7 },
      comment: { id: 4004, body: '.foo', user: { login: 'carol' } },
      sender: { login: 'carol' },
    },
    expected: {
      continue: 'false',
      info: /not in allowed_contexts/,
    },
  },
  {
    name: '07: unsupported event (push) emits continue=false with a warning naming both supported events',
    eventName: 'push',
    payload: {},
    expected: {
      continue: 'false',
      warning: /issue_comment.*discussion_comment/,
    },
  },
  {
    name: '08: comment body without a command emits continue=false plus an info notice',
    eventName: 'issue_comment',
    inputs: { allowed_contexts: 'issue,pull_request' },
    payload: {
      issue: { number: 42 },
      comment: { id: 1001, body: 'no command here', user: { login: 'alice' } },
      sender: { login: 'alice' },
    },
    expected: {
      continue: 'false',
      info: /No command was detected/,
    },
  },
  {
    name: '09: comment with command outside the allow-list cancels with continue=false plus an info notice',
    eventName: 'issue_comment',
    inputs: { command: 'foo', allowed_contexts: 'issue,pull_request' },
    payload: {
      issue: { number: 42 },
      comment: { id: 1001, body: '.bar', user: { login: 'alice' } },
      sender: { login: 'alice' },
    },
    expected: {
      continue: 'false',
      info: /trigger has been canceled/,
    },
  },
  {
    name: '10: comment with command and no params yields params={}',
    eventName: 'issue_comment',
    inputs: { command: 'foo', allowed_contexts: 'issue,pull_request' },
    payload: {
      issue: { number: 42 },
      comment: { id: 1001, body: '.foo', user: { login: 'alice' } },
      sender: { login: 'alice' },
    },
    expected: {
      continue: 'true',
      command: 'foo',
      params: {},
    },
  },
  {
    name: '11: comment with all parameter value kinds round-trips through params JSON',
    eventName: 'issue_comment',
    inputs: { command: 'foo', allowed_contexts: 'issue,pull_request' },
    payload: {
      issue: { number: 42 },
      comment: {
        id: 1001,
        body: '.foo s="hello", n=42, b=true, x=null, sl=string-like-value',
        user: { login: 'alice' },
      },
      sender: { login: 'alice' },
    },
    expected: {
      continue: 'true',
      command: 'foo',
      params: {
        s: 'hello',
        n: 42,
        b: true,
        x: null,
        sl: 'string-like-value',
      },
    },
  },
  {
    name: '12: malformed params trigger core.setFailed and run() returns 1',
    eventName: 'issue_comment',
    inputs: { command: 'foo', allowed_contexts: 'issue,pull_request' },
    payload: {
      issue: { number: 42 },
      comment: { id: 1001, body: '.foo a=', user: { login: 'alice' } },
      sender: { login: 'alice' },
    },
    expected: {
      continue: 'false',
      failed: true,
      returnCode: 1,
    },
  },
  {
    name: '13: invalid allowed_contexts value emits a warning naming the bogus entry and continue=false',
    eventName: 'issue_comment',
    inputs: { allowed_contexts: 'bogus,issue' },
    payload: {
      issue: { number: 42 },
      comment: { id: 1001, body: '.foo', user: { login: 'alice' } },
      sender: { login: 'alice' },
    },
    expected: {
      continue: 'false',
      warning: /allowed_contexts.*bogus/,
    },
  },
  {
    name: '14: edited comment reports the editor (sender) as actor, not the original author',
    eventName: 'issue_comment',
    inputs: { allowed_contexts: 'issue,pull_request' },
    payload: {
      action: 'edited',
      issue: { number: 42 },
      comment: { id: 1001, body: '.foo', user: { login: 'release-manager' } },
      sender: { login: 'write-collaborator' },
    },
    expected: {
      continue: 'true',
      command: 'foo',
      actor: 'write-collaborator',
    },
  },
  {
    name: '15: deleted comment emits continue=false even when its body is an allowed command',
    eventName: 'issue_comment',
    inputs: { allowed_contexts: 'issue,pull_request' },
    payload: {
      action: 'deleted',
      issue: { number: 42 },
      comment: { id: 1001, body: '.foo', user: { login: 'alice' } },
      sender: { login: 'alice' },
    },
    expected: {
      continue: 'false',
      info: /deleted/,
    },
  },
  {
    name: '16: params are not echoed through core.info',
    eventName: 'issue_comment',
    inputs: { allowed_contexts: 'issue,pull_request' },
    payload: {
      issue: { number: 42 },
      comment: { id: 1001, body: '.foo note="##[warning]x"', user: { login: 'alice' } },
      sender: { login: 'alice' },
    },
    expected: {
      continue: 'true',
      params: { note: '##[warning]x' },
      notInfo: /##\[/,
    },
  },
  permissionScenario('17: allowed_permissions passes a sender whose role is listed', 'write,maintain,admin', 'write', {
    continue: 'true',
    command: 'foo',
    permissionLookup: { username: 'alice', token: 'test-token' },
  }),
  permissionScenario(
    '18: allowed_permissions rejects a sender whose role is not listed',
    'write,maintain,admin',
    'read',
    {
      continue: 'false',
      info: /"read".*not in allowed_permissions/,
    },
  ),
  permissionScenario(
    '19: allowed_permissions fails closed with a warning when the permission lookup throws',
    'write',
    new Error('Not Found'),
    { continue: 'false', warning: /permission.*alice/ },
  ),
  permissionScenario('20: invalid allowed_permissions value warns and emits continue=false', 'write,owner', 'admin', {
    continue: 'false',
    warning: /allowed_permissions.*owner/,
    permissionLookup: 'none',
  }),
  permissionScenario('21: allowed_permissions listing "read" warns that every user has it', 'read', 'read', {
    continue: 'true',
    warning: /"read"/,
  }),
  {
    name: '22: without allowed_permissions the permission API is not called',
    eventName: 'issue_comment',
    inputs: { allowed_contexts: 'issue,pull_request' },
    payload: {
      issue: { number: 42 },
      comment: { id: 1001, body: '.foo', user: { login: 'alice' } },
      sender: { login: 'alice' },
    },
    expected: {
      continue: 'true',
      permissionLookup: 'none',
    },
  },
  {
    name: '23: the github_token input is left out of the debug log',
    eventName: 'issue_comment',
    inputs: { allowed_contexts: 'issue,pull_request', github_token: 'ghs_secretvalue' },
    payload: {
      issue: { number: 42 },
      comment: { id: 1001, body: '.foo', user: { login: 'alice' } },
      sender: { login: 'alice' },
    },
    expected: {
      continue: 'true',
      notDebug: /ghs_secretvalue/,
    },
  },
];

beforeEach(() => {
  mocks.setOutput.mockReset();
  mocks.setFailed.mockReset();
  mocks.warning.mockReset();
  mocks.info.mockReset();
  mocks.debug.mockReset();
  mocks.getPermission.mockReset();
  mocks.octokitToken.mockReset();
  mocks.inputs.command = 'foo';
  mocks.inputs.allowed_contexts = 'issue,pull_request,discussion';
  mocks.inputs.allowed_permissions = null;
  mocks.inputs.github_token = 'test-token';
  mocks.context.eventName = 'issue_comment';
  mocks.context.payload = {};
});

test.each(scenarios)('$name', async (scenario) => {
  if (scenario.inputs?.command !== undefined) {
    mocks.inputs.command = scenario.inputs.command;
  }
  if (scenario.inputs?.allowed_contexts !== undefined) {
    mocks.inputs.allowed_contexts = scenario.inputs.allowed_contexts;
  }
  if (scenario.inputs?.allowed_permissions !== undefined) {
    mocks.inputs.allowed_permissions = scenario.inputs.allowed_permissions;
  }
  if (scenario.inputs?.github_token !== undefined) {
    mocks.inputs.github_token = scenario.inputs.github_token;
  }
  const { permission } = scenario;
  if (permission instanceof Error) {
    mocks.getPermission.mockRejectedValue(permission);
  } else if (permission !== undefined) {
    mocks.getPermission.mockResolvedValue({ data: { role_name: permission } });
  }
  mocks.context.eventName = scenario.eventName;
  mocks.context.payload = scenario.payload;

  const returnCode = await run();

  expect(outputFor('continue')).toBe(scenario.expected.continue);

  if (scenario.expected.command !== undefined) {
    expect(outputFor('command')).toBe(scenario.expected.command);
  }

  if (scenario.expected.params !== undefined) {
    const rawParams = outputFor('params');
    expect(typeof rawParams).toBe('string');
    expect(JSON.parse(rawParams as string)).toEqual(scenario.expected.params);
  }

  if (scenario.expected.number !== undefined) {
    expect(outputFor('number')).toBe(scenario.expected.number);
  }

  if (scenario.expected.issue_number === 'unset') {
    expect(outputFor('issue_number')).toBeUndefined();
  } else if (scenario.expected.issue_number !== undefined) {
    expect(outputFor('issue_number')).toBe(scenario.expected.issue_number);
  }

  if (scenario.expected.context !== undefined) {
    expect(outputFor('context')).toBe(scenario.expected.context);
  }

  if (scenario.expected.comment_id !== undefined) {
    expect(outputFor('comment_id')).toBe(scenario.expected.comment_id);
  }

  if (scenario.expected.actor !== undefined) {
    expect(outputFor('actor')).toBe(scenario.expected.actor);
  }

  if (scenario.expected.failed === true) {
    expect(mocks.setFailed).toHaveBeenCalled();
  } else {
    expect(mocks.setFailed).not.toHaveBeenCalled();
  }

  if (scenario.expected.warning !== undefined) {
    expect(matched(mocks.warning.mock.calls, scenario.expected.warning)).toBe(true);
  }

  if (scenario.expected.info !== undefined) {
    expect(matched(mocks.info.mock.calls, scenario.expected.info)).toBe(true);
  }

  if (scenario.expected.notInfo !== undefined) {
    expect(matched(mocks.info.mock.calls, scenario.expected.notInfo)).toBe(false);
  }

  if (scenario.expected.notDebug !== undefined) {
    expect(matched(mocks.debug.mock.calls, scenario.expected.notDebug)).toBe(false);
  }

  if (scenario.expected.permissionLookup === 'none') {
    expect(mocks.getPermission).not.toHaveBeenCalled();
  } else if (scenario.expected.permissionLookup !== undefined) {
    expect(mocks.getPermission).toHaveBeenCalledWith({
      owner: 'o',
      repo: 'r',
      username: scenario.expected.permissionLookup.username,
    });
    expect(mocks.octokitToken).toHaveBeenCalledWith(scenario.expected.permissionLookup.token);
  }

  if (scenario.expected.returnCode !== undefined) {
    expect(returnCode).toBe(scenario.expected.returnCode);
  }
});
