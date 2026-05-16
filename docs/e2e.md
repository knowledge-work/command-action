# E2E (self-dogfood) workflow

The workflow at `.github/workflows/e2e.yaml` exercises the bundled `dist/index.js`
against real GitHub event payloads from this repository. It runs the action under
test against `issue_comment` (on issues and on PRs) and `discussion_comment`
events, and asserts the emitted outputs against an expectation directive embedded
in the triggering comment.

The matrix of `vitest` integration tests in `src/main.integration.test.ts` provides
fast, exhaustive coverage. This workflow complements that suite by validating the
real runtime path (`runs.using: node24` + payload shape) before a release ships.

## Comment convention

The directive is carried as a single-quoted JSON string under the reserved
`_expect_` key in the command's params, so the action's own parser sees it as a
regular params value:

```
.test foo=bar, _expect_='{"continue":"true","command":"test","params":{"foo":"bar"},"context":"issue"}'
```

The action parses this comment as `command=test, params={foo:"bar", _expect_:"<JSON>"}`
and emits the full `params` (including `_expect_`) as the `params` output. The
verification step then extracts `params._expect_`, JSON-decodes it, and compares
against the other observable outputs.

### Why not `# expect: ...` on a separate line?

The action's parser is strict: anything in the comment body after `.command
key=value, ...` that isn't a comma-separated key=value pair (or end-of-input)
causes a parse error and `core.setFailed`. A trailing `# expect:` line breaks
the parser before verification can run. Putting the directive inside a params
value is the only way to keep the directive in the same comment without
modifying the production parser.

### Rules

- The directive value is **a JSON string**, not raw JSON. Quote it with single
  quotes so the embedded double-quoted JSON does not collide with the param's
  delimiter.
- If the comment has no `_expect_` key (or the action did not emit `params` at
  all), the verification step falls back to a smoke check. The smoke check
  asserts that the action emitted a `continue` output and that its step outcome
  is not `failure`.
- Keys not listed in the directive are not checked.
- Unknown directive keys are reported as a mismatch (typo guard). The allowed
  keys are `failed`, `params`, `continue`, `command`, `number`, `context`,
  `issue_number`, `comment_id`, and `actor`. The internal `outcome` is asserted
  via `failed` rather than directly.
- The `failed` value must be a JSON boolean (`true` or `false`). A string
  `"true"` is reported as a mismatch (typo guard).
- A directive value of `null` means **must be unset** — the corresponding
  output must be empty. For example, `"issue_number": null` asserts that the
  action did not emit `issue_number` (regression guard for the soft-deprecation
  contract on `discussion_comment` events).
- The `_expect_` key is stripped from `actual.params` before comparison, so
  directive-bearing comments do not need to enumerate it under
  `expected.params`.
- Numeric JSON values are coerced via `String(...)` before comparison
  (GitHub Actions outputs are always strings).

### Examples

Positive case (action must succeed with the listed params):

```
.test name=alice, _expect_='{"continue":"true","command":"test","params":{"name":"alice"},"context":"issue"}'
```

Smoke run (no directive — only verifies the action ran end-to-end):

```
.test foo=bar
```

### Limitations of the directive carrier

The directive can only be carried on comments that produce `continue=true`,
because the action only emits the `params` output on that path
(`src/main.ts:110-112`). For negative cases — filtered `allowed_contexts`,
command not in the allow-list, malformed params — the directive cannot reach
the verification step. Use the smoke run convention for those, and confirm the
filter behavior manually in the workflow log (Verify step shows
`actual.continue` and `actual.outcome`).

## Security model

The primary security boundary is the GitHub `Environment` named `e2e`, configured
with required reviewers. Every workflow run pauses until a reviewer explicitly
approves it.

- Workflow source guarantee: GitHub Actions runs `issue_comment` and
  `discussion_comment` workflows from the repository default branch. A fork PR
  cannot mutate the e2e workflow file or scripts in a way that affects the run.
