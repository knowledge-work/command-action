import { describe, expect, test } from 'vitest';
import { type ActualOutputs, compare, E2E_DIRECTIVE_KEY, extractExpectDirective } from './e2e-verify.js';

const baseActual = (overrides: Partial<ActualOutputs> = {}): ActualOutputs => ({
  outcome: 'success',
  continue: '',
  command: '',
  params: '',
  number: '',
  context: '',
  issue_number: '',
  comment_id: '',
  actor: '',
  ...overrides,
});

const paramsWithDirective = (other: Record<string, unknown>, directive: Record<string, unknown>): string =>
  JSON.stringify({ ...other, [E2E_DIRECTIVE_KEY]: JSON.stringify(directive) });

describe('extractExpectDirective', () => {
  test('returns null on empty paramsJson (action did not emit params)', () => {
    expect(extractExpectDirective('')).toBeNull();
  });

  test('returns null when paramsJson lacks the directive key', () => {
    expect(extractExpectDirective(JSON.stringify({ foo: 'bar' }))).toBeNull();
  });

  test('parses an embedded directive value', () => {
    const params = paramsWithDirective({ foo: 'bar' }, { continue: 'true', command: 'test' });
    expect(extractExpectDirective(params)).toEqual({ continue: 'true', command: 'test' });
  });

  test('throws SyntaxError when the outer params JSON is malformed', () => {
    expect(() => extractExpectDirective('not json')).toThrow(SyntaxError);
  });

  test('throws SyntaxError when the inner directive JSON is malformed', () => {
    const params = JSON.stringify({ [E2E_DIRECTIVE_KEY]: '{ "continue":' });
    expect(() => extractExpectDirective(params)).toThrow(SyntaxError);
  });

  test('throws TypeError when params is not a plain object (array)', () => {
    expect(() => extractExpectDirective(JSON.stringify([1, 2, 3]))).toThrow(TypeError);
  });

  test('throws TypeError when the directive value is not a string', () => {
    const params = JSON.stringify({ [E2E_DIRECTIVE_KEY]: 42 });
    expect(() => extractExpectDirective(params)).toThrow(TypeError);
  });

  test('throws TypeError when the directive payload is an array', () => {
    const params = JSON.stringify({ [E2E_DIRECTIVE_KEY]: JSON.stringify([1, 2, 3]) });
    expect(() => extractExpectDirective(params)).toThrow(TypeError);
  });
});

describe('compare', () => {
  test('returns empty array when every expected field matches', () => {
    const actual = baseActual({
      outcome: 'success',
      continue: 'true',
      command: 'test',
      params: paramsWithDirective({ foo: 'bar' }, {}),
      context: 'issue',
      number: '42',
      issue_number: '42',
    });
    const mismatches = compare(
      {
        continue: 'true',
        command: 'test',
        params: { foo: 'bar' },
        context: 'issue',
        number: 42,
      },
      actual,
    );
    expect(mismatches).toEqual([]);
  });

  test('failed:true requires outcome=failure', () => {
    const actual = baseActual({ outcome: 'failure', continue: 'false' });
    expect(compare({ failed: true, continue: 'false' }, actual)).toEqual([]);
  });

  test('failed:false requires outcome=success', () => {
    const actual = baseActual({ outcome: 'success', continue: 'true' });
    expect(compare({ failed: false, continue: 'true' }, actual)).toEqual([]);
  });

  test('failed:true with outcome=success produces a mismatch', () => {
    const actual = baseActual({ outcome: 'success', continue: 'true' });
    const mismatches = compare({ failed: true }, actual);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatch(/failed.*outcome was "success"/);
  });

  test('failed absent + outcome=failure produces a mismatch (regression guard)', () => {
    const actual = baseActual({ outcome: 'failure', continue: 'false' });
    const mismatches = compare({ continue: 'false' }, actual);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatch(/outcome was "failure".*did not declare `failed: true`/);
  });

  test('non-boolean failed value is reported as a mismatch (string value typo guard)', () => {
    const actual = baseActual({ outcome: 'success', continue: 'true' });
    const mismatches = compare({ failed: 'true' as unknown as boolean }, actual);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatch(/^failed: directive value must be a boolean/);
  });

  test('non-boolean failed (number) is reported as a mismatch', () => {
    const actual = baseActual({ outcome: 'success' });
    const mismatches = compare({ failed: 1 as unknown as boolean }, actual);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatch(/^failed: directive value must be a boolean/);
  });

  test('params deep-equal mismatch is reported (directive key stripped from actual)', () => {
    const actual = baseActual({
      outcome: 'success',
      params: paramsWithDirective({ foo: 'bar' }, {}),
    });
    const mismatches = compare({ params: { foo: 'baz' } }, actual);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatch(/^params:/);
  });

  test('params deep-equal match with nested objects, numbers, and null (directive key stripped)', () => {
    const actual = baseActual({
      outcome: 'success',
      params: paramsWithDirective({ s: 'hi', n: 42, b: true, x: null, nested: { k: ['a', 'b'] } }, {}),
    });
    const mismatches = compare({ params: { s: 'hi', n: 42, b: true, x: null, nested: { k: ['a', 'b'] } } }, actual);
    expect(mismatches).toEqual([]);
  });

  test('null sentinel: issue_number=null matches empty actual', () => {
    const actual = baseActual({ outcome: 'success', issue_number: '' });
    expect(compare({ issue_number: null }, actual)).toEqual([]);
  });

  test('null sentinel: issue_number=null mismatches a populated actual', () => {
    const actual = baseActual({ outcome: 'success', issue_number: '42' });
    const mismatches = compare({ issue_number: null }, actual);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatch(/issue_number.*expected to be unset.*got "42"/);
  });

  test('String coercion: numeric JSON expected value compares against string actual', () => {
    const actual = baseActual({ outcome: 'success', number: '42' });
    expect(compare({ number: 42 }, actual)).toEqual([]);
  });

  test('continue: "true" matches string actual', () => {
    const actual = baseActual({ outcome: 'success', continue: 'true' });
    expect(compare({ continue: 'true' }, actual)).toEqual([]);
  });

  test('unknown key in expected is reported as a mismatch (typo guard)', () => {
    const actual = baseActual({ outcome: 'success', continue: 'true' });
    const mismatches = compare({ continue: 'true', mistyped_key: 'whatever' }, actual);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatch(/^mistyped_key: unknown directive key/);
  });

  test('outcome is not a valid directive key (users assert via `failed`)', () => {
    const actual = baseActual({ outcome: 'success', continue: 'true' });
    const mismatches = compare({ outcome: 'success' }, actual);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatch(/^outcome: unknown directive key/);
  });

  test('expected params with an unset (empty) actual.params is reported as a mismatch', () => {
    const actual = baseActual({ outcome: 'success', continue: 'false', params: '' });
    const mismatches = compare({ continue: 'false', params: {} }, actual);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatch(/^params: expected the action to emit params, but the params output was unset/);
  });
});
