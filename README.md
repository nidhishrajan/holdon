# HoldOn

**She can't call for help. HoldOn does.**

HoldOn protects elderly people from tech-support scams. Scammers show a fake virus warning, get the victim on the phone, make them install a remote-access tool like AnyDesk, and then tell them: *"Don't tell your family."* Once the scammer is watching the screen, the victim can't ask for help.

HoldOn is a Chrome extension that spots that moment and:

1. **Stops the parent** with a full-screen warning they can't miss.
2. **Silently alerts their adult child on Telegram** with an AI-written summary of what's happening, on a channel the scammer can't see.
3. **Alerts the family if HoldOn is uninstalled** (scammers often ask victims to remove protection).
4. **Measures impact**: every alert has "✅ It was a scam — I stopped it" / "❌ False alarm" buttons, shown live on a dashboard.

Built in one afternoon at Vibe Sprint Hyderabad (The Product Folks × Scaler).

---

## How it works

```
Chrome extension (sensor)  ──►  Next.js server (brain)  ──►  Telegram (family link)
 - remote-access sites           - AI writes the alert         - alert + ✅/❌ buttons
 - fake virus popup pages          (Claude via RouterPlus)     - button taps logged
 - uninstall = tamper alert      - in-memory alert log      ──►  /dashboard (proof)
 - full-screen STOP overlay
```

| Part | Folder | What it does |
|---|---|---|
| Extension | `extension/` | Manifest V3. Watches tab URLs for remote-access tools (AnyDesk, TeamViewer, UltraViewer, RustDesk, ScreenConnect, …), scans pages for fake virus popups (2+ scam phrases + a toll-free number), shows the overlay, sends alerts. Debounced to 1 alert per site per 10 minutes. |
| Server | `server/` | Next.js. `POST /api/alert` writes the alert with AI (falls back to plain text if AI is unavailable) and sends it to Telegram. Polls Telegram for button taps. |
| Deck | `pitch/deck.html` | The pitch deck, also served at `http://localhost:3000/deck.html`. |
| Spec | `SPEC.md` | Architecture, API contracts, build phases. |

---

## Run it yourself

**You need:** Node.js 18.18+ (tested on 22), Google Chrome, and about 5 minutes.

### Option A — Quick try, no keys needed (5 min)

You'll see the STOP overlays and the alerts on the dashboard. Telegram and AI are skipped (alerts use a plain-text fallback).

```bash
git clone https://github.com/nidhishrajan/holdon.git
cd holdon/server
npm install
cp .env.example .env      # leave the values empty for the quick try
npm run dev               # keep this running → http://localhost:3000
```

Then load the extension:

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the `holdon/extension` folder.
4. Pin HoldOn (puzzle-piece icon → pin). You should see a green **ON** badge.

The popup will say "Server up, Telegram not set up ⚠️" — that's expected in this mode. Jump to [Try the demo](#try-the-demo).

### Option B — Full experience with Telegram alerts + AI (10 min)

Do Option A, then fill in `server/.env`:

```env
TM_API_KEY=            # RouterPlus API key (OpenAI-compatible gateway) — optional, enables AI-written alerts
TELEGRAM_BOT_TOKEN=    # from @BotFather
TELEGRAM_CHAT_ID=      # your chat ID (see below)
```

**Create the Telegram bot:**

1. In Telegram, message **@BotFather** → `/newbot` → follow the prompts → copy the **token**.
2. Open your new bot and tap **Start** (the bot can't message you until you do).
3. Get your chat ID: open `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser and find `"chat":{"id":123456789`. If the result is empty, message the bot again and refresh. (Stop the HoldOn server first — it reads the same updates.) Alternatively, message **@userinfobot**.
4. Put both values in `server/.env`, then **restart** the server (`Ctrl+C`, `npm run dev`) — Next.js only reads `.env` at startup.

Click the HoldOn icon → it should say **"Connected to Telegram ✅"** → click **Send test alert**. Your phone should get *"✅ HoldOn is now protecting Margaret."*

> Never commit `server/.env` — it's already in `.gitignore`.

---

## Try the demo

With the server running and the extension loaded:

| Step | Do this | You should see |
|---|---|---|
| 1 | Click the HoldOn icon → **Send test alert** | Telegram: "HoldOn is now protecting Margaret" |
| 2 | Open `http://localhost:3000/fake-popup.html` (a fake "Windows Defender" scam page, for demo only) | Red overlay: **"This warning is FAKE"** + an alert |
| 3 | Open `https://anydesk.com` | Red overlay: **"STOP. Microsoft, Apple and your bank will NEVER ask you to install this."** + an AI-written alert using the context from step 2 |
| 4 | Tap **✅ It was a scam — I stopped it** in Telegram | Message updates to "✅ Logged: scam stopped" |
| 5 | Open `http://localhost:3000/dashboard` | Alerts, scams stopped, false alarms, precision |
| 6 | Remove HoldOn at `chrome://extensions` | Tamper alert: "HoldOn was removed from Margaret's laptop" |

**Tips**
- Names (Margaret / Sarah) can be changed in the HoldOn popup.
- Each site alerts once per 10 minutes. To reset, remove and re-load the extension.
- The dashboard counts reset when the server restarts (in-memory store).
- Don't actually download or run AnyDesk — visiting the site is enough.

---

## API

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/alert` | `{event_type, url, page_title, recent_tabs[], parent_name, child_name}` where `event_type` ∈ `fake_virus_popup` · `remote_access_site` · `tamper` · `setup_test` |
| `GET` | `/api/tamper?parent=&child=` | Opened by Chrome when the extension is uninstalled |
| `GET` | `/api/stats` | `{alerts, scams_stopped, false_alarms, recent[], telegram_configured}` |
| `GET` | `/dashboard` | Family dashboard |

Test without the extension:

```bash
curl -X POST http://localhost:3000/api/alert -H 'Content-Type: application/json' \
  -d '{"event_type":"remote_access_site","url":"https://anydesk.com","page_title":"AnyDesk","recent_tabs":["Microsoft Security Alert - Call 1-800-555-0100","anydesk.com"],"parent_name":"Margaret","child_name":"Sarah"}'
```

---

## Privacy

- Detection runs inside the browser. Only the alert (event type, the triggering URL/title, and the last few tab titles for context) is sent to the server — never full browsing history.
- No accounts, no database: alerts live in memory on the server.

## Known limitations (hackathon prototype)

- The server runs locally (`localhost:3000`) and alerts go to one Telegram chat set in `.env`.
- Chrome only; it can't see native apps (e.g. AnyDesk already installed and running).
- Keyword-based fake-popup detection; AI is used for writing the family alert.

## Roadmap

- **Now:** Chrome extension · silent family alerts with AI context · tamper alarm · impact dashboard
- **Next:** hosted server + "Connect Telegram" onboarding per family · Chrome Web Store · Mac & Windows desktop app (detects remote-access tools running and screen sharing) · automatic phone call to family · Safari & Edge
- **Later:** bank & credit-union partnerships · phone scam-call detection · banking "cool-off" lock until family approves

## Credits

- Pitch clip: "Scam VICTIM Gets Her $30,000 BACK" — Trilogy Media (YouTube, embedded)
- Stats: FBI IC3 2025 Elder Fraud data; GASA Global State of Scams 2025
- Built with Claude Code, Next.js, the Telegram Bot API, and RouterPlus