- Token scope: the workflow runs with the default `GITHUB_TOKEN` and an explicit
  `permissions: contents: read`. No personal access tokens or app installations
  are used.
- No secret usage in the action under test: the action only parses public
  comment text. A leaked approval has limited blast radius — the worst case is
  a CI minute burned on parsing a comment.

### Approval-then-edit race (known caveat)

A comment author can edit the comment body between the moment a reviewer
approves the `e2e` environment and the moment the workflow runs. The workflow
re-reads `github.event.comment.body` at run start (via the action's own payload
access), so an edited directive will be evaluated, not the body the reviewer
saw.

Mitigation is operational rather than code-side:

- Reviewers should screenshot or paste the comment body at approval time and
  compare it with the workflow's Verify step output.
- The risk is bounded because the e2e job has no write permissions and the
  action under test parses only public comment text.

A code-side mitigation (re-reading the comment body via `gh api` after
approval) is intentionally out of scope; it would require additional
`pull-requests: write` or `issues: write` scope that contradicts the
minimal-permissions design.

## Required repo settings

These are one-time admin tasks. Without them, the workflow will fail to start.

1. **Enable Discussions** on `knowledge-work/command-action`.
   Settings → General → Features → check `Discussions`.

2. **Create the `e2e` Environment**.
   Settings → Environments → `New environment` → name `e2e` → enable
   `Required reviewers` and add the `knowledge-work` org members who maintain
   this repo as required reviewers.

The list of reviewers should match the org members who already approve releases.

## Operational tradeoffs

By design, the `dogfood` job only runs when the comment body starts with a `.`
character (`startsWith(github.event.comment.body, '.')`). This filters out chat
or review comments so that the reviewer is not asked to approve the `e2e`
environment every time someone posts an unrelated comment.

The alternative (running on every comment) was considered and rejected because
it produces approval noise that drowns out real dogfood events.

If org policy or operational preferences change, this trade-off can be revisited
by editing the `dogfood.if` expression in `.github/workflows/e2e.yaml`.

## Smoke run

After Discussions and the `e2e` environment are configured, exercise each event
kind once with a passing directive and once with a deliberately wrong directive.

### Positive runs

1. **Issue comment** — open or use an existing issue and post:

   ```
   .test foo=bar, _expect_='{"continue":"true","command":"test","params":{"foo":"bar"},"context":"issue"}'
   ```

   Approve the `e2e` environment when prompted; confirm the workflow run passes.

2. **PR comment** — open or use an existing PR and post the same comment, but
   change `"context":"issue"` to `"context":"pull_request"`. Approve and verify.

3. **Discussion comment** — open or use a discussion and post the same comment,
   but with `"context":"discussion"` and add `"issue_number":null` (the soft-
   deprecation regression guard — `issue_number` must be unset on discussions).

### Negative runs

For each of the three event kinds, post a comment with a deliberately wrong
directive (for example, change one of the asserted values in the directive).
The workflow must fail with a clear `E2E mismatch:` message naming the failing
field.

### What "complete" looks like

- Six total dogfood runs (3 event kinds × positive + negative).
- All three positive runs end with `E2E expectations matched.` in the
  Verify step.
- All three negative runs fail in the Verify step with a clear mismatch
  message.

A failure outside the Verify step (for example, the action step itself crashed)
indicates a real regression in the action, not in the harness.

## How verification works

The verification logic lives in two files:

- `src/e2e-verify.ts` — pure functions (`extractExpectDirective`, `compare`)
  with unit tests in `src/e2e-verify.test.ts`. The runtime ships nothing here;
  these are test-only utilities re-used by the workflow.
- `scripts/e2e-verify.ts` — the CLI shim invoked by the workflow's Verify
  step. It reads environment variables (`ACTUAL_*`), calls the pure functions,
  and exits non-zero on any mismatch.

`dist/` drift is not re-asserted by this workflow because the existing
`.github/workflows/ci.yaml` job already gates it on every PR and every push to
`main`.
