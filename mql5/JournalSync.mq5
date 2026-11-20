//+------------------------------------------------------------------+
//| JournalSync.mq5                                                  |
//| Sends this MT5 account's deals, balance and open positions to    |
//| your Journal app, and guards your trading rules: it warns when a |
//| new trade breaks them (news window, cooldown, limits, no SL).    |
//| It never opens trades. It closes one only if you allow it twice: |
//| the "auto-close" input here AND the switch in Journal settings.  |
//+------------------------------------------------------------------+
#property copyright   "Journal"
#property version     "1.05"
#include <Trade/Trade.mqh>
#property description "Auto-sync your Exness MT5 trades to Journal."
#property description "1) Tools → Options → Expert Advisors → tick 'Allow WebRequest for listed URL' and add your Journal URL."
#property description "2) Paste your sync key below. Attach to any one chart per account."

input string InpServerUrl        = "__JOURNAL_URL__"; // Journal URL
input string InpApiKey           = "";                // Sync key (Journal → Accounts → Connect)
input int    InpHistoryDays      = 90;                // History sent on first run (days)
input int    InpHeartbeatSeconds = 60;                // Balance & open positions every N seconds
input bool   InpGuard            = true;              // Discipline guard: alert when a trade breaks your rules
input bool   InpGuardAutoClose   = false;             // Guard may close rule-breaking trades (also needs Journal settings + Algo Trading)
input bool   InpSendCandles      = true;              // Send candles around closed trades (replay chart)

#define PAYLOAD_VERSION 1
#define CHUNK 100          // deals per request (keeps each request small and fast)
#define TIMEOUT_MS 60000   // WebRequest timeout
#define GAP_MS 1700        // pause between requests; the server allows one per 1.5 s

bool     g_pending      = true;   // new deals to send
datetime g_lastBeat     = 0;      // last successful request (local)
datetime g_lastAttempt  = 0;      // last request attempt (local), for back-off
datetime g_syncedUntil  = 0;      // newest deal time sent (server time)
int      g_failures     = 0;
string   g_status       = "starting";

bool     g_reachable    = false;  // connection test passed
int      g_totalSent    = 0;      // deals sent since the EA started

// ---- Discipline guard state (from /api/ea/guard) ----
struct NewsWindow { long start; long end; string currency; string title; };
NewsWindow g_news[];
string   g_blocked[];
long     g_cooldownUntil = 0;
string   g_cooldownWhy   = "";
bool     g_guardAlerts   = true;
bool     g_guardClose    = false;
int      g_noSlSeconds   = 60;
datetime g_lastGuard     = 0;
datetime g_lastCandles   = 0;
ulong    g_noSlWarned[];
CTrade   g_trade;

