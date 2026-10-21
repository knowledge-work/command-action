import license from 'rollup-plugin-license';
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: 'esm',
  platform: 'node',
  target: 'node24',
  dts: false,
  sourcemap: false,
  clean: true,
  // `dist/index.js` (not `.mjs`) keeps `runs.main` unchanged; the root package.json's
  // `"type": "module"` is what makes Node load it as ESM.
  fixedExtension: false,
  // The runner executes the committed file with no node_modules, so every dependency is inlined.
  deps: { alwaysBundle: [/.*/] },
  plugins: [license({ thirdParty: { output: { file: 'dist/licenses.txt' } } })],
});
