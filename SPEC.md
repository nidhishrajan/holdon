# HoldOn — SPEC

90-minute hackathon prototype. Judging: customer understanding, impact + measurement, readiness, creativity.

## Problem / customer
Elderly Americans lose pensions to tech-support scams: fake virus popup → "call Microsoft" → scammer has victim install AnyDesk → drains savings. Scammers isolate victims and watch their screen, so the victim (Margaret) can't ask for help. The adult child (Sarah) never knows until money is gone.

## Product
HoldOn detects the danger moment in the browser and **silently** alerts Sarah on Telegram while showing Margaret a full-screen STOP warning.

## Architecture
1. **Sensor** — Chrome extension (Manifest V3), `./extension`. Detects fake virus popups / remote-access sites / uninstall (tamper); POSTs to the server; shows STOP overlay.
2. **Brain** — Next.js backend, `./server`, `http://localhost:3000`. Writes the alert (RouterPlus LLM, with plain fallback), sends Telegram.
3. **Family link** — Telegram bot. Alert has inline buttons (callback_data, not URLs): "✅ It was a scam — I stopped it" / "❌ False alarm".
4. **Proof** — in-memory alert log + stats on `globalThis` (no DB).

## Folder structure
```
SPEC.md
.gitignore
extension/            # Phase 2
server/
  .env.example        # TM_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
  instrumentation.ts  # starts single Telegram poller
  app/api/alert/route.ts
  app/api/tamper/route.ts
  app/api/stats/route.ts
  lib/{store,ai,telegram,alert,poller,cors}.ts
```

## API contracts
### POST /api/alert
Body: `{event_type, url, page_title, recent_tabs[], parent_name, child_name}`
`event_type ∈ fake_virus_popup | remote_access_site | tamper | setup_test`
- `setup_test`: sends "✅ HoldOn is now protecting <parent_name>." No AI, no buttons.
- `tamper`: fixed text, no AI.
- Others: RouterPlus `POST https://api.routerplus.com/v1/chat/completions`, model `claude-haiku-5-5`, `max_tokens 300`, 5s timeout, key `TM_API_KEY`. On any AI failure → plain fallback text. **AI never blocks alerts.**
- Response: `{risk: low|medium|high, summary, telegram_sent}`. 400 on bad event_type. CORS open.

### GET /api/tamper?parent=&child=
Same as alert with `tamper`; returns simple HTML page (hit by extension uninstall URL).

### GET /api/stats
`{alerts, scams_stopped, false_alarms, recent[], telegram_configured}` (setup_test excluded).
Impact metric: precision = scams_stopped / (scams_stopped + false_alarms); time-to-feedback.

### POST /api/stats/reset
Demo helper: clears the in-memory log. Returns `{ok:true}`.

### Telegram callbacks
Single `getUpdates` long-poll loop per process (`instrumentation.ts` + globalThis guard). callback_data `scam:<id>` / `false:<id>` → answerCallbackQuery, record result, edit message appending "✅ Logged: scam stopped" / "❌ Logged: false alarm".

## Env (user fills `server/.env`; never committed)
`TM_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`

## Phases
1. **Server** (done now): endpoints, Telegram send + callbacks, store, stats.
2. **Extension**: MV3 content/background scripts, detection heuristics (fake-virus popup text, AnyDesk/TeamViewer/etc. domains), STOP overlay, setup flow with `setup_test`, uninstall URL → `/api/tamper`.
3. **Demo & proof**: stats dashboard page, scripted scam demo, metrics slide, polish.
