import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import * as YAML from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The CI dist check only proves that `dist/index.js` matches `src/`; any other entry point
// (`pre`, `post`, a different `main`) would ship code that no build step produced.
test('action.yaml runs only the built dist/index.js on node24', async () => {
  const action = YAML.parse(await fs.readFile(path.join(__dirname, '../action.yaml'), 'utf8'));
  expect(action.runs).toStrictEqual({ using: 'node24', main: 'dist/index.js' });
});
