// Pure functions for the self-dogfood e2e verification step.
// No console, no process.exit — the CLI shim under scripts/ handles I/O.

export type ActualOutputs = {
  outcome: string;
  continue: string;
  command: string;
  params: string;
  number: string;
  context: string;
  issue_number: string;
  comment_id: string;
  actor: string;
};

// The dogfood directive lives inside the comment's `params` block under this key,
// e.g. `.test foo=bar, _expect_='{"continue":"true",...}'`. This shape keeps the
// directive parseable by the action's own parser (the only thing it can route
// through is a valid params value), at the cost of reserving `_expect_` as a
// dogfood-only key. The trade-off: directives can only be carried on comments
// that produce `continue=true` (the action emits `params` only on that path).
// Negative cases (filtered context, unknown command, malformed params) fall back
// to the smoke check — see docs/e2e.md.
export const E2E_DIRECTIVE_KEY = '_expect_';

const PARAMS_KEY = 'params';
const FAILED_KEY = 'failed';

// Directive keys that map to ActualOutputs scalar fields. `outcome` is intentionally
// excluded — users assert the action step's outcome via `failed`, not directly.
const SCALAR_DIRECTIVE_KEYS = ['continue', 'command', 'number', 'context', 'issue_number', 'comment_id', 'actor'];

const ALLOWED_DIRECTIVE_KEYS = new Set<string>([FAILED_KEY, PARAMS_KEY, ...SCALAR_DIRECTIVE_KEYS]);

/**
 * Extract the dogfood directive from the action's `params` output JSON.
 * - Returns null when `paramsJson` is empty (action did not emit params, e.g. continue=false paths).
 * - Returns null when the parsed params object does not contain `directiveKey`.
 * - Throws SyntaxError if `paramsJson` itself is not valid JSON.
 * - Throws SyntaxError if `params[directiveKey]` is not valid JSON.
 * - Throws TypeError if either decoded value is not a plain object.
 */
export const extractExpectDirective = (
  paramsJson: string,
  directiveKey: string = E2E_DIRECTIVE_KEY,
): Record<string, unknown> | null => {
  if (paramsJson === '') return null;
  const params: unknown = JSON.parse(paramsJson);
  if (typeof params !== 'object' || params === null || Array.isArray(params)) {
    throw new TypeError('action params output must decode to a plain JSON object');
  }
  const directiveRaw = (params as Record<string, unknown>)[directiveKey];
  if (directiveRaw === undefined) return null;
  if (typeof directiveRaw !== 'string') {
    throw new TypeError(`params.${directiveKey} must be a JSON string`);
  }
  const directive: unknown = JSON.parse(directiveRaw);
  if (typeof directive !== 'object' || directive === null || Array.isArray(directive)) {
    throw new TypeError(`params.${directiveKey} must decode to a plain JSON object`);
  }
  return directive as Record<string, unknown>;
};

const deepEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const aKeys = Object.keys(ao);
  const bKeys = Object.keys(bo);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(bo, k)) return false;
    if (!deepEqual(ao[k], bo[k])) return false;
  }
  return true;
};

/**
 * Compare the dogfood directive against the action's observable outputs.
 * Returns an array of human-readable mismatch messages — empty array means OK.
 *
 * When comparing `params`, the directive key (e.g. `_expect_`) is stripped from
 * the actual params before deep-equal — the directive lives there only to carry
 * itself through the action and is not part of the user-visible params contract.
 */
export const compare = (
  expected: Record<string, unknown>,
  actual: ActualOutputs,
  directiveKey: string = E2E_DIRECTIVE_KEY,
): string[] => {
  const mismatches: string[] = [];

  // `failed` value-type validation (boolean only).
  if (Object.prototype.hasOwnProperty.call(expected, FAILED_KEY)) {
    const failedValue = expected[FAILED_KEY];
    if (typeof failedValue !== 'boolean') {
      mismatches.push(`failed: directive value must be a boolean (got ${typeof failedValue})`);
    } else if (failedValue === true) {
      if (actual.outcome !== 'failure') {
        mismatches.push(`failed: expected the action step to fail, but outcome was "${actual.outcome}"`);
      }
    } else {
      if (actual.outcome !== 'success') {
        mismatches.push(`failed: expected the action step to succeed, but outcome was "${actual.outcome}"`);
      }
    }
  } else if (actual.outcome === 'failure') {
    mismatches.push('failed: action step outcome was "failure" but the directive did not declare `failed: true`');
  }

  for (const key of Object.keys(expected)) {
    if (!ALLOWED_DIRECTIVE_KEYS.has(key)) {
      mismatches.push(
        `${key}: unknown directive key (typo? allowed keys: ${[...ALLOWED_DIRECTIVE_KEYS].sort().join(', ')})`,
      );
      continue;
    }

    if (key === FAILED_KEY) continue;

    if (key === PARAMS_KEY) {
      if (actual.params === '') {
        mismatches.push('params: expected the action to emit params, but the params output was unset');
        continue;
      }
      let parsedActual: unknown;
      try {
        parsedActual = JSON.parse(actual.params);
      } catch (e) {
        mismatches.push(`params: actual output is not valid JSON (${(e as Error).message})`);
        continue;
      }
      if (typeof parsedActual !== 'object' || parsedActual === null || Array.isArray(parsedActual)) {
        mismatches.push('params: actual output is not a plain JSON object');
        continue;
      }
      // Strip the directive key from the actual params before deep-equal —
      // it is dogfood-internal and not part of the user-visible params contract.
      const actualParams = { ...(parsedActual as Record<string, unknown>) };
      delete actualParams[directiveKey];
      if (!deepEqual(actualParams, expected[PARAMS_KEY])) {
        mismatches.push(
          `params: expected ${JSON.stringify(expected[PARAMS_KEY])} but got ${JSON.stringify(actualParams)}`,
        );
      }
      continue;
    }

    const actualValue = actual[key as keyof ActualOutputs];
    const expectedValue = expected[key];

    if (expectedValue === null) {
      if (actualValue !== '') {
        mismatches.push(`${key}: expected to be unset (empty string) but got "${actualValue}"`);
      }
      continue;
    }

    const expectedString = String(expectedValue);
    if (actualValue !== expectedString) {
      mismatches.push(`${key}: expected "${expectedString}" but got "${actualValue}"`);
    }
  }

  return mismatches;
};
