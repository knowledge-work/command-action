# automerge-gate behavior verification (TEMPORARY)

This file exists only to produce a non-`.github/**` diff so that the
`actionlint` workflow's `paths` filter excludes this PR.

The associated PR is intentionally never merged. It is closed after
observing that:

- `actionlint` does NOT appear in `gh pr checks` (paths filter skipped it).
- `all-passed` (the automerge-gate job) still completes with SUCCESS,
  proving the gate ignores absent path-filtered workflows rather than
  blocking on them.

Delete this file by closing the PR and deleting the branch.
