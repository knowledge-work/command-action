<div align="center">

# :wrench: IssueOps Command Action

<!-- gha-description-start -->

IssueOps commands in GitHub Actions.
<!-- gha-description-end -->

[![Build][badge-build]][build]
[![Apache-2.0][badge-license]][license]
[![semantic-release: angular][badge-semantic-release]][semantic-release]

</div>

`knowledge-work/command-action` is an Action inspired by [github/command](https://github.com/github/command/).

It provides primitive features to assist in implementing IssueOps commands. It parses key-value strings using a dedicated syntax and converts them into a format that can be used in subsequent workflows. These will help in implementing high-level IssueOps commands.

> [!note]
> Currently, a syntax that supports receiving multiple parameters is provided.

## :zap: Getting Started

This section introduces a quick start guide for `knowledge-work/command-action`.

### Usage

Specify the command name to be executed as IssueOps in the `command` option.

```yaml
- id: command
  uses: knowledge-work/command-action@<commit-sha> # <version>
  with:
    command: 'preview'
```

This sets up your custom IssueOps command to interpret comments on Issues and Pull Requests.

Subscribe the workflow to `issue_comment` with `types: [created]`, as in the example below. Without it, the workflow also runs when a comment is edited, so an existing command comment can be re-run or rewritten.

Refer to [Inputs](#inbox_tray-inputs) for other options, and to [Restricting who can run a command](#restricting-who-can-run-a-command) before running anything privileged.

> [!important]
> Replace `<commit-sha>` and `<version>` with the full commit SHA and the version of a release listed on the [Releases](https://github.com/knowledge-work/command-action/releases) page. The floating major tags are no longer updated: `v1` stays at v1.1.1 and `v2` at v2.4.0.

### Example

Here’s a simple workflow example to execute the `.greet` command in IssueOps.

```yaml
name: 'Greet DEMO'

on:
  issue_comment:
    types: [created]

jobs:
  demo:
    runs-on: ubuntu-latest
    steps:
      # Set up the ".greet" command.
      - id: command
        uses: knowledge-work/command-action@<commit-sha> # <version>
        with:
          command: 'greet'

      # Only run if `steps.<id>.outputs.continue` is "true".
      # This indicates that `knowledge-work` successfully parsed the command and the subsequent steps should continue.
      # IssueOps params are passed through `env:` and referenced as shell variables to avoid
      # GitHub Actions expression injection from attacker-controlled comment content.
      - name: Greet
        if: ${{ steps.command.outputs.continue == 'true' }}
        env:
          NAME: ${{ fromJSON(steps.command.outputs.params).name }}
        run: echo "Hi $NAME !"

      # Add other steps necessary for IssueOps...
```

You can invoke the `.greet` command as follows:

```
.greet name="Alice"
```

Refer to [IssueOps Command Syntax](#book-issueops-command-syntax) for more detailed syntax.

## :book: IssueOps Command Syntax

When executing an IssueOps command, it often needs to accept some parameters. This Action parses the parameters using a simple key-value syntax, allowing you to quickly build the scaffolding required for more complex IssueOps commands.

### Overview

An IssueOps command is called in the following format:

```
.<command> <key>=<value>, <key>=<value>, ...
```

`<key>` should consist of the following:

- A string starting with alphanumeric characters or an underscore.
- A string followed by alphanumeric characters, underscores, or hyphens.

The key-value parameters provided are converted into JSON format and made available as `outputs.params`. For example, if the following command is executed:

```
.greet name="Alice", age=20
```

You will get the following `outputs.params`:

```json
{
  "name": "Alice",
  "age": 20
}
```

### Values

Values that can be specified for parameters include numbers, strings, booleans, and null. Below are examples of each. Refer to [`parse.test.ts`](./src/parse.test.ts) for more detailed specifications.

#### Numbers

Supports common signed and unsigned integers as well as decimals.

```
.command key=123
.command key=+456
.command key=-789
.command key=0.5
```

#### Strings

Strings can use single or double quotes. Escaping is also supported.

```
.command key='value'
.command key="value"

.command key='value \' with escape'
.command key="value \" with escape"
```

Quotes can also be omitted if the string does not contain spaces or commas.

```
.command key=/path/to/file.txt
```

#### Booleans

Supports booleans in JSON format.

```
.command key=true
.command key=false
```

#### null

Supports null in JSON format.

```
.command key=null
```

## :inbox_tray: Inputs

<!-- gha-inputs-start -->

| ID                    | Required           | Default                         | Description                                                                                                                                                                                                                                                                                                         |
| :-------------------- | :----------------- | :------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `command`             | :white_check_mark: | n/a                             | The name of the command to be used in IssueOps, which can be specified as a comma-separated list.                                                                                                                                                                                                                   |
| `allowed_contexts`    |                    | `issue,pull_request,discussion` | The comment contexts that trigger the IssueOps command, specified as a comma-separated list. Allowed values: `"issue"`, `"pull_request"`, `"discussion"`.                                                                                                                                                           |
| `allowed_permissions` |                    | n/a                             | Restricts the command to event senders whose repository role is in this comma-separated list, looked up with `github_token`. Allowed values: `"admin"`, `"maintain"`, `"write"`, `"triage"`, `"read"`. When unset, no permission check is performed. On a public repository, `"read"` lets any GitHub user through. |
| `github_token`        |                    | `${{ github.token }}`           | The token used to look up the repository role of the event sender when `allowed_permissions` is set.                                                                                                                                                                                                                |

<!-- gha-inputs-end -->

## :outbox_tray: Outputs

<!-- gha-outputs-start -->

| ID             | Description                                                                                                                                                                                                                                                                      |
| :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `continue`     | The string `"true"` when the comment contains an allowed IssueOps command (and, if `allowed_permissions` is set, the actor holds one of those permissions); otherwise `"false"`. Without `allowed_permissions` this is a syntax check only and does not authorize the commenter. |
| `params`       | The parameters of the triggered IssueOps command, provided as a JSON string.                                                                                                                                                                                                     |
| `comment_id`   | The ID of the comment that triggered this action.                                                                                                                                                                                                                                |
| `actor`        | The GitHub handle of the user who triggered the event (the event sender). On an edited comment this is the editor, not the original author.                                                                                                                                      |
| `issue_number` | [Deprecated] The issue number of the comment that triggered this action. Use `number` instead. This output will be removed in the next major release.                                                                                                                            |
| `number`       | The number of the issue, pull request, or discussion that triggered this action.                                                                                                                                                                                                 |
| `context`      | The context that triggered this action. One of `"issue"`, `"pull_request"`, or `"discussion"`.                                                                                                                                                                                   |
| `command`      | The command of the triggered IssueOps command.                                                                                                                                                                                                                                   |

<!-- gha-outputs-end -->

## :bulb: TIPS

A section introducing tips for implementing IssueOps commands.

### Restricting who can run a command

`outputs.continue` only tells you that the comment contains one of your commands. By default it does not check who wrote the comment, so on a public repository anyone who can comment can make it `"true"`. Before a command runs anything privileged (deployments, secrets, a write token), restrict it with `allowed_permissions`:

```yaml
- id: command
  uses: knowledge-work/command-action@<commit-sha> # <version>
  with:
    command: 'deploy'
    allowed_permissions: 'write,maintain,admin'
```

With `allowed_permissions` set, the action looks up the repository role of the event sender (`outputs.actor`) through the [repository permissions API](https://docs.github.com/en/rest/collaborators/collaborators#get-repository-permissions-for-a-user), using `github_token` (the workflow's `GITHUB_TOKEN` by default), and emits `continue: "false"` unless the role is in the list.

- The lookup needs only repository Metadata read access, which `GITHUB_TOKEN` always has, so no extra `permissions:` entry is required.
- An empty value (for example an unset `${{ vars.* }}`) is the same as leaving `allowed_permissions` out: no check is performed.
- Allowed values are `admin`, `maintain`, `write`, `triage`, and `read`. Custom repository roles are reported under their own name and are therefore never allowed.
- On a public repository every GitHub user has `read`, so listing it allows everyone.
- If the lookup fails (for example for a bot account, or a token without access), the action emits a warning and `continue: "false"`.
- `outputs.actor` is the user who triggered the event. On an edited comment that is the editor, not the original author.

### Triggering from GitHub Discussions

`command-action` also handles GitHub Discussions when the workflow is triggered by the `discussion_comment` event. The same parsing logic applies — the only differences are that `outputs.context` becomes `"discussion"` and `outputs.issue_number` is not emitted (use `outputs.number` instead).

```yaml
name: 'Greet DEMO (Discussions)'

on:
  discussion_comment:
    types: [created]

permissions:
  contents: read
  discussions: write # only required if your follow-up step writes back to the discussion (e.g. reactions via GraphQL)

jobs:
  demo:
    runs-on: ubuntu-latest
    steps:
      - id: command
        uses: knowledge-work/command-action@<commit-sha> # <version>
        with:
          command: 'greet'
      - if: ${{ steps.command.outputs.continue == 'true' }}
        env:
          NAME: ${{ fromJSON(steps.command.outputs.params).name }}
        run: echo "Hi $NAME !"
```

> [!warning]
> Discussion / Issue / PR comments are attacker-controlled. Pass IssueOps params via `env:` and reference them as shell variables (`"$NAME"`) instead of interpolating `${{ ... }}` directly into a `run:` script. See [GitHub Actions security hardening](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#using-an-intermediate-environment-variable) for details.

To restrict the action to discussions only (or to issues / pull requests only), use the [`allowed_contexts`](#inbox_tray-inputs) input — for example `allowed_contexts: 'discussion'`.

### Reacting to the comment

You can use [actions/github-script](https://github.com/actions/github-script) to add a reaction to the comment that triggered the IssueOps command.

```yaml
jobs:
  demo:
    runs-on: ubuntu-latest
    steps:
      - id: command
        uses: knowledge-work/command-action@<commit-sha> # <version>
        with:
          command: 'greet'

      # A snippet to add a reaction to the comment that triggered the command.
      - if: ${{ steps.command.outputs.continue == 'true' }}
        name: Reactions
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.reactions.createForIssueComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              comment_id: context.payload.comment.id,
              content: 'eyes',
            });

      # Add other steps necessary for IssueOps...
```

Please note that this action does not provide a reaction feature. However, by leveraging GitHub Action's awesome ecosystem, you can implement highly flexible IssueOps commands.

## :paw_prints: Development

Introducing the steps for developing `command-action`.

### Setup

Using [mise](https://mise.jdx.dev/), activate the versions of Node.js and pnpm written in `.mise.toml`.

```bash
$ mise install
$ pnpm i
```

### E2E (self-dogfood)

The action is validated against real GitHub event payloads via an environment-gated workflow. See [`docs/e2e.md`](./docs/e2e.md) for the comment convention, security model, and required repo settings.

## LICENSE

See [LICENSE][license].

Copyright 2024 Knowledge Work Inc.

[badge-build]: https://img.shields.io/github/actions/workflow/status/knowledge-work/command-action/ci.yaml?style=flat-square
[badge-license]: https://img.shields.io/github/license/knowledge-work/command-action?style=flat-square
[badge-semantic-release]: https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release&style=flat-square
[build]: https://github.com/knowledge-work/command-action/actions/workflows/ci.yaml
[license]: ./LICENSE
[semantic-release]: https://github.com/semantic-release/semantic-release
