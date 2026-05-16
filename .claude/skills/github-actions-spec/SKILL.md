---
name: github-actions-spec
description: GitHub Actions / JavaScript Action spec reference grounded in the live official GitHub Docs (fetched on demand, not embedded). Use whenever planning, implementing, or reviewing any change touching `action.yaml` / `action.yml` (inputs, outputs, branding, `runs.using`, `pre`/`post`), workflow files under `.github/workflows/`, the JS action runtime (Node version, `dist/` bundling, `main` entrypoint), `@actions/toolkit` usage (`core`, `github`, `exec`), `GITHUB_TOKEN` permissions, event triggers, contexts, or expressions. Trigger even when the user does NOT explicitly ask to "check the spec" — verify the change against the latest docs and surface deprecations, breaking changes, and runtime constraints before they land. Especially important in repos that ship a custom action (`action.yaml` at the root) or maintain non-trivial workflows.
---

# github-actions-spec

This skill grounds GitHub Actions related work in the **latest official GitHub Docs and toolkit source**, fetched live, so that proposed changes are verified against authoritative material instead of relying on memory.

The skill itself contains **no spec content** — only a URL catalog and a fetch workflow. GitHub Actions evolves fast (supported Node runtimes, deprecation timelines, default token permissions, toolkit APIs) and any embedded copy of the spec would drift. Always fetch the canonical doc with `WebFetch` and read it for the specific question at hand.

## When this skill applies

Use it whenever the user's request touches any of the following:

- **Action manifest** (`action.yaml` / `action.yml`): inputs, outputs, `runs.using`, `runs.main`, `runs.pre`/`post`, `runs.pre-if`/`post-if`, branding, `default` / `required` / `deprecationMessage`.
- **JavaScript action runtime**: switching the Node version (`node20` → `node24` etc.), bundling strategy, `dist/` commit policy, sourcemaps, exit codes, `pre`/`post` lifecycle.
- **Workflow files** (`.github/workflows/*.yml`): triggers (`on:`), jobs, steps, `permissions:`, `concurrency:`, `strategy.matrix`, reusable workflows (`workflow_call`), composite actions, environment protection rules, OIDC.
- **`@actions/toolkit` usage**: `core` (inputs, outputs, logging, summary, masking, state, command files), `github` (`context`, `getOctokit`), `exec`, `io`, `cache`, `artifact`, `glob`.
- **Security**: `GITHUB_TOKEN` permissions scopes, SHA-pinning third-party actions, secrets vs variables, `pull_request_target` pitfalls, `workflow_run` privilege boundary, OIDC for cloud auth.
- **Events & payloads**: which events trigger workflows, payload shape on `github.context.payload`, `issue_comment` vs `pull_request_review_comment`, fork-permission caps.
- **Marketplace publishing**: required manifest fields, branding constraints, versioning conventions.

If the work plausibly intersects any of these, load this skill before proposing changes.

## Verification workflow

Run this loop every time the skill is active:

1. **Identify the change scope.** From the user request and the diff (or planned diff), classify what is changing — manifest field, runtime version, workflow trigger, token permission, toolkit API call, event handling, etc. Multiple categories can apply.

2. **Pick the canonical URL(s)** from the catalog below that match the scope.

3. **Fetch with `WebFetch`, framing a _specific_ question.** Do not ask the page to summarize itself — ask the exact question the change raises. Examples:
   - "From this page, list every currently supported value for `runs.using` in a JavaScript action and any deprecation note attached to each."
   - "From this page, what is the default permission set for `GITHUB_TOKEN` when `permissions:` is omitted at the workflow and job levels?"
   - "From this README, what is the current signature of `core.getInput`, including all options? Is there a recommended pattern for multiline values?"
   - "From this page, what is the difference between `issue_comment` and `pull_request_review_comment` in terms of when each fires and the payload shape?"

4. **Cross-check the proposed change against the fetched doc.** Be explicit: "The doc says X, the change does Y." If the change adds a field that no longer exists, removes a required field, or uses a deprecated command (e.g., `::set-output::`), flag it before any code is written.

5. **Surface adjacent risks.** Even when the change itself is valid, mention nearby deprecation deadlines, default-changing behaviors, or security postures the user may not have considered (e.g. bumping Node forces self-hosted runners on older images to upgrade; new `permissions:` scope was just added that better fits this use case).

