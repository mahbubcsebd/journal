# Exness MT5 → Journal auto-sync: step by step guide

Ei guide follow korle Exness account e je kono jaygay (Exness website, Exness app ba MT5) theke
deya protiti order nijei Journal e save hobe. Order moto korun, kono step skip korben na.
Shomoy lage 15–20 minute.

> App er bhetore o ek-i guide ache, chhobi-r moto menu path soho: **`/guide/mt5`**
> (jemon `https://<tomar-app>.vercel.app/guide/mt5`). Login chara-o khole, tai notun user ke
> link ta pathiye din.

Niche `<APP_URL>` mane apnar Journal er address, jemon `https://journal-xxxx.vercel.app`
(https soho, shesh e `/` chara).

---

## 0. Ki ki lagbe

- Ekta **Windows PC ba laptop**. Phone er MT5 app e EA chole na. (Mac e MetaTrader 5 app thakle sheta-o cholbe.)
- Ekta **Exness MT5 account**: **login number**, **trading password**, **server** er naam.
- Internet ar apnar email.

Order kothay theke diyechen tate kichu jay ase na. Shob order ek-i Exness server e thake, MT5 shegula dekhte pay. MT5 shudhu data pathanor kaj kore.

## 1. Journal e account khulun (~2 min)

1. Browser e `<APP_URL>` kholun.
2. **Sign in** → email din → **Continue**.
3. Email e 6 digit er code ashbe (Spam folder o dekhun) → code boshan.
4. Prothombar hole naam, **Timezone** (Bangladesh: `Asia/Dhaka`) ar currency → **Continue**.

Protiti user nijer email diye login korbe. Apnar data shudhu apni dekhben.

## 2. Exness theke account er tottho nin (~2 min)

1. `my.exness.com` → **My accounts**.
2. Je account chan tar **account number** (jemon `412155770`), **MT5**, **Real/Demo** dekhun.
3. Card er **⋮** → **Account information** → **Server** likhe rakhun (jemon `Exness-MT5Real8`).
4. Trading password mone na thakle: **⋮** → **Change trading password**.

> ⚠️ **Trading password** ar Exness website er login password alada. Account **MT4** hole ei EA kaj korbe na, **MT5** lagbe.

## 3. PC te MT5 install korun (~3 min)

1. Personal Area e account card er **Trade** → **MetaTrader 5** → **Download** (Windows).
   Othoba exness.com er **Platforms → MetaTrader 5** page theke.
2. Setup file (jemon `exness5setup.exe`) double-click → **Next** → **Finish**.
3. Agei install thakle ei step bad.

## 4. MT5 e account e login korun (~1 min)

1. Menu: **File → Login to Trade Account**.
2. **Login** = account number, **Password** = trading password, **Server** = Step 2 er server, ✅ **Save password** → **OK**.
3. Check:
   - Window er nicher-dan kone ping dekhabe (jemon `45.2 ms`). Lal dot / `Invalid account` = password ba server vul.
   - Niche **Toolbox** (na dekhle `Ctrl + T`) e **Trade** ar **History** tab thakbe.

> ⚠️ **History** tab na thakle MT5 account e dhukte pareni, EA kono trade pathate parbe na.

## 5. Sync key ar EA file nin (~2 min)

1. Journal → **Accounts** → **Connect auto-sync** (account na thakle age **Add account**).
2. **MT5 EA** tab → **Generate key** → `jrn_…` diye shuru howa key **Copy** kore Notepad e rakhun.
3. **Download JournalSync.mq5** → file ta `Downloads` folder e jabe.

> ⚠️ Key ekbar-i dekhay. Kauke diben na. Ek-i key diye apnar shob Exness account sync hoy.

## 6. EA file ta Experts folder e rakhun (~1 min)

1. MT5 menu: **File → Open Data Folder**.
2. Oi folder e **MQL5 → Experts**.
3. `Downloads` theke `JournalSync.mq5` copy kore **Experts** e paste (purono thakle replace).

## 7. EA compile korun (~1 min)

1. MT5 toolbar e **IDE** (ba `F4`) → **MetaEditor** khulbe.
2. Bam pashe **MQL5 → Experts → JournalSync.mq5** double-click.
3. **Compile** (ba `F7`) → niche **Errors** tab e `0 errors` → MetaEditor bondho.

> ⚠️ MetaEditor e **Start/Debug** (`F5`) chapben na, tahole "JournalSync (debugging)" copy chole. Bondho: `Shift + F5`.