string GvName() { return "JournalSync_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)); }

string BaseUrl()
  {
   string u = InpServerUrl;
   StringTrimRight(u); StringTrimLeft(u);
   if(StringLen(u) > 0 && StringSubstr(u, StringLen(u) - 1) == "/") u = StringSubstr(u, 0, StringLen(u) - 1);
   return u;
  }

string Endpoint() { return BaseUrl() + "/api/sync/mt5"; }

string Violations(string symbol); // defined below

void ShowStatus()
  {
   string guard = "";
   if(InpGuard)
     {
      string why = Violations(Symbol());
      guard = (why == "") ? "\nGuard: OK to trade " + Symbol() : "\nGuard: DON'T trade " + Symbol() + " now: " + why;
     }
   Comment("Journal sync: ", g_status, guard);
  }

// Explain codes that aren't HTTP statuses. MT5 doesn't follow redirects and reports
// them, and failed TLS/connections, as codes such as 1001.
string Explain(int code)
  {
   if((code >= 300 && code < 400) || code >= 1000)
      return "can't reach " + BaseUrl() + " (code " + IntegerToString(code) + "). Check: the URL is https and exactly your app's domain; " +
             "it opens in a private browser window without a Vercel login; Windows is up to date (TLS 1.2); " +
             "no antivirus/VPN is intercepting HTTPS";
   return "";
  }

// Quick GET to the app before syncing, so a connection problem is reported clearly.
bool Ping()
  {
   char none[], result[];
   string responseHeaders;
   ResetLastError();
   int code = WebRequest("GET", BaseUrl() + "/api/health/db", "", TIMEOUT_MS, none, result, responseHeaders);
   if(code == 200)
     {
      Print("JournalSync: connected to ", BaseUrl());
      return true;
     }
   int err = GetLastError();
   if(code == -1)
      g_status = (err == 4014) ? "add " + BaseUrl() + " in Tools > Options > Expert Advisors > Allow WebRequest"
                               : "network error " + IntegerToString(err) + " reaching " + BaseUrl();
   else
     {
      string why = Explain(code);
      g_status = (why != "") ? why : "connection test got HTTP " + IntegerToString(code);
     }
   Print("JournalSync: ", g_status, " | GetLastError=", err, " | headers: ", responseHeaders);
   return false;
  }

string Esc(string s)
  {
   StringReplace(s, "\\", "\\\\");
   StringReplace(s, "\"", "\\\"");
   StringReplace(s, "\n", " ");
   StringReplace(s, "\r", " ");
   StringReplace(s, "\t", " ");
   return s;
  }

string Num(double v, int digits = 8) { return DoubleToString(v, digits); }

// Broker server time → UTC (offset rounded to 15 minutes).
long ServerOffset()
  {
   long diff = (long)(TimeTradeServer() - TimeGMT());
   return (long)MathRound(diff / 900.0) * 900;
  }
long ToUtc(datetime serverTime) { return (long)serverTime - ServerOffset(); }

string AccountJson()
  {
   return StringFormat("\"version\":%d,\"login\":\"%I64d\",\"server\":\"%s\",\"company\":\"%s\",\"currency\":\"%s\","
                       "\"balance\":%s,\"equity\":%s,\"leverage\":%I64d,\"trade_mode\":%I64d",
                       PAYLOAD_VERSION,
                       AccountInfoInteger(ACCOUNT_LOGIN),
                       Esc(AccountInfoString(ACCOUNT_SERVER)),
                       Esc(AccountInfoString(ACCOUNT_COMPANY)),
                       Esc(AccountInfoString(ACCOUNT_CURRENCY)),
                       Num(AccountInfoDouble(ACCOUNT_BALANCE), 2),
                       Num(AccountInfoDouble(ACCOUNT_EQUITY), 2),
                       AccountInfoInteger(ACCOUNT_LEVERAGE),
                       AccountInfoInteger(ACCOUNT_TRADE_MODE));
  }

string PositionsJson()
  {
   string out = "";
   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(out != "") out += ",";
      out += StringFormat("{\"ticket\":\"%I64u\",\"symbol\":\"%s\",\"type\":%I64d,\"volume\":%s,\"price_open\":%s,"
                          "\"price_current\":%s,\"sl\":%s,\"tp\":%s,\"profit\":%s,\"swap\":%s,\"time\":%I64d}",
                          ticket,
                          Esc(PositionGetString(POSITION_SYMBOL)),
                          PositionGetInteger(POSITION_TYPE),
                          Num(PositionGetDouble(POSITION_VOLUME), 2),
                          Num(PositionGetDouble(POSITION_PRICE_OPEN)),
                          Num(PositionGetDouble(POSITION_PRICE_CURRENT)),
                          Num(PositionGetDouble(POSITION_SL)),
                          Num(PositionGetDouble(POSITION_TP)),
                          Num(PositionGetDouble(POSITION_PROFIT), 2),
                          Num(PositionGetDouble(POSITION_SWAP), 2),
                          ToUtc((datetime)PositionGetInteger(POSITION_TIME)));
     }
   return "[" + out + "]";
  }