If the work is purely about _this repo's_ application logic (parser, command matching, internal helpers) and does not touch any Actions surface, this skill is not needed.

## URL catalog

Canonical sources, organized by scope. When in doubt about which to fetch, prefer the doc that lives under the change's scope; fall back to the broader "About / overview" page only when the targeted page does not exist.

GitHub Docs URLs are stable but content drifts and the URL paths themselves get reorganized. Prefer the English (`/en/`) variant for canonical phrasing. For toolkit APIs, the GitHub repo READMEs / source are the source of truth, not docs.github.com.

**If a URL below returns 404 or doesn't contain the section you expected**, the docs were likely reorganized. Fall back in this order: (1) drop the deepest path segment and refetch the parent (e.g. `/en/actions/reference/security/secure-use` → `/en/actions/reference/security`); (2) search `docs.github.com` for the topic keyword via WebFetch on the docs search URL; (3) use the GitHub Changelog as a last resort. Then state in your verdict that a URL in the catalog was stale, so the user can update this file. Never silently fall back to memory.

### Custom action authoring (action.yaml)

- Custom actions overview — https://docs.github.com/en/actions/concepts/workflows-and-actions/custom-actions
- Metadata syntax for GitHub Actions (`action.yaml` schema, all fields, `runs.using` values) — https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax
- Create a JavaScript action (walkthrough, lifecycle) — https://docs.github.com/en/actions/tutorials/create-actions/create-a-javascript-action
- Create a composite action — https://docs.github.com/en/actions/tutorials/create-actions/create-a-composite-action
- Create a Docker container action — https://docs.github.com/en/actions/tutorials/use-containerized-services/create-a-docker-container-action
- Dockerfile support for GitHub Actions — https://docs.github.com/en/actions/reference/workflows-and-actions/dockerfile-support
- Set exit codes for actions — https://docs.github.com/en/actions/how-tos/create-and-publish-actions/set-exit-codes
- Release and maintain actions — https://docs.github.com/en/actions/how-tos/create-and-publish-actions/release-and-maintain-actions
- Publish in GitHub Marketplace — https://docs.github.com/en/actions/how-tos/create-and-publish-actions/publish-in-github-marketplace

### Workflow authoring (.github/workflows/\*)

- Workflow syntax for GitHub Actions — https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
- Events that trigger workflows (full event list + payload structure + filters) — https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- Contexts (`github`, `env`, `inputs`, `steps`, `needs`, `matrix`, etc.) — https://docs.github.com/en/actions/reference/workflows-and-actions/contexts
- Expressions (operators, status check functions, format strings) — https://docs.github.com/en/actions/reference/workflows-and-actions/expressions
- Variables (default env vars: `GITHUB_*`, `RUNNER_*`) — https://docs.github.com/en/actions/reference/workflows-and-actions/variables
- Workflow commands (file-based: `GITHUB_OUTPUT`, `GITHUB_ENV`, `GITHUB_PATH`, `GITHUB_STEP_SUMMARY`; deprecation of stdout `::set-output::`) — https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands
- Reuse workflows (`workflow_call`) — https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows

### Security

- Authenticate with `GITHUB_TOKEN` (lifecycle, fork-PR caps, default permissions) — https://docs.github.com/en/actions/tutorials/authenticate-with-github_token
- Permissions for `GITHUB_TOKEN` (full scope list + event caps) — https://docs.github.com/en/actions/reference/security/secure-use#permissions-for-the-github_token
- Secure use reference (security hardening: SHA pinning, untrusted-input handling, `pull_request_target` boundary) — https://docs.github.com/en/actions/reference/security/secure-use
- Use secrets in GitHub Actions — https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets
- OpenID Connect (OIDC) — https://docs.github.com/en/actions/concepts/security/openid-connect

### `@actions/toolkit` (SDK — source of truth is the repo, not docs.github.com)

- Toolkit repo root — https://github.com/actions/toolkit
- `@actions/core` README — https://github.com/actions/toolkit/blob/main/packages/core/README.md
- `@actions/github` README — https://github.com/actions/toolkit/blob/main/packages/github/README.md
- `@actions/exec` README — https://github.com/actions/toolkit/blob/main/packages/exec/README.md
- `@actions/io` README — https://github.com/actions/toolkit/blob/main/packages/io/README.md
- `@actions/cache` README — https://github.com/actions/toolkit/blob/main/packages/cache/README.md
- `@actions/artifact` README — https://github.com/actions/toolkit/blob/main/packages/artifact/README.md
- `@actions/glob` README — https://github.com/actions/toolkit/blob/main/packages/glob/README.md

