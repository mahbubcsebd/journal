# Connect MetaTrader 5 to Journal

The **JournalSync** Expert Advisor runs inside MetaTrader 5 on your computer and sends every deal,
your balance and open positions to Journal. It only reads your account — it never places or changes
a trade. Follow the steps in order; every menu name is written exactly as it appears in MT5.

> The same guide is in the app at **`/guide/mt5`** (public — share the link with new users).

`<APP_URL>` below is your Journal address, e.g. `https://journal-xxxx.vercel.app`
(with `https://`, no `/` at the end).

## At a glance: what goes where

| What | Where in MetaTrader 5 |
|---|---|
| `JournalSync.mq5` | **File → Open Data Folder → MQL5 → Experts** |
| Your Journal address | **Tools → Options → Expert Advisors → Allow WebRequest for listed URL** |
| Your sync key | JournalSync on a chart → **Inputs → Sync key** |

---

## 1. Log in to your trading account (~1 min)

1. In MetaTrader 5: **File → Login to Trade Account**.
2. Enter **Login** (account number), **Password** (the *trading* password, not your Exness website
   password) and **Server** (e.g. `Exness-MT5Real8`). Tick **Save password** → **OK**.
3. Make sure you are really logged in:
   - The bottom-right corner shows a ping such as `45.2 ms` — not a red icon or `Invalid account`.
   - The **Toolbox** panel (`Ctrl + T` if hidden) has **Trade** and **History** tabs.

> ⚠️ No **History** tab means MT5 isn't logged in and the EA has nothing to send. The server name and
> a trading-password reset are in Exness Personal Area → **My accounts → ⋮ → Account information**.

## 2. Get your sync key and the EA file (~1 min)

1. In Journal: **Accounts → Connect auto-sync → MT5 EA**.
2. **Generate key** and copy it (starts with `jrn_`). Keep it safe — it is shown only once.
3. **Download JournalSync.mq5** — it is saved in `Downloads` with your Journal address filled in.

One key works for all your MT5 accounts. Don't share it.

## 3. Put the file in the Experts folder (~1 min)

1. In MT5: **File → Open Data Folder**.
2. Open **MQL5 → Experts**.
3. Copy `JournalSync.mq5` from `Downloads` and paste it here (replace the old one if asked).

## 4. Compile the EA (~1 min)

1. In MT5 click **IDE** in the toolbar (or `F4`) — **MetaEditor** opens.
2. In MetaEditor's Navigator double-click **MQL5 → Experts → JournalSync.mq5**.
3. **Compile** (or `F7`). The **Errors** tab must say `0 errors`. Close MetaEditor.

> ⚠️ Don't press **Start** / `F5` in MetaEditor — it runs a separate "JournalSync (debugging)" copy.
> Stop it with `Shift + F5`.

## 5. Allow MT5 to reach Journal (~1 min)

1. **Tools → Options → Expert Advisors** tab.
2. Tick **Allow WebRequest for listed URL**.
3. Double-click **add new URL** and type `<APP_URL>` — exactly the address you use in the browser.
4. **OK**.

## 6. Attach the EA and paste your key (~2 min)

1. Open any chart, e.g. **File → New Chart → EURUSD**.
2. Open the **Navigator** (**View → Navigator** or `Ctrl + N`) → **Expert Advisors → JournalSync**.
   Not listed? Right-click **Expert Advisors → Refresh**.
3. Drag **JournalSync** onto the chart (or right-click → **Attach to a chart**).
4. **Inputs** tab:
   - **Journal URL** — already filled in; leave it.
   - **Sync key** — double-click **Value**, paste the key, press `Enter`.
   - **History sent on first run (days)** — default 90; use 365 or more for older trades.
   - **Discipline guard** — `true` (default): warns you inside MT5 when a new trade breaks your rules.
   - **Guard may close rule-breaking trades** — `false` (default). See *Discipline guard* below.
   - **Send candles around closed trades** — `true` (default): powers the replay chart on each trade.
5. **OK**.

The EA never opens trades. With auto-close off it never changes them either, so it works whether
**Algo Trading** is on or off.