string DealJson(ulong ticket)
  {
   return StringFormat("{\"ticket\":\"%I64u\",\"order\":\"%I64d\",\"position\":\"%I64d\",\"symbol\":\"%s\",\"type\":%I64d,"
                       "\"entry\":%I64d,\"volume\":%s,\"price\":%s,\"sl\":%s,\"tp\":%s,\"commission\":%s,\"swap\":%s,"
                       "\"fee\":%s,\"profit\":%s,\"time\":%I64d,\"magic\":%I64d,\"comment\":\"%s\"}",
                       ticket,
                       HistoryDealGetInteger(ticket, DEAL_ORDER),
                       HistoryDealGetInteger(ticket, DEAL_POSITION_ID),
                       Esc(HistoryDealGetString(ticket, DEAL_SYMBOL)),
                       HistoryDealGetInteger(ticket, DEAL_TYPE),
                       HistoryDealGetInteger(ticket, DEAL_ENTRY),
                       Num(HistoryDealGetDouble(ticket, DEAL_VOLUME), 2),
                       Num(HistoryDealGetDouble(ticket, DEAL_PRICE)),
                       Num(HistoryDealGetDouble(ticket, DEAL_SL)),
                       Num(HistoryDealGetDouble(ticket, DEAL_TP)),
                       Num(HistoryDealGetDouble(ticket, DEAL_COMMISSION), 2),
                       Num(HistoryDealGetDouble(ticket, DEAL_SWAP), 2),
                       Num(HistoryDealGetDouble(ticket, DEAL_FEE), 2),
                       Num(HistoryDealGetDouble(ticket, DEAL_PROFIT), 2),
                       ToUtc((datetime)HistoryDealGetInteger(ticket, DEAL_TIME)),
                       HistoryDealGetInteger(ticket, DEAL_MAGIC),
                       Esc(HistoryDealGetString(ticket, DEAL_COMMENT)));
  }

// POST one payload. Returns true on HTTP 200.
bool Post(string dealsJson)
  {
   string body = "{" + AccountJson() + ",\"deals\":" + dealsJson + ",\"positions\":" + PositionsJson() + "}";
   char data[], result[];
   string responseHeaders;
   int len = StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(len > 0) ArrayResize(data, len - 1); // drop the trailing NUL
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + InpApiKey + "\r\n";
   g_lastAttempt = TimeLocal();
   ResetLastError();
   int code = WebRequest("POST", Endpoint(), headers, TIMEOUT_MS, data, result, responseHeaders);
   int err = GetLastError();
   if(code == 429)
     {
      Sleep(GAP_MS); // rate limited: wait once and retry
      ResetLastError();
      code = WebRequest("POST", Endpoint(), headers, TIMEOUT_MS, data, result, responseHeaders);
      err = GetLastError();
     }
   if(code == -1)
     {
      g_status = (err == 4014)
                 ? "add " + InpServerUrl + " in Tools > Options > Expert Advisors > Allow WebRequest"
                 : "network error " + IntegerToString(err);
      Print("JournalSync: ", g_status);
      return false;
     }
   string why = Explain(code);
   if(why != "")
     {
      g_status = why;
      Print("JournalSync: ", g_status, " | body bytes=", ArraySize(data), " | GetLastError=", err, " | headers: ", responseHeaders);
      return false;
     }
   if(code != 200)
     {
      g_status = "server replied " + IntegerToString(code) + ": " + CharArrayToString(result, 0, 300, CP_UTF8);
      Print("JournalSync: ", g_status);
      return false;
     }
   g_lastBeat = TimeLocal();
   return true;
  }

// True when MT5 is actually logged in to the trade account. A saved login whose
// password is wrong (or changed) still shows its number, but has no currency,
// no Trade/History tabs and no deal history.
bool LoggedIn()
  {
   return TerminalInfoInteger(TERMINAL_CONNECTED) && AccountInfoString(ACCOUNT_CURRENCY) != "" && AccountInfoInteger(ACCOUNT_LOGIN) > 0;
  }

// ---- Small HTTP helpers ----
string AuthHeader() { return "Authorization: Bearer " + InpApiKey + "\r\n"; }

