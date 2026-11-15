//+------------------------------------------------------------------+
//| JournalSync.mq5                                                  |
//| Sends this MT5 account's deals, balance and open positions to    |
//| your Journal app. Read-only: it never places or changes trades.  |
//+------------------------------------------------------------------+
#property copyright   "Journal"
#property version     "1.03"
#property description "Auto-sync your Exness MT5 trades to Journal."
#property description "1) Tools → Options → Expert Advisors → tick 'Allow WebRequest for listed URL' and add your Journal URL."
#property description "2) Paste your sync key below. Attach to any one chart per account."

input string InpServerUrl        = "__JOURNAL_URL__"; // Journal URL
input string InpApiKey           = "";                // Sync key (Journal → Accounts → Connect)
input int    InpHistoryDays      = 90;                // History sent on first run (days)
input int    InpHeartbeatSeconds = 60;                // Balance & open positions every N seconds

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

string GvName() { return "JournalSync_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)); }

string BaseUrl()
  {
   string u = InpServerUrl;
   StringTrimRight(u); StringTrimLeft(u);
   if(StringLen(u) > 0 && StringSubstr(u, StringLen(u) - 1) == "/") u = StringSubstr(u, 0, StringLen(u) - 1);
   return u;
  }

string Endpoint() { return BaseUrl() + "/api/sync/mt5"; }

void ShowStatus() { Comment("Journal sync: ", g_status); }

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

void SyncNow()
  {
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
   if(trans.type == TRADE_TRANSACTION_DEAL_ADD) g_pending = true;
  }

void OnTimer()
  {
   // Back off after failures: retry every 5 s, then 30 s, then 2 min.
   int wait = (g_failures == 0) ? 0 : (g_failures < 3 ? 30 : 120);
   if(g_failures > 0 && TimeLocal() - g_lastAttempt < wait) { ShowStatus(); return; }
   if(g_pending || TimeLocal() - g_lastBeat >= InpHeartbeatSeconds) SyncNow();
   ShowStatus();
  }

void OnTick() {}
//+------------------------------------------------------------------+
