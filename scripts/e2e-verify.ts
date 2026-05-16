import process from 'node:process';
import { type ActualOutputs, compare, extractExpectDirective } from '../src/e2e-verify.js';

const env = (key: string): string => process.env[key] ?? '';

const actual: ActualOutputs = {
  outcome: env('ACTUAL_OUTCOME'),
  continue: env('ACTUAL_CONTINUE'),
  command: env('ACTUAL_COMMAND'),
  params: env('ACTUAL_PARAMS'),
  number: env('ACTUAL_NUMBER'),
  context: env('ACTUAL_CONTEXT'),
  issue_number: env('ACTUAL_ISSUE_NUMBER'),
  comment_id: env('ACTUAL_COMMENT_ID'),
  actor: env('ACTUAL_ACTOR'),
};

let directive: Record<string, unknown> | null;
try {
  directive = extractExpectDirective(actual.params);
} catch (e) {
  console.error(`Failed to parse the dogfood directive — ${(e as Error).message}`);
  process.exit(1);
}

if (directive === null) {
  if (actual.continue === '') {
    console.error('Smoke test failed: action emitted no "continue" output.');
    process.exit(1);
  }
  if (actual.outcome === 'failure') {
    console.error('Smoke test failed: action step outcome was "failure" but no directive declared it.');
    process.exit(1);
  }
  console.log('Smoke test passed (no directive present in params).');
  process.exit(0);
}

const mismatches = compare(directive, actual);
if (mismatches.length > 0) {
  console.error('E2E mismatch:');
  for (const m of mismatches) {
    console.error('  - ' + m);
  }
  process.exit(1);
}

console.log('E2E expectations matched.');