int HttpGet(string path, string &out)
  {
   char none[], result[];
   string responseHeaders;
   ResetLastError();
   int code = WebRequest("GET", BaseUrl() + path, AuthHeader(), TIMEOUT_MS, none, result, responseHeaders);
   out = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   return code;
  }

int HttpPostJson(string path, string body)
  {
   char data[], result[];
   string responseHeaders;
   int len = StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(len > 0) ArrayResize(data, len - 1);
   ResetLastError();
   return WebRequest("POST", BaseUrl() + path, "Content-Type: application/json\r\n" + AuthHeader(), TIMEOUT_MS, data, result, responseHeaders);
  }

string LoginStr() { return IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)); }

// ---- Guard ----
void FetchGuard()
  {
   string text;
   int code = HttpGet("/api/ea/guard?login=" + LoginStr(), text);
   g_lastGuard = TimeLocal();
   if(code != 200) { Print("JournalSync guard: rules not loaded (HTTP ", code, ")"); return; }
   string lines[];
   int n = StringSplit(text, '\n', lines);
   ArrayResize(g_news, 0);
   ArrayResize(g_blocked, 0);
   g_cooldownUntil = 0;
   g_cooldownWhy = "";
   for(int i = 0; i < n; i++)
     {
      string line = lines[i];
      int eq = StringFind(line, "=");
      if(eq <= 0) continue;
      string k = StringSubstr(line, 0, eq);
      string v = StringSubstr(line, eq + 1);
      if(k == "alerts") g_guardAlerts = (v == "1");
      else if(k == "autoclose") g_guardClose = (v == "1");
      else if(k == "nosl") g_noSlSeconds = (int)StringToInteger(v);
      else if(k == "blocked") { int b = ArraySize(g_blocked); ArrayResize(g_blocked, b + 1); g_blocked[b] = v; }
      else if(k == "cooldown" || k == "news")
        {
         string p[];
         int c = StringSplit(v, '|', p);
         if(k == "cooldown" && c >= 1) { g_cooldownUntil = StringToInteger(p[0]); g_cooldownWhy = (c >= 2) ? p[1] : ""; }
         if(k == "news" && c >= 4)
           {
            int w = ArraySize(g_news);
            ArrayResize(g_news, w + 1);
            g_news[w].start = StringToInteger(p[0]);
            g_news[w].end = StringToInteger(p[1]);
            g_news[w].currency = p[2];
            g_news[w].title = p[3];
           }
        }
     }
  }

// Does news for this currency move the symbol? (EURUSD → EUR, USD; gold, oil, US indices → USD)
bool Moves(string symbol, string currency)
  {
   string s = symbol;
   StringToUpper(s);
   if(StringFind(s, currency) >= 0) return true;
   if(currency != "USD") return false;
   string usd[] = {"XAU", "XAG", "BTC", "ETH", "US30", "US100", "US500", "USTEC", "NAS", "SPX", "DJ", "USOIL", "XTI", "WTI", "UKOIL", "XBR"};
   for(int i = 0; i < ArraySize(usd); i++)
      if(StringFind(s, usd[i]) == 0) return true;
   return false;
  }

// Why a trade opened now on this symbol breaks the rules ("" = it doesn't).
string Violations(string symbol)
  {
   long now = (long)TimeGMT();
   string why = "";
   for(int i = 0; i < ArraySize(g_news); i++)
      if(now >= g_news[i].start && now <= g_news[i].end && Moves(symbol, g_news[i].currency))
        { why += "news window (" + g_news[i].currency + " " + g_news[i].title + "); "; break; }
   if(g_cooldownUntil > now)
      why += "cooldown after a loss, " + IntegerToString((int)((g_cooldownUntil - now) / 60) + 1) + " min left (" + g_cooldownWhy + "); ";
   for(int i = 0; i < ArraySize(g_blocked); i++) why += g_blocked[i] + "; ";
   return why;
  }

