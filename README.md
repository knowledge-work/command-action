<div align="center">

# :wrench: IssueOps Command Action

<!-- gha-description-start -->

IssueOps commands in GitHub Actions.

<!-- gha-description-end -->

[![Build][badge-build]][build]
[![MIT LICENSE][badge-license]][license]
[![code style: prettier][badge-prettier]][prettier]
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
  uses: knowledge-work/command-action@v1
  with:
    command: 'preview'
```

This sets up your custom IssueOps command to interpret comments on Issues and Pull Requests.

Refer to [Inputs](#inbox_tray-inputs) for other options.

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
        uses: knowledge-work/command-action@v1
        with:
          command: 'greet'

      # Only run if `steps.<id>.outputs.continue` is "true".
      # This indicates that `knowledge-work` successfully parsed the command and the subsequent steps should continue.
      - name: Greet
        if: ${{ steps.command.outputs.continue == 'true' }}
        run: echo "Hi ${{ fromJSON(steps.command.outputs.params).name }} !"

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

| ID                 | Required           | Default              | Description                                                                                  |
| :----------------- | :----------------- | :------------------- | :------------------------------------------------------------------------------------------- |
| `command`          | :white_check_mark: | n/a                  | The name of the command to be used in IssueOps.                                              |
| `allowed_contexts` | :white_check_mark: | `issue,pull_request` | The comment contexts that trigger the IssueOps command, specified as a comma-separated list. |

<!-- gha-inputs-end -->

## :outbox_tray: Outputs

<!-- gha-outputs-start -->

| ID           | Description                                                                                                                                                                          |
| :----------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `continue`   | Indicates whether the IssueOps command was triggered and the workflow should continue with the string `"true"`. If the action did not complete successfully, `"false"` will be used. |
| `params`     | The parameters of the triggered IssueOps command, provided as a JSON string.                                                                                                         |
| `comment_id` | The ID of the comment that triggered this action.                                                                                                                                    |
| `actor`      | The GitHub handle of the actor who executed the IssueOps command.                                                                                                                    |

<!-- gha-outputs-end -->

## :bulb: TIPS

A section introducing tips for implementing IssueOps commands.

### Reacting to the comment

You can use [actions/github-script](https://github.com/actions/github-script) to add a reaction to the comment that triggered the IssueOps command.

```yaml
jobs:
  demo:
    runs-on: ubuntu-latest
    steps:
      - id: command
        uses: knowledge-work/command-action@v1
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

Using a Node.js Version Manager such as `asdf` or `nodenv`, activate the version of Node.js written in `.node-version`.

Next, activate `pnpm` using `corepack`, and install the dependent packages.

```bash
$ corepack enable pnpm
$ pnpm i
```

## LICENSE

[MIT © Knowledge Work Inc.][license]

[badge-build]: https://img.shields.io/github/actions/workflow/status/knowledge-work/command-action/ci.yaml?style=flat-square
[badge-license]: https://img.shields.io/github/license/knowledge-work/command-action?style=flat-square
[badge-prettier]: https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square
[badge-semantic-release]: https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release&style=flat-square
[build]: https://github.com/knowledge-work/command-action/actions/workflows/ci.yaml
[license]: ./LICENSE
[prettier]: https://github.com/prettier/prettier
[semantic-release]: https://github.com/semantic-release/semantic-release