## 8. MT5 ke internet e pathanor onumoti din (~1 min)

1. **Tools → Options → Expert Advisors** tab.
2. ✅ **Allow WebRequest for listed URL**.
3. **add new URL** e double-click → `<APP_URL>` (https soho, shesh e `/` chara, browser e je address diye Journal khulen hubohu sheta).
4. **OK**.

## 9. EA chart e lagan (~2 min)

1. Ekta chart khola rakhun. Na thakle **File → New Chart → EURUSD**.
2. **Navigator** (na dekhle **View → Navigator** ba `Ctrl + N`) → **Expert Advisors → JournalSync**.
   Na dekhle **Expert Advisors** e right-click → **Refresh**.
3. **JournalSync** ke tene chart e chere din (ba right-click → **Attach to a chart**).
4. **Inputs** tab:
   - **Journal URL**: agei boshano, bodlaben na.
   - **Sync key**: **Value** e double-click → key paste → `Enter`.
   - **History sent on first run (days)**: default 90; purono shob chaile 365 ba 1000.
5. **OK**.

EA kono trade kore na, shudhu data pathay. **Algo Trading** button on/off jai thakuk, sync hobe.

## 10. Kaj korche kina dekhun (~1 min)

1. Chart er upore-bam kone 10–20 second e:
   `Journal sync: synced 13:05 · 42 deals sent since start (42 new) · history from 2026.08.17`
2. Journal → **Accounts** refresh → **Connected**, balance, **Synced just now**.
3. **Trades** / **Calendar** e trade dekhun. Upore account filter e **All accounts** ba oi account select kina dekhun.

✅ Hoye geche. Notun trade 5–10 second e chole ashbe.
MT5 theke nijei add howa account er naam `Real ··5770` er moto hoy; card e **✏️ Name it** chepe naam din.

## 11. Protidin er babohar

- PC te **MT5 khola** thakle trade real-time e ashe.
- PC bondho chilo? MT5 abar khullei miss kora shob trade chole ashe.
- Data dekhte MT5 lage na: phone ba je kono browser theke Journal khulun. Phone e browser menu → **Add to Home Screen**.
- Exness e trading password bodlale MT5 e abar **File → Login to Trade Account**.

## 12. Aro account / onno user

**Nijer arekta Exness account:** MT5 e **File → Login to Trade Account** diye oi account e login korun.
Ek-i EA, ek-i key; Journal e notun card nijei hobe. Duita account ek shathe real-time chaile MT5
abar install korun alada folder e (installer er **Settings** e folder, jemon `C:\MT5-Account2`),
oikhane Step 4–9 abar, ek-i key diye.

**Onno manush:** nijer email e Journal account, nijer PC te nijer MT5 e ei puro guide, ar **nijer key**.
Apnar key kauke diben na.

## 13. Purono history abar pathano

1. MT5: **Tools → Global Variables** (`F3`) → `JournalSync_<account number>` → **Delete**.
2. Chart e right-click → **Expert Advisors → Properties** (ba chart e click kore `F7`) → **Inputs** →
   **History sent on first run (days)** = `365` → **OK**.

Ek-i trade duibar save hoy na.

## 14. Shomossa hole

Chart er upore-bam kone er lekha ar MT5 **Toolbox → Experts** tab er `JournalSync` line gula dekhun.

| Chart e lekha | Ki korben |
|---|---|
| `set your Journal URL and sync key` | Step 9: Inputs e Sync key paste. |
| `add https://… in Tools > Options > Expert Advisors` | Step 8: URL hubohu WebRequest list e add. |
| `can't reach … (code 1001)` / `server replied 1001` | Antivirus er HTTPS/web scanning ar VPN off kore dekhun. Kaj korle antivirus e MT5 (`terminal64.exe`) ke exclude. URL https kina dekhun. |
| `MT5 is not logged in to account …` | Step 4: trading password diye abar login. Toolbox e History tab ashte hobe. |
| `server replied 401` | Key vul/revoke. Notun key (Step 5), Inputs e paste. |
| `server replied 400: Unexpected payload…` | Journal er notun version deploy hoyeche kina dekhun; notun JournalSync.mq5 download kore Step 6–9 abar. |
| `synced …` kintu trade ashe na | History tab e trade ache kina; purono hole Step 13; Journal er account filter **All accounts** kina. |
| Kono lekha-i nei | Chart er upore-dan kone EA er icon ache kina; na thakle Step 9 abar. |

Tobuo na hole chart er lekha ar **Experts** tab er screenshot admin ke pathan.