void Warn(string symbol, string kind, string message)
  {
   string msg = "Journal guard: " + message;
   Print(msg);
   if(g_guardAlerts)
     {
      Alert(msg);
      SendNotification(StringSubstr(msg, 0, 255)); // MT5 mobile push, if a MetaQuotes ID is set
     }
   // Also to the Journal app (phone push / Telegram).
   HttpPostJson("/api/ea/event", StringFormat("{\"login\":\"%s\",\"symbol\":\"%s\",\"kind\":\"%s\",\"message\":\"%s\"}",
                LoginStr(), Esc(symbol), kind, Esc(message)));
  }

// A position was just opened: check it against the rules.
void GuardNewPosition(ulong positionId, string symbol)
  {
   if(!InpGuard) return;
   if(TimeLocal() - g_lastGuard > 120) FetchGuard();
   string why = Violations(symbol);
   if(why == "") return;
   bool closeIt = InpGuardAutoClose && g_guardClose;
   Warn(symbol, "rule", symbol + " opened against your rules: " + why + (closeIt ? "closing it." : "think twice."));
   if(closeIt)
     {
      if(PositionSelectByTicket(positionId) && g_trade.PositionClose(positionId))
         Print("JournalSync guard: closed position ", positionId);
      else
         Print("JournalSync guard: could not close ", positionId, " (enable Algo Trading) ", g_trade.ResultRetcodeDescription());
     }
  }

// Positions still without a stop loss a minute after opening.
void GuardStops()
  {
   if(!InpGuard || g_noSlSeconds <= 0) return;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || PositionGetDouble(POSITION_SL) != 0) continue;
      if(TimeCurrent() - (datetime)PositionGetInteger(POSITION_TIME) < g_noSlSeconds) continue;
      bool warned = false;
      for(int j = 0; j < ArraySize(g_noSlWarned); j++) if(g_noSlWarned[j] == ticket) { warned = true; break; }
      if(warned) continue;
      int n = ArraySize(g_noSlWarned);
      ArrayResize(g_noSlWarned, n + 1);
      g_noSlWarned[n] = ticket;
      Warn(PositionGetString(POSITION_SYMBOL), "no_sl", PositionGetString(POSITION_SYMBOL) + " has no stop loss. Set one now.");
     }
  }

// ---- Candles for the replay chart (/api/ea/candles) ----
ENUM_TIMEFRAMES Tf(int minutes)
  {
   switch(minutes)
     {
      case 1: return PERIOD_M1;
      case 5: return PERIOD_M5;
      case 15: return PERIOD_M15;
      case 60: return PERIOD_H1;
      case 240: return PERIOD_H4;
     }
   return PERIOD_M5;
  }

void SendCandles()
  {
   g_lastCandles = TimeLocal();
   string text;
   if(HttpGet("/api/ea/candles?login=" + LoginStr(), text) != 200) return;
   string lines[];
   int n = StringSplit(text, '\n', lines);
   for(int i = 0; i < n; i++)
     {
      if(StringFind(lines[i], "need=") != 0) continue;
      string p[];
      if(StringSplit(StringSubstr(lines[i], 5), '|', p) < 5) continue;
      string symbol = p[1];
      long off = ServerOffset();
      datetime from = (datetime)(StringToInteger(p[2]) + off);
      datetime to = (datetime)(StringToInteger(p[3]) + off);
      int tf = (int)StringToInteger(p[4]);
      MqlRates rates[];
      int got = CopyRates(symbol, Tf(tf), from, to, rates);
      if(got <= 0) { Print("JournalSync: no candles for ", symbol, " yet (", GetLastError(), ")"); continue; }
      string arr = "";
      for(int r = 0; r < got; r++)
        {
         if(arr != "") arr += ",";
         arr += StringFormat("[%I64d,%s,%s,%s,%s]", ToUtc(rates[r].time), Num(rates[r].open), Num(rates[r].high), Num(rates[r].low), Num(rates[r].close));
        }
      HttpPostJson("/api/ea/candles", "{\"login\":\"" + LoginStr() + "\",\"position\":\"" + p[0] + "\",\"tf\":" + IntegerToString(tf) + ",\"rates\":[" + arr + "]}");
      Sleep(GAP_MS);
     }
  }

