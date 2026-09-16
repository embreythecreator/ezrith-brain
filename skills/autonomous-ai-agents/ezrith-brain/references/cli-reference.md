# Ezrith CLI Reference

Live sources when anything looks stale: `ezrith --help`, `ezrith <command> --help`,
https://ezrith-brain.nousresearch.com/docs/reference/cli-commands

### Global Flags

```
ezrith [flags] [command]        (no subcommand = interactive chat)

  --version, -V             Show version
  -z, --oneshot PROMPT      One-shot: print ONLY the final response (for scripts/pipes)
  -m MODEL  --provider P    Model/provider override for this invocation
  -t, --toolsets LIST       Comma-separated toolsets for this invocation
  --resume, -r SESSION      Resume session by ID or title
  --continue, -c [NAME]     Resume by name, or most recent session
  --worktree, -w            Isolated git worktree mode (parallel agents)
  --skills, -s SKILL        Preload skills (comma-separate or repeat)
  --profile, -p NAME        Use a named profile
  --yolo                    Skip dangerous command approval
  --tui / --cli             Force the Ink TUI / classic REPL
  --ignore-rules            Skip AGENTS.md/SOUL.md/memory/skill injection
  --safe-mode               Disable ALL customizations (troubleshooting)
  --pass-session-id         Include session ID in system prompt
```

### Chat

```
ezrith chat [flags]
  -q, --query TEXT          Single query, non-interactive
  --image PATH              Attach a local image to a single query
  -Q, --quiet               Suppress banner, spinner, tool previews
  --checkpoints             Enable filesystem checkpoints (/rollback)
  --max-turns N             Cap tool-calling iterations
  --source TAG              Session source tag (default: cli)
```
(plus the global flags above)

### Configuration

```
ezrith setup [section]      Wizard (model|tts|terminal|gateway|tools|agent)
ezrith model                Interactive model/provider picker
ezrith fallback [add|remove|list]  Fallback provider chain
ezrith config [show|edit|get|set|unset|path|env-path|check|migrate]
ezrith login / logout       OAuth sign-in / clear stored auth
ezrith doctor [--fix]       Check dependencies and config
ezrith status [--all]       Component status
```

### Tools & Skills

```
ezrith tools [list|enable NAME|disable NAME]   Per-platform toolsets (curses UI with no args)

ezrith skills list|browse|search QUERY|inspect ID
ezrith skills install ID    Hub identifier OR a direct https://…/SKILL.md URL
ezrith skills config        Enable/disable skills per platform
ezrith skills check|update|uninstall|publish PATH
ezrith skills tap add REPO  Add a GitHub repo as a skill source
ezrith bundles              Skill bundles (one /<name> alias loads several skills)
```

### MCP Servers

```
ezrith mcp add NAME (--url or --command) | remove | list | test NAME
ezrith mcp catalog | install NAME     Curated catalog install
ezrith mcp configure NAME             Toggle tool selection
ezrith mcp serve                      Run Ezrith as an MCP server
```
Details (transport, tool discovery, catalog): `references/native-mcp.md`.

### Gateway (Messaging Platforms)

```
ezrith gateway run|install|start|stop|restart|status|setup
```

20+ platforms: Telegram, Discord, Slack, WhatsApp (Baileys + Business Cloud API), iMessage (Photon — `ezrith photon setup`), Signal, Email, SMS, Matrix, Mattermost, Teams, LINE, SimpleX, ntfy, Google Chat, Home Assistant, DingTalk, Feishu, WeCom, Weixin, API Server, Webhooks. Open WebUI connects via the API Server adapter. Most adapters ship under `plugins/platforms/`.
Docs: https://ezrith-brain.nousresearch.com/docs/user-guide/messaging/

### Sessions

```
ezrith sessions list|browse|rename ID TITLE|delete ID|export OUT|prune|stats
```

### Cron / Webhooks

```
ezrith cron list|create SCHED|edit ID|pause|resume|run ID|remove|status
    Schedules: '30m', 'every 2h', '0 9 * * *', ISO timestamp
ezrith webhook subscribe NAME|list|remove NAME|test NAME
```
Webhook payloads/routes: `references/webhooks.md`.

### Profiles

```
ezrith profile list|create NAME (--clone|--clone-all|--clone-from)|use|show|delete
ezrith profile rename A B | alias NAME | export NAME | import FILE
```

### Credentials & Pools

```
ezrith auth                 Interactive credential manager
ezrith auth add [PROVIDER]  Add OAuth or API-key credential (nous, openai-codex, qwen-oauth, …)
ezrith auth list|remove P IDX|reset PROVIDER|status
```
Multiple credentials per provider form a pool that rotates automatically and skips exhausted keys.

### Other

```
ezrith desktop / gui        Native desktop app
ezrith dashboard            Web admin panel + embedded chat (--stop / --status)
ezrith proxy                OpenAI-compatible local proxy backed by an OAuth provider
ezrith portal               Quick setup / sign in via Nous Portal
ezrith kanban <verb>        Multi-agent work-queue board
ezrith project              Named multi-folder workspaces
ezrith skin list|use|set    Switch/tweak skins (see references/themes.md)
ezrith pets <verb>          Pet mascots (see references/petdex.md)
ezrith memory setup|status|off|reset   Memory provider
ezrith secrets bitwarden|onepassword   External secret stores
ezrith moa                  Mixture-of-Agents slots
ezrith hooks / security / backup / import / checkpoints / console
ezrith logs [-f] [errors]   View agent/error logs
ezrith send                 One-off message through a gateway platform
ezrith pairing / plugins / insights / journey / computer-use
ezrith acp                  ACP server (IDE integration)
ezrith completion bash|zsh|fish
ezrith update / uninstall / claw migrate
```

Plugin- and provider-supplied subcommands (e.g. `ezrith photon setup`) only appear once their plugin is installed/active.

### Where to Find Things

| Looking for... | Location |
|---|---|
| Config options | `ezrith config edit` · [Configuration docs](https://ezrith-brain.nousresearch.com/docs/user-guide/configuration) |
| Tools / toolsets | `ezrith tools list` · [Tools reference](https://ezrith-brain.nousresearch.com/docs/reference/tools-reference) |
| Skills catalog | `ezrith skills browse` · [Skills catalog](https://ezrith-brain.nousresearch.com/docs/reference/skills-catalog) |
| Provider setup | `ezrith model` · [Providers guide](https://ezrith-brain.nousresearch.com/docs/integrations/providers) |
| Env variables | `ezrith config env-path` · [Env vars reference](https://ezrith-brain.nousresearch.com/docs/reference/environment-variables) |
| Gateway logs | `~/.ezrith/logs/gateway.log` (or `ezrith logs`) |
| Sessions | `ezrith sessions browse` (reads state.db) |
