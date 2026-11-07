# dsh-pomodoro

A Pomodoro timer widget for the DeepSeek Harness Web UI. It renders a
25 / 5 / 15-minute pomodoro timer in the conversation composer dock —
the ambient area **below the message input** in any conversation.

Pure client-side: automatic phase cycling (focus → short break, long
break every 4th focus), a WebAudio chime at each phase boundary, and
`localStorage` persistence so the timer survives a page reload.
Ships `zh` / `en` locale.

## Install (as a local bundle)

From the harness profile, link and enable the bundle by its directory:

```bash
dsh plugin --profile web install "/path/to/dsh-pomodoro"
```

Or, via the agent's `plugin_manager` tool:

```json
plugin_manager install_bundle target=/path/to/dsh-pomodoro
```

Then reload the Web GUI (http://127.0.0.1:3080) and open a
conversation — the timer appears below the composer.

## Files

- `client.js` — React timer component + slot registration
  (`conversation.composer.dock`)
- `index.js` — host half (no-op; the client owns the timer)
- `cordis.patch.yml` — bundle patch declaration
- `locale/en.json`, `locale/zh.json` — metadata + dictionaries
- `icon.svg` — bundle icon
