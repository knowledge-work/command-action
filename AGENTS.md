# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Codex CLI, etc.) when working with code in this repository.

## Project

`IssueOps Command Action` — a JavaScript GitHub Action that parses `.command key=value, ...` comments on issues / PRs and emits structured outputs (`continue`, `params`, `command`, `actor`, `comment_id`, `issue_number`). See `action.yaml` for the full I/O contract.

- Entrypoint: `src/main.ts` → bundled to `dist/index.js` via `@vercel/ncc`
- Runtime: Node 24 (`runs.using: node24` in `action.yaml`)
- Core parser: `src/parse.ts`, built on `parjs` combinators

## Source layout

- `src/main.ts` — action entrypoint
- `src/parse.ts` — IssueOps command parser
- `src/utils.ts` — small helpers
- `src/*.test.ts` — vitest tests, colocated with source
- `src/inputs.ts` — **GENERATED** from `action.yaml` by `scripts/generate-inputs.ts`. Do not edit by hand.
- `src/unicode-regex.ts` — **GENERATED** by `scripts/generate-unicode-regex.ts`. Do not edit by hand.
- `dist/` — **GENERATED** by `pnpm build`. Committed so the runner can execute the action. Do not hand-edit.

## Development

- Setup: `mise install && pnpm i`
- Build: `pnpm build` (bundles to `dist/` via `@vercel/ncc`)
- Test: `pnpm test` (vitest). Single file: `pnpm vitest run src/<file>.test.ts`
- Lint: `pnpm lint` (oxlint, config in `.oxlintrc.json`)
- Format: `pnpm format` / `pnpm format:check` (oxfmt, config in `.oxfmtrc.json`)
- Typecheck: `pnpm typecheck`
- Generate: `pnpm generate` (docs + inputs + unicode-regex + format)

## When edits require regeneration

CI fails if `dist/` or any generated file drifts from source. Always commit the regenerated output alongside the change.

| You changed...                       | Re-run                        | Commit these too                      |
| ------------------------------------ | ----------------------------- | ------------------------------------- |
| Any non-generated file in `src/`     | `pnpm build`                  | `dist/`                               |
| `action.yaml` inputs / outputs       | `pnpm generate`               | `dist/`, `src/inputs.ts`, `README.md` |
| Unicode-handling logic               | `pnpm generate:unicode-regex` | `src/unicode-regex.ts`                |
| Docs in `action.yaml` (descriptions) | `pnpm generate:docs`          | `README.md`                           |

## Code style

- TypeScript: prefer `type` over `interface` (enforced by `typescript/consistent-type-definitions`)
- Parsing: use `parjs` combinators, not regex (the codebase invests in parser correctness — preserve that)
- ESM only (`"type": "module"`)
- Formatter (`oxfmt`): 120 char width, single quotes, trailing commas, sorted imports & `package.json`
- Linter (`oxlint`): bans `any`, `ts-ignore`, nested ternaries, `console` (allowed in `scripts/`)

## Commits & PRs

- Conventional commits enforced by `commitlint` (`@commitlint/config-conventional`). Examples:
  - `feat(parse): support escaped quotes in strings`
  - `fix(main): handle missing comment body`
  - `chore(deps): bump parjs to 1.3.10`
- Pre-commit hook runs `lint-staged` (`oxfmt --write` + `oxlint` on staged `*.{js,ts}`)
- Releases are automated via `semantic-release` on push to `main`

## GitHub Actions conventions

- Pin every `uses:` in `.github/workflows/*` to a full 40-char commit SHA, with a trailing `# vX.Y.Z` comment for readability.
- Do not use `@v4` / `@main` / floating-tag refs.

## Language

All source code, comments, commit messages, and documentation must be written in English.
