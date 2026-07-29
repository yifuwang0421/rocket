# Rocket CLI

`rocket` is the terminal client for the Rocket server. The legacy executable
name `rocket-cli` is retained as an alias, but examples and generated guidance
use `rocket`.

The P0 CLI does **not** manage labels, sources, skills, automations,
permissions, or themes. Use Rocket's in-app configuration flows and the
session tools documented in the corresponding guides.

## Usage

```text
rocket [options] <command> [args...]
```

## Connection Options

| Option | Description |
|---|---|
| `--url <ws[s]://...>` | Server URL; defaults to `ROCKET_SERVER_URL` |
| `--token <secret>` | Server token; defaults to `ROCKET_SERVER_TOKEN` |
| `--workspace <id>` | Workspace ID |
| `--timeout <ms>` | Request timeout |
| `--tls-ca <path>` | Custom CA certificate |
| `--json` | Emit raw JSON for scripts |

## Commands

| Command | Description |
|---|---|
| `run <message>` | Spawn a local server, send one message, stream the response, and exit |
| `ping` | Verify server connectivity |
| `health` | Check credential-store health |
| `versions` | Show server runtime versions |
| `workspaces` | List workspaces |
| `sessions` | List sessions |
| `connections` | List LLM connections |
| `sources` | List configured sources |
| `session create` | Create a session |
| `session messages <id>` | Print session message history |
| `session delete <id>` | Delete a session |
| `send <id> <message>` | Send a message and stream the response |
| `cancel <id>` | Cancel active processing |
| `invoke <channel> [...]` | Invoke a raw RPC channel |
| `listen <channel>` | Subscribe to push events |
| `--validate-server` | Run the server integration validation sequence |

## Run Command Options

```text
--workspace-dir <path>
--source <slug>
--mode <mode>
--output-format text|stream-json
--no-cleanup
--server-entry <path>
--provider <name>
--model <id>
--api-key <key>
--base-url <url>
```

## Examples

```bash
rocket ping
rocket workspaces
rocket sessions
rocket run "Summarize this repository"
rocket run --provider openai --model gpt-4o "Review the current changes"
rocket send <session-id> "Continue the analysis"
rocket invoke system:homeDir
rocket --json workspaces
rocket --validate-server
```

## Configuration Domains

For configuration changes, use these guides:

- [Labels](./labels.md)
- [Sources](./sources.md)
- [Skills](./skills.md)
- [Automations](./automations.md)
- [Permissions](./permissions.md)
- [Themes](./themes.md)

Do not invent `rocket label`, `rocket source`, `rocket skill`,
`rocket automation`, `rocket permission`, or `rocket theme` commands; those
subcommands are not part of the P0 executable.