## 7. Check that it syncs (~1 min)

1. Within 10–20 seconds the chart's top-left corner shows:
   `Journal sync: synced 13:05 · 42 deals sent since start (42 new) · history from 2026.08.17`
2. In Journal, refresh **Accounts** — the account is **Connected** with its balance and **Synced just now**.
3. Trades appear in **Trades** and **Calendar** (account filter at the top: **All accounts** or this account).

✅ Done. While MT5 is open, new trades arrive within seconds. If the computer was off, MT5 sends
everything it missed when it starts again. Accounts the EA adds get a name like `Real ··5770` —
click **Name it** on the card to rename.

---

## Discipline guard (EA v1.05+)

The EA downloads your rules from Journal every minute and checks every trade you open:

| Rule | Comes from |
|---|---|
| High-impact news window for the symbol's currencies (gold, oil and US indices count as USD) | Settings → Economic news (minutes before/after) |
| Cooldown after a losing trade | Settings → Trading discipline |
| A limit goal already reached (daily/weekly max loss, max trades) | Goals |
| No stop loss one minute after opening | always |

When a trade breaks a rule you get:
- an MT5 pop-up with a sound,
- an MT5 phone notification — set it up once: **Tools → Options → Notifications**, tick **Enable Push
  Notifications** and enter the **MetaQuotes ID** from the MT5 app on your phone (Settings → Messages),
- a Journal alert on your phone or Telegram (Journal → Settings → Alerts & app).

The chart's corner also says **Guard: OK to trade** or **Guard: DON'T trade … now** for that chart's symbol.

**Auto-close (strict mode)** closes a rule-breaking trade right away. It needs all three:
1. EA input **Guard may close rule-breaking trades** = `true`,
2. Journal → Settings → Alerts & app → **Auto-close rule-breaking trades** on,
3. **Algo Trading** on in MT5's toolbar.

A closed trade can still lose the spread and slippage. Start with alerts only.

## Update from an older EA version

1. Journal → **Accounts → Connect auto-sync → Download EA** and replace `MQL5\Experts\JournalSync.mq5`.
2. In MetaEditor open it and press **F7** (compile).
3. On the chart: right-click → **Expert Advisors → Remove**, then attach it again (step 6). Your key
   stays the same and nothing is sent twice.

## Sync another account

- Log in to it with **File → Login to Trade Account**. The same EA and key send its trades; Journal
  adds the account automatically.
- MT5 is logged in to one account at a time. To sync two accounts live, install MT5 again into another
  folder (installer → **Settings**, e.g. `C:\MT5-Account2`) and repeat steps 1 and 3–6 with the same key.

## Send older history again

1. **Tools → Global Variables** (`F3`) → select `JournalSync_<account number>` → **Delete**.
2. Right-click the chart → **Expert Advisors → Properties** (or click the chart and press `F7`) →
   **Inputs** → **History sent on first run (days)** = `365` → **OK**.

Trades are never saved twice, so re-sending is safe.

## Troubleshooting

Read the chart's top-left text and the `JournalSync` lines in **Toolbox → Experts**.

| Message on the chart | What to do |
|---|---|
| `set your Journal URL and sync key` | Step 6: paste the key into **Inputs → Sync key**. |
| `add https://… in Tools > Options > Expert Advisors` | Step 5: add the address exactly as shown. |
| `can't reach … (code 1001)` | Turn off antivirus HTTPS/web scanning and any VPN, then retry. If that fixes it, exclude MT5 (`terminal64.exe`) in the antivirus. Check the address starts with `https://`. |
| `MT5 is not logged in to account …` | Step 1: log in with the trading password until the **History** tab appears. |
| `server replied 401` | Key wrong or revoked: generate a new one (step 2) and paste it. |
| `server replied 400 …` | Download the latest `JournalSync.mq5` and repeat steps 3, 4 and 6. |
| `synced …` but no trades in Journal | Check the **History** tab has trades; for older ones see *Send older history again*; set the account filter to **All accounts**. |
| No text on the chart | The EA isn't attached — repeat step 6 (its icon shows top-right on the chart when running). |
