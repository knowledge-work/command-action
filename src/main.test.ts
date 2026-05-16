import { beforeEach, expect, test, vi } from 'vitest';
import type { Inputs } from './inputs.js';

const mocks = vi.hoisted(() => ({
  setOutput: vi.fn(),
  setFailed: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  inputs: { command: 'foo', allowed_contexts: 'issue,pull_request' } satisfies Inputs,
  context: {
    eventName: 'issue_comment' as string,
    payload: {} as Record<string, unknown>,
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
}));

const { run } = await import('./main.js');

const outputFor = (key: string) => mocks.setOutput.mock.calls.find(([k]) => k === key)?.[1];

beforeEach(() => {
  mocks.setOutput.mockReset();
  mocks.setFailed.mockReset();
  mocks.warning.mockReset();
  mocks.info.mockReset();
  mocks.debug.mockReset();
  mocks.inputs['command'] = 'foo';
  mocks.inputs['allowed_contexts'] = 'issue,pull_request';
  mocks.context.eventName = 'issue_comment';
  mocks.context.payload = {
    issue: { number: 0 },
    comment: { id: 0, body: '.foo', user: { login: 'alice' } },
  };
});

test('issue context emits number and context="issue" alongside issue_number', async () => {
  mocks.context.payload = {
    issue: { number: 42 },
    comment: { id: 1001, body: '.foo', user: { login: 'alice' } },
  };

  await run();

  expect(outputFor('issue_number')).toBe(42);
  expect(outputFor('number')).toBe(42);
  expect(outputFor('context')).toBe('issue');
  expect(outputFor('number')).toBe(outputFor('issue_number'));
  expect(outputFor('continue')).toBe('true');
});

test('pull_request context emits number and context="pull_request" alongside issue_number', async () => {
  mocks.context.payload = {
    issue: {
      number: 99,
      pull_request: { url: 'https://api.github.com/repos/o/r/pulls/99' },
    },
    comment: { id: 2002, body: '.foo', user: { login: 'bob' } },
  };

  await run();

  expect(outputFor('issue_number')).toBe(99);
  expect(outputFor('number')).toBe(99);
  expect(outputFor('context')).toBe('pull_request');
  expect(outputFor('number')).toBe(outputFor('issue_number'));
  expect(outputFor('continue')).toBe('true');
});

test('invalid context emits only continue=false and never emits number / context / issue_number', async () => {
  mocks.context.eventName = 'push';
  mocks.context.payload = {
    issue: { number: 7 },
    comment: { id: 3003, body: '.foo', user: { login: 'eve' } },
  };

  await run();

  expect(outputFor('continue')).toBe('false');
  expect(outputFor('number')).toBeUndefined();
  expect(outputFor('context')).toBeUndefined();
  expect(outputFor('issue_number')).toBeUndefined();
  expect(mocks.warning).toHaveBeenCalled();
  const warningMessage = mocks.warning.mock.calls[0]?.[0] as string;
  expect(warningMessage).toContain('issue_comment');
  expect(warningMessage).toContain('discussion_comment');
});

test('discussion context emits number and context="discussion" without issue_number', async () => {
  mocks.inputs['allowed_contexts'] = 'issue,pull_request,discussion';
  mocks.context.eventName = 'discussion_comment';
  mocks.context.payload = {
    discussion: { number: 7 },
    comment: { id: 4004, body: '.foo', user: { login: 'carol' } },
  };

  await run();

  expect(outputFor('number')).toBe(7);
  expect(outputFor('context')).toBe('discussion');
  expect(outputFor('comment_id')).toBe(4004);
  expect(outputFor('actor')).toBe('carol');
  expect(outputFor('issue_number')).toBeUndefined();
  expect(outputFor('continue')).toBe('true');
});

test('allowed_contexts="issue" rejects a discussion_comment via the filter', async () => {
  mocks.inputs['allowed_contexts'] = 'issue';
  mocks.context.eventName = 'discussion_comment';
  mocks.context.payload = {
    discussion: { number: 7 },
    comment: { id: 4004, body: '.foo', user: { login: 'carol' } },
  };

  await run();

  expect(outputFor('continue')).toBe('false');
  expect(outputFor('number')).toBeUndefined();
  expect(outputFor('context')).toBeUndefined();
  expect(outputFor('issue_number')).toBeUndefined();
  expect(mocks.info).toHaveBeenCalled();
});

test('allowed_contexts="discussion" accepts a discussion_comment (single-context positive)', async () => {
  mocks.inputs['allowed_contexts'] = 'discussion';
  mocks.context.eventName = 'discussion_comment';
  mocks.context.payload = {
    discussion: { number: 7 },
    comment: { id: 4004, body: '.foo', user: { login: 'carol' } },
  };

  await run();

  expect(outputFor('number')).toBe(7);
  expect(outputFor('context')).toBe('discussion');
  expect(outputFor('issue_number')).toBeUndefined();
  expect(outputFor('continue')).toBe('true');
  const rejectionInfoCalls = mocks.info.mock.calls.filter(([msg]) =>
    typeof msg === 'string' ? msg.includes('not in allowed_contexts') : false,
  );
  expect(rejectionInfoCalls).toHaveLength(0);
});

test('allowed_contexts="discussion" rejects an issue_comment (heterogeneous single-context)', async () => {
  mocks.inputs['allowed_contexts'] = 'discussion';
  mocks.context.eventName = 'issue_comment';
  mocks.context.payload = {
    issue: { number: 42 },
    comment: { id: 1001, body: '.foo', user: { login: 'alice' } },
  };

  await run();

  expect(outputFor('continue')).toBe('false');
  expect(outputFor('context')).toBeUndefined();
  expect(outputFor('number')).toBeUndefined();
});
