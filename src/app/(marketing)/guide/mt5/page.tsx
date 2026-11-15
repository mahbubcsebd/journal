import type { Metadata } from "next";
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, Info, Lightbulb } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Connect MetaTrader 5",
  description: "Step by step: put the JournalSync EA in MetaTrader 5 and sync every Exness trade to Journal automatically.",
};

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app").replace(/\/$/, "");

/* ───────────────────────────── small building blocks ───────────────────────────── */

/** A menu path, e.g. File → Open Data Folder → MQL5 → Experts. */
function Path({ items }: { items: string[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 align-middle">
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />}
          <span className="rounded-md border bg-card px-1.5 py-0.5 font-mono text-[12.5px] font-medium whitespace-nowrap shadow-xs">{it}</span>
        </span>
      ))}
    </span>
  );
}

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[12px] font-medium">{children}</kbd>
);

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12.5px] break-all">{children}</code>
);

function Note({ kind = "info", children }: { kind?: "info" | "tip" | "warn" | "done"; children: React.ReactNode }) {
  const map = {
    info: { icon: Info, cls: "border-border bg-muted/50" },
    tip: { icon: Lightbulb, cls: "border-brand/30 bg-brand-soft/60" },
    warn: { icon: AlertTriangle, cls: "border-warning/40 bg-warning/10" },
    done: { icon: CheckCircle2, cls: "border-profit/30 bg-profit-soft/60" },
  }[kind];
  return (
    <div className={cn("flex gap-2.5 rounded-xl border px-3.5 py-3 text-sm leading-relaxed", map.cls)}>
      <map.icon className={cn("mt-0.5 size-4 shrink-0", kind === "warn" ? "text-warning-ink" : kind === "info" ? "text-muted-foreground" : "text-brand-ink")} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Step({ n, id, title, time, children }: { n: number; id: string; title: string; time?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="relative scroll-mt-24 border-l pb-12 pl-8 last:border-transparent last:pb-0 sm:pl-10">
      <span className="absolute -left-4 top-0 flex size-8 items-center justify-center rounded-full border bg-background font-mono text-sm font-semibold shadow-soft">
        {n}
      </span>
      <h2 className="flex flex-wrap items-baseline gap-x-3 pt-0.5 text-lg font-semibold tracking-tight sm:text-xl">
        {title}
        {time && <span className="text-xs font-normal text-muted-foreground">~{time}</span>}
      </h2>
      <div className="mt-4 grid gap-4 text-[15px] leading-relaxed text-foreground/90 [&_ol]:grid [&_ol]:list-decimal [&_ol]:gap-2.5 [&_ol]:pl-5 [&_ul]:grid [&_ul]:list-disc [&_ul]:gap-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

const STEPS = [
  { id: "login", title: "Log in to your trading account" },
  { id: "key", title: "Get your sync key and the EA file" },
  { id: "folder", title: "Put the file in the Experts folder" },
  { id: "compile", title: "Compile the EA" },
  { id: "webrequest", title: "Allow MT5 to reach Journal" },
  { id: "attach", title: "Attach the EA and paste your key" },
  { id: "check", title: "Check that it syncs" },
  { id: "more", title: "Sync another account" },
  { id: "history", title: "Send older history again" },
  { id: "trouble", title: "Troubleshooting" },
];

const AT_A_GLANCE: { what: string; where: React.ReactNode }[] = [
  { what: "JournalSync.mq5", where: <Path items={["File", "Open Data Folder", "MQL5", "Experts"]} /> },
  { what: "Your Journal address", where: <Path items={["Tools", "Options", "Expert Advisors", "Allow WebRequest"]} /> },
  { what: "Your sync key", where: <Path items={["JournalSync on a chart", "Inputs", "Sync key"]} /> },
];

/* ───────────────────────────────────── page ───────────────────────────────────── */

export default function Mt5GuidePage() {
  return (
    <div className="relative">
      <header className="sticky top-0 z-40 border-b bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" aria-label="Journal home">
            <Logo />
          </Link>
          <div className="flex-1" />
          <ThemeToggle />
          <Button asChild size="sm">
            <Link href="/accounts">Open Journal</Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:py-14">
        <aside className="hidden lg:block">
          <nav aria-label="Steps" className="sticky top-24 grid gap-0.5 text-sm">
            <p className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">On this page</p>
            {STEPS.map((s, i) => (
              <a key={s.id} href={`#${s.id}`} className="flex gap-2 rounded-md px-2 py-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground">
                <span className="w-4 shrink-0 text-right font-mono text-xs leading-5 tabular">{i < 7 ? i + 1 : "·"}</span>
                <span className="leading-5">{s.title}</span>
              </a>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 max-w-3xl">
          <Link href="/accounts" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Accounts
          </Link>
          <p className="text-sm font-medium text-brand-ink">Setup guide · about 10 minutes</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Connect MetaTrader 5 to Journal</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            The JournalSync Expert Advisor runs inside MetaTrader 5 on your computer and sends every deal, your balance and open positions to Journal.
            It only reads your account — it never places or changes a trade. Follow the steps in order; every menu name is written exactly as it
            appears in MT5.
          </p>

          <div className="mt-8 overflow-hidden rounded-xl border bg-card shadow-soft">
            <p className="border-b bg-muted/40 px-4 py-2.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">At a glance: what goes where</p>
            <dl className="divide-y">
              {AT_A_GLANCE.map((r) => (
                <div key={r.what} className="grid gap-1.5 px-4 py-3 sm:grid-cols-[180px_1fr] sm:items-center">
                  <dt className="font-mono text-[13px] font-medium">{r.what}</dt>
                  <dd>{r.where}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-6 grid gap-2 rounded-xl border bg-card p-4 text-sm shadow-soft lg:hidden">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">On this page</p>
            <ol className="grid gap-1 sm:grid-cols-2">
              {STEPS.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="flex gap-2 text-muted-foreground hover:text-foreground">
                    <span className="w-4 text-right font-mono text-xs leading-5 tabular">{i < 7 ? i + 1 : "·"}</span>
                    <span className="leading-5">{s.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-12">
            <Step n={1} id="login" title="Log in to your trading account" time="1 min">
              <ol>
                <li>
                  Open MetaTrader 5 on your computer and go to <Path items={["File", "Login to Trade Account"]} />.
                </li>
                <li>
                  Enter your <b>Login</b> (account number), <b>Password</b> (the <i>trading</i> password, not your Exness website password) and{" "}
                  <b>Server</b> (for example <Code>Exness-MT5Real8</Code>). Tick <b>Save password</b> and click <b>OK</b>.
                </li>
                <li>
                  Make sure you are really logged in:
                  <ul className="mt-1.5">
                    <li>
                      The bottom-right corner of MT5 shows a ping such as <Code>45.2 ms</Code>, not a red icon or <Code>Invalid account</Code>.
                    </li>
                    <li>
                      The <b>Toolbox</b> panel at the bottom (<Kbd>Ctrl</Kbd> + <Kbd>T</Kbd> if hidden) has <b>Trade</b> and <b>History</b> tabs.
                    </li>
                  </ul>
                </li>
              </ol>
              <Note kind="warn">
                No <b>History</b> tab means MT5 isn&apos;t logged in, and the EA will have nothing to send. You can find the server name and reset the trading
                password in Exness Personal Area under <Path items={["My accounts", "⋮", "Account information"]} />.
              </Note>
            </Step>

            <Step n={2} id="key" title="Get your sync key and the EA file" time="1 min">
              <ol>
                <li>
                  In Journal, open <Path items={["Accounts", "Connect auto-sync", "MT5 EA"]} />.
                </li>
                <li>
                  Click <b>Generate key</b> and copy the key (it starts with <Code>jrn_</Code>). Keep it somewhere safe, such as Notepad — it is shown only
                  once.
                </li>
                <li>
                  Click <b>Download JournalSync.mq5</b>. The file is saved in your <Code>Downloads</Code> folder with your Journal address already filled in.
                </li>
              </ol>
              <Note kind="tip">One key works for all of your MT5 accounts. Don&apos;t share it — anything sent with it lands in your journal.</Note>
            </Step>

            <Step n={3} id="folder" title="Put the file in the Experts folder" time="1 min">
              <ol>
                <li>
                  In MT5, go to <Path items={["File", "Open Data Folder"]} />. A folder opens in Windows Explorer.
                </li>
                <li>
                  Open <Path items={["MQL5", "Experts"]} />.
                </li>
                <li>
                  Copy <Code>JournalSync.mq5</Code> from <Code>Downloads</Code> and paste it here. Replace the old file if there is one.
                </li>
              </ol>
            </Step>

            <Step n={4} id="compile" title="Compile the EA" time="1 min">
              <ol>
                <li>
                  In MT5, click <b>IDE</b> in the toolbar (or press <Kbd>F4</Kbd>). <b>MetaEditor</b> opens.
                </li>
                <li>
                  In MetaEditor&apos;s Navigator, double-click <Path items={["MQL5", "Experts", "JournalSync.mq5"]} />.
                </li>
                <li>
                  Click <b>Compile</b> (or press <Kbd>F7</Kbd>). The <b>Errors</b> tab at the bottom should say <Code>0 errors</Code>. Close MetaEditor.
                </li>
              </ol>
              <Note kind="warn">
                Don&apos;t press <b>Start</b> / <Kbd>F5</Kbd> in MetaEditor — that starts a separate &quot;JournalSync (debugging)&quot; copy. If it is running,
                stop it with <Kbd>Shift</Kbd> + <Kbd>F5</Kbd>.
              </Note>
            </Step>

            <Step n={5} id="webrequest" title="Allow MT5 to reach Journal" time="1 min">
              <ol>
                <li>
                  In MT5, go to <Path items={["Tools", "Options"]} /> and open the <b>Expert Advisors</b> tab.
                </li>
                <li>
                  Tick <b>Allow WebRequest for listed URL</b>.
                </li>
                <li>
                  Double-click <b>add new URL</b> and type your Journal address: <Code>{APP_URL}</Code>
                  <br />
                  <span className="text-sm text-muted-foreground">
                    Include <Code>https://</Code>, no <Code>/</Code> at the end — exactly the address you use in the browser.
                  </span>
                </li>
                <li>
                  Click <b>OK</b>.
                </li>
              </ol>
            </Step>

            <Step n={6} id="attach" title="Attach the EA and paste your key" time="2 min">
              <ol>
                <li>
                  Open any chart, for example <Path items={["File", "New Chart", "EURUSD"]} />. The symbol doesn&apos;t matter.
                </li>
                <li>
                  Open the <b>Navigator</b> (<Path items={["View", "Navigator"]} /> or <Kbd>Ctrl</Kbd> + <Kbd>N</Kbd>) and find{" "}
                  <Path items={["Expert Advisors", "JournalSync"]} />. If it isn&apos;t listed, right-click <b>Expert Advisors</b> and choose <b>Refresh</b>.
                </li>
                <li>
                  Drag <b>JournalSync</b> onto the chart (or right-click it and choose <b>Attach to a chart</b>).
                </li>
                <li>
                  In the window that opens, go to the <b>Inputs</b> tab:
                  <ul className="mt-1.5">
                    <li>
                      <b>Journal URL</b> — already filled in. Leave it.
                    </li>
                    <li>
                      <b>Sync key</b> — double-click the <b>Value</b> cell, paste your key, press <Kbd>Enter</Kbd>.
                    </li>
                    <li>
                      <b>History sent on first run (days)</b> — how far back to send on the first run (default 90). Use 365 or more for older trades.
                    </li>
                  </ul>
                </li>
                <li>
                  Click <b>OK</b>.
                </li>
              </ol>
              <Note kind="info">
                The EA never trades, so it works whether the <b>Algo Trading</b> button is on or off.
              </Note>
            </Step>

            <Step n={7} id="check" title="Check that it syncs" time="1 min">
              <ol>
                <li>
                  Within 10–20 seconds the top-left corner of the chart shows:
                  <br />
                  <Code>Journal sync: synced 13:05 · 42 deals sent since start (42 new) · history from 2026.08.17</Code>
                </li>
                <li>
                  In Journal, refresh <b>Accounts</b>: the account shows <b>Connected</b>, its balance and <b>Synced just now</b>.
                </li>
                <li>
                  Your trades appear in <b>Trades</b> and <b>Calendar</b>. If not, check that the account filter at the top is set to <b>All accounts</b>{" "}
                  or to this account.
                </li>
              </ol>
              <Note kind="done">
                Done. While MT5 is open, new trades reach Journal within seconds. If your computer was off, MT5 sends everything it missed as soon as it
                starts again.
              </Note>
              <Note kind="tip">
                Accounts the EA adds by itself get a name like <Code>Real ··5770</Code>. Click <b>Name it</b> on the account card to rename it.
              </Note>
            </Step>

            <Step n={8} id="more" title="Sync another account">
              <ul>
                <li>
                  Log in to the other account with <Path items={["File", "Login to Trade Account"]} />. The same EA and key send its trades, and Journal
                  adds the account automatically.
                </li>
                <li>
                  MT5 is logged in to one account at a time. To sync two accounts live at once, install MT5 a second time into another folder (choose it
                  under <b>Settings</b> in the installer, e.g. <Code>C:\MT5-Account2</Code>) and repeat steps 1 and 3–6 there with the same key.
                </li>
              </ul>
            </Step>

            <Step n={9} id="history" title="Send older history again">
              <p>The EA remembers how far it has synced. To send everything again:</p>
              <ol>
                <li>
                  In MT5, open <Path items={["Tools", "Global Variables"]} /> (<Kbd>F3</Kbd>), select <Code>JournalSync_&lt;account number&gt;</Code> and
                  click <b>Delete</b>.
                </li>
                <li>
                  Right-click the chart → <Path items={["Expert Advisors", "Properties"]} /> (or click the chart and press <Kbd>F7</Kbd>) →{" "}
                  <b>Inputs</b> → set <b>History sent on first run (days)</b> to <Code>365</Code> → <b>OK</b>.
                </li>
              </ol>
              <Note kind="info">Trades are never saved twice, so re-sending is always safe.</Note>
            </Step>

            <Step n={10} id="trouble" title="Troubleshooting">
              <p>
                Read the text in the top-left corner of the chart, and the <Code>JournalSync</Code> lines in <Path items={["Toolbox", "Experts"]} />.
              </p>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3.5 py-2.5 font-medium">Message on the chart</th>
                      <th className="px-3.5 py-2.5 font-medium">What to do</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y [&_td]:px-3.5 [&_td]:py-3 [&_td]:align-top">
                    {[
                      ["set your Journal URL and sync key", "Step 6: paste the key into Inputs → Sync key."],
                      ["add https://… in Tools > Options > Expert Advisors", "Step 5: add the address to the WebRequest list exactly as shown."],
                      [
                        "can't reach … (code 1001)",
                        "Turn off your antivirus' HTTPS / web scanning and any VPN, then try again. If that fixes it, exclude MT5 (terminal64.exe) in the antivirus. Check the address starts with https://.",
                      ],
                      ["MT5 is not logged in to account …", "Step 1: log in again with the trading password until the History tab appears."],
                      ["server replied 401", "The key is wrong or revoked. Generate a new one (step 2) and paste it in Inputs."],
                      ["server replied 400 …", "Download the latest JournalSync.mq5 and repeat steps 3, 4 and 6."],
                      ["synced … but no trades in Journal", "Check the History tab has trades. For older trades see “Send older history again”. Set the account filter to All accounts."],
                      ["No text on the chart", "The EA isn't attached. Repeat step 6 — its icon shows in the chart's top-right corner when it runs."],
                    ].map(([msg, fix]) => (
                      <tr key={msg}>
                        <td className="w-[42%] font-mono text-[12.5px]">{msg}</td>
                        <td>{fix}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Step>
          </div>
        </main>
      </div>
    </div>
  );
}
