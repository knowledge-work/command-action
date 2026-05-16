# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development

- Setup: `mise install && pnpm i`
- Build: `pnpm build` (bundles into dist/ via @vercel/ncc)
- Test: `pnpm test` (vitest), single file: `pnpm vitest run src/<file>.test.ts`
- Lint: `pnpm lint` (oxlint). Auto-fix: `pnpm lint --fix`
- Format: `pnpm format` (oxfmt)
- Typecheck: `pnpm typecheck`
- Generate: `pnpm generate` (docs, inputs, unicode-regex + format)

## Important: dist/ and Generated Files

`dist/` is committed to the repository (required for GitHub Actions). CI verifies that `dist/` matches the build output and generated files have no drift.

After changes:

1. Run `pnpm build` to rebuild dist/
2. Run `pnpm generate` if you modified action.yaml inputs, unicode handling, or documentation
3. Commit the updated dist/ and any generated file changes

## Code Style

- Prefer `type` over `interface` for TypeScript type definitions
- Use parjs (parser combinator library) for parsing logic, not regex
- ESM modules (`"type": "module"`)
- Conventional commits enforced via commitlint
- Formatter: oxfmt — 120 char width, single quotes, trailing commas

## Language

All source code, comments, commit messages, and documentation must be written in English.