When verifying a toolkit API signature or behavior, fetch the README; if the README is ambiguous, fall back to the `src/` directory under the same package (e.g., `https://github.com/actions/toolkit/tree/main/packages/core/src`) and ask for the specific exported symbol.

### Runner & Node runtime status (fast-moving)

The set of supported `runs.using: nodeXX` values changes over time. Default Node versions on hosted runners also change. Verify against:

- Metadata syntax page (see above) — currently-supported `runs.using` values are listed there.
- `actions/runner` releases — https://github.com/actions/runner/releases — for the Node version shipped in each runner image.
- GitHub Changelog (Actions tag) — https://github.blog/changelog/label/actions/ — announces Node deprecations, default-permission changes, and other breaking changes.

## How to frame `WebFetch` prompts

Bad — generates a wall of generic summary:

> "Summarize this page about GitHub Actions metadata."

Good — narrow to the specific decision:

> "From this page, list every value currently allowed for `runs.using` in a JavaScript action, and quote any deprecation note attached to each."

> "From this README, does `core.setOutput` automatically handle multiline values, or do I need to write to `GITHUB_OUTPUT` manually with a heredoc delimiter? Quote the relevant section."

> "From this page, what is the difference between `pull_request` and `pull_request_target` regarding (a) which ref's workflow runs, (b) what permissions `GITHUB_TOKEN` has, and (c) which ref's code gets checked out by default?"

Specific framing keeps the response focused and avoids burning context on unrelated material.

## Repository context

This repo ships a JavaScript Action (`action.yaml` at the root, `runs.main: dist/index.js`, bundled via `@vercel/ncc`). Check `action.yaml` for the current `runs.using` Node version rather than assuming. Project conventions live in the root `CLAUDE.md` — notably:

- `dist/` is committed; any source change requires `pnpm build` + commit.
- `pnpm generate` regenerates docs, inputs (`src/inputs.ts` from `action.yaml`), and the unicode regex; run after manifest or unicode-handling changes.
- Workflow `uses:` lines are pinned to full commit SHAs.

Cross-check changes against `CLAUDE.md` for repo-specific conventions; cross-check against fetched GitHub Docs for the spec itself.

## Output expectations

Use this 4-part skeleton for every response. It adapts to two task types:

- **Verification** — an existing change (diff, file edit, code already drafted) is being checked against the spec.
- **Design / proposal** — the user is asking for a new artifact (workflow YAML, manifest edit, runtime plan) that does not exist yet.

The skeleton is the same for both; the _content of the verdict slot_ differs.

1. **What the change touches** — one or two lines: scope (manifest / runtime / workflow / toolkit / permissions / events) + the canonical URL(s) consulted. If multiple scopes apply (e.g. manifest edit that also affects toolkit usage), name each and fetch the URL for the **primary** scope; only fetch a secondary URL when the secondary scope materially gates the answer.

2. **What the docs say** — the relevant rule from the fetched doc, with a **verbatim quote** when precision matters (`runs.using` values, default permissions, fork-token caps, deprecation language), plus the URL. If a fetched URL did not contain the needed answer, say so and pick a different URL from the catalog rather than guessing.

3. **Verdict** — the actionable answer.
   - **For verification tasks**: state whether the change is consistent with the docs, with specific issues called out (wrong field, deprecated command, missing required key, etc.).
   - **For design / proposal tasks**: produce the artifact (diff, full YAML, command list, file paths). The artifact _is_ the verdict — there is no separate "deliverable" section. If the request as stated would produce something incorrect or unsafe, **refuse the literal request and propose the corrected shape**, citing the doc reason (e.g., the fork-PR / `pull_request_target` privilege boundary).

4. **Adjacent risks** — deprecations, breaking changes, security postures, runtime constraints, or downstream regeneration steps (`pnpm generate:inputs`, `pnpm build`, `dist/` commit, CI parity checks) the user should weigh. Pull these from the repo's `CLAUDE.md` for project conventions, and from the GitHub Changelog / runner releases for fluid spec state. Be specific — name the file or command.

Keep it concise. The user does not need a restatement of the entire spec — only the parts that bear on this change.
