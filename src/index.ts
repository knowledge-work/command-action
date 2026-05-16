import * as core from '@actions/core';
import { run } from './main.js';

try {
  process.exit(await run());
} catch (e) {
  core.setFailed(e instanceof Error ? e : new Error(String(e)));
  process.exit(1);
}