void SyncNow()
  {
   if(!LoggedIn())
     {
      g_status = "MT5 is not logged in to account " + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) +
                 ". File > Login to Trade Account: enter the trading password and server (see the Journal tab for the reason)";
      return;
     }
   if(!g_reachable)
     {
      g_lastAttempt = TimeLocal();
      if(!Ping()) { g_failures++; return; }
      g_reachable = true;
     }
   datetime from = (g_syncedUntil > 0) ? g_syncedUntil - 3600 : TimeCurrent() - (datetime)InpHistoryDays * 86400;
   if(!HistorySelect(from, TimeCurrent() + 86400))
     {
      g_status = "history not available yet";
      return;
     }
   int total = HistoryDealsTotal();
   string chunk = "";
   int inChunk = 0, sent = 0;
   datetime newest = g_syncedUntil;
   for(int i = 0; i < total; i++)
     {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket == 0) continue;
      if(chunk != "") chunk += ",";
      chunk += DealJson(ticket);
      inChunk++;
      datetime t = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
      if(t > newest) newest = t;
      if(inChunk >= CHUNK)
        {
         if(!Post("[" + chunk + "]")) { g_failures++; return; }
         sent += inChunk; chunk = ""; inChunk = 0;
         g_status = StringFormat("sending history… %d / %d deals", sent, total);
         ShowStatus();
         Sleep(GAP_MS);
        }
     }
   // Last (or only) chunk — also acts as the balance / positions heartbeat.
   if(!Post("[" + chunk + "]")) { g_failures++; return; }
   sent += inChunk;
   g_failures = 0;
   g_pending = false;
   g_syncedUntil = newest;
   GlobalVariableSet(GvName(), (double)g_syncedUntil);
   g_totalSent += sent;
   g_status = StringFormat("synced %s · %d deals sent since start (%d new) · history from %s",
                           TimeToString(TimeLocal(), TIME_MINUTES), g_totalSent, sent, TimeToString(from, TIME_DATE));
  }

int OnInit()
  {
   if(StringLen(InpApiKey) < 20 || StringFind(InpServerUrl, "http") != 0 || StringFind(InpServerUrl, "__JOURNAL_URL__") >= 0)
     {
      Alert("JournalSync: set your Journal URL and sync key in the EA inputs.");
      return(INIT_PARAMETERS_INCORRECT);
     }
   if(GlobalVariableCheck(GvName())) g_syncedUntil = (datetime)GlobalVariableGet(GvName());
   g_pending = true;
   if(InpGuard) FetchGuard();
   EventSetTimer(5);
   ShowStatus();
   return(INIT_SUCCEEDED);
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
   Comment("");
  }

void OnTradeTransaction(const MqlTradeTransaction &trans, const MqlTradeRequest &request, const MqlTradeResult &result)
  {
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD) return;
   g_pending = true;
   if(HistoryDealSelect(trans.deal) && HistoryDealGetInteger(trans.deal, DEAL_ENTRY) == DEAL_ENTRY_IN)
      GuardNewPosition((ulong)HistoryDealGetInteger(trans.deal, DEAL_POSITION_ID), HistoryDealGetString(trans.deal, DEAL_SYMBOL));
  }

void OnTimer()
  {
   // Back off after failures: retry every 5 s, then 30 s, then 2 min.
   int wait = (g_failures == 0) ? 0 : (g_failures < 3 ? 30 : 120);
   if(g_failures > 0 && TimeLocal() - g_lastAttempt < wait) { ShowStatus(); return; }
   if(g_pending || TimeLocal() - g_lastBeat >= InpHeartbeatSeconds) SyncNow();
   if(g_reachable && InpGuard && TimeLocal() - g_lastGuard >= 60) FetchGuard();
   GuardStops();
   if(g_reachable && InpSendCandles && TimeLocal() - g_lastCandles >= 300) SendCandles();
   ShowStatus();
  }

void OnTick() {}
//+------------------------------------------------------------------+
