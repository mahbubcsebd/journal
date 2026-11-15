import type { Metadata } from "next";
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, Info, Lightbulb } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "MT5 auto-sync setup guide",
  description: "Step by step: connect your Exness MT5 account to Journal with the JournalSync EA, so every trade is saved automatically.",
};

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://<tomar-app>.vercel.app").replace(/\/$/, "");

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
  { id: "need", title: "Ki ki lagbe" },
  { id: "journal", title: "Journal e account khulun" },
  { id: "exness", title: "Exness theke account er tottho nin" },
  { id: "install", title: "PC te MT5 install korun" },
  { id: "login", title: "MT5 e account e login korun" },
  { id: "key", title: "Sync key ar EA file nin" },
  { id: "folder", title: "EA file ta Experts folder e rakhun" },
  { id: "compile", title: "EA compile korun" },
  { id: "webrequest", title: "MT5 ke internet e pathanor onumoti din" },
  { id: "attach", title: "EA chart e lagan" },
  { id: "check", title: "Kaj korche kina dekhun" },
  { id: "daily", title: "Protidin er babohar" },
  { id: "more", title: "Aro account / onno user" },
  { id: "history", title: "Purono history abar pathano" },
  { id: "trouble", title: "Shomossa hole" },
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
            <p className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Steps</p>
            {STEPS.map((s, i) => (
              <a key={s.id} href={`#${s.id}`} className="flex gap-2 rounded-md px-2 py-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground">
                <span className="w-4 shrink-0 text-right font-mono text-xs leading-5 tabular">{i}</span>
                <span className="leading-5">{s.title}</span>
              </a>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 max-w-3xl">
          <Link href="/accounts" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Accounts
          </Link>
          <p className="text-sm font-medium text-brand-ink">Setup guide · 15–20 minute</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Exness MT5 ke Journal er sathe connect korun</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            Ei guide follow korle apnar Exness account e je kono jaygay (Exness website, Exness app ba MT5) theke deya protiti order nijei Journal e save
            hobe. Kono step skip korben na, order moto korun. Protiti menu er naam thik jemon MT5 e lekha thake temon-i deya ache.
          </p>

          <div className="mt-6 grid gap-2 rounded-xl border bg-card p-4 text-sm shadow-soft lg:hidden">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Steps</p>
            <ol className="grid gap-1 sm:grid-cols-2">
              {STEPS.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="flex gap-2 text-muted-foreground hover:text-foreground">
                    <span className="w-4 text-right font-mono text-xs leading-5 tabular">{i}</span>
                    <span className="leading-5">{s.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-10">
            <Step n={0} id="need" title="Ki ki lagbe">
              <ul>
                <li>
                  Ekta <b>Windows PC ba laptop</b>. Phone er MT5 app e EA chole na, tai PC lagbe. (Mac e MetaTrader 5 app thakle sheta-o cholbe.)
                </li>
                <li>
                  Ekta <b>Exness MT5 account</b>: tar <b>login number</b>, <b>trading password</b> ar <b>server</b> er naam (Step 2 e kothay pabe dekhano
                  ache).
                </li>
                <li>Internet connection, ar apnar email (Journal e login korar jonno).</li>
              </ul>
              <Note kind="info">
                Order Exness website, Exness Trade app ba MT5, je kono jaygay theke dite paren. Shob order ek-i Exness server e save hoy, ar MT5 shegula
                dekhte pay. MT5 shudhu data pathanor kaj kore.
              </Note>
            </Step>

            <Step n={1} id="journal" title="Journal e account khulun" time="2 min">
              <ol>
                <li>
                  Browser e kholun: <Code>{APP_URL}</Code>
                </li>
                <li>
                  <b>Sign in</b> e click kore apnar <b>email</b> din, <b>Continue</b> chapun.
                </li>
                <li>Email e ekta 6 digit er code ashbe (Spam folder o dekhben). Code ta boshan.</li>
                <li>
                  Prothombar hole naam, <b>Timezone</b> (Bangladesh hole <Code>Asia/Dhaka</Code>) ar currency diye <b>Continue</b>.
                </li>
              </ol>
              <Note kind="tip">Protiti user nijer email diye login korbe. Apnar data shudhu apni dekhben.</Note>
            </Step>

            <Step n={2} id="exness" title="Exness theke account er tottho nin" time="2 min">
              <ol>
                <li>
                  <Code>my.exness.com</Code> e login korun → <Path items={["My accounts"]} />
                </li>
                <li>
                  Je account er trade Journal e chan, oi card e lekha ache: <b>account number</b> (jemon <Code>412155770</Code>), <b>MT5</b> ar <b>Real/Demo</b>.
                </li>
                <li>
                  Card er <Kbd>⋮</Kbd> (tin dot) → <Path items={["Account information"]} /> → <b>Server</b> er naam likhe rakhun (jemon{" "}
                  <Code>Exness-MT5Real8</Code>).
                </li>
                <li>
                  Trading password mone na thakle: <Kbd>⋮</Kbd> → <Path items={["Change trading password"]} /> → notun password din, likhe rakhun.
                </li>
              </ol>
              <Note kind="warn">
                <b>Trading password</b> ar Exness website er login password alada jinish. MT5 e trading password lagbe. Account ta <b>MT4</b> hole ei EA kaj
                korbe na, <b>MT5</b> account lagbe.
              </Note>
            </Step>

            <Step n={3} id="install" title="PC te MT5 install korun" time="3 min">
              <ol>
                <li>
                  Exness Personal Area e account card er <b>Trade</b> button → <b>MetaTrader 5</b> → <b>Download</b> (Windows). Othoba exness.com er{" "}
                  <b>Platforms → MetaTrader 5</b> page theke download korun.
                </li>
                <li>
                  Download hoya setup file (jemon <Code>exness5setup.exe</Code>) double-click kore install korun → <b>Next</b> → <b>Finish</b>.
                </li>
                <li>MT5 nijei khulbe. Agei install kora thakle ei step bad din.</li>
              </ol>
            </Step>

            <Step n={4} id="login" title="MT5 e account e login korun" time="1 min">
              <ol>
                <li>
                  MT5 er upore menu: <Path items={["File", "Login to Trade Account"]} />
                </li>
                <li>
                  <b>Login</b> = account number, <b>Password</b> = trading password, <b>Server</b> = Step 2 er server. <b>Save password</b> e tick din →{" "}
                  <b>OK</b>.
                </li>
                <li>
                  Thik moto login hoyeche kina dekhun:
                  <ul className="mt-1.5">
                    <li>
                      Window er <b>nicher dan kone</b> ping dekhabe (jemon <Code>45.2 ms</Code>). Lal dot ba <Code>Invalid account</Code> lekha thakle
                      password ba server vul.
                    </li>
                    <li>
                      Niche <b>Toolbox</b> panel e (na dekhle <Kbd>Ctrl</Kbd> + <Kbd>T</Kbd>) <b>Trade</b> ar <b>History</b> tab thakbe.
                    </li>
                  </ul>
                </li>
              </ol>
              <Note kind="warn">
                Toolbox e <b>History</b> tab na thakle MT5 apnar account e dhukte pareni. Tokhon EA kono trade pathate parbe na. Password abar din.
              </Note>
            </Step>

            <Step n={5} id="key" title="Sync key ar EA file nin" time="2 min">
              <ol>
                <li>
                  Journal e: <Path items={["Accounts", "Connect auto-sync"]} /> (account na thakle age <b>Add account</b>, ba je kono card er{" "}
                  <b>Connect auto-sync</b>).
                </li>
                <li>
                  <b>MT5 EA</b> tab → <b>Generate key</b> → <Code>jrn_…</Code> diye shuru howa key ta <b>Copy</b> kore Notepad e rakhun.
                </li>
                <li>
                  <b>Download JournalSync.mq5</b> chapun. File ta PC er <Code>Downloads</Code> folder e jabe.
                </li>
              </ol>
              <Note kind="warn">Key ta ekbar-i dekhay. Kauke diben na: ei key diye pathano data apnar account e jabe.</Note>
              <Note kind="tip">Ek-i key diye apnar shob Exness account sync kora jay. Protiti account er jonno notun key lagbe na.</Note>
            </Step>

            <Step n={6} id="folder" title="EA file ta Experts folder e rakhun" time="1 min">
              <ol>
                <li>
                  MT5 er menu: <Path items={["File", "Open Data Folder"]} />. Ekta folder khulbe.
                </li>
                <li>
                  Oi folder e: <Path items={["MQL5", "Experts"]} /> folder e dhukun.
                </li>
                <li>
                  <Code>Downloads</Code> theke <Code>JournalSync.mq5</Code> copy kore ei <b>Experts</b> folder e paste korun.
                </li>
              </ol>
              <Note kind="info">
                Purono JournalSync file thakle replace korun. Notun version e bug fix ar bhalo message thake.
              </Note>
            </Step>

            <Step n={7} id="compile" title="EA compile korun" time="1 min">
              <ol>
                <li>
                  MT5 er upore toolbar e <b>IDE</b> button (ba <Kbd>F4</Kbd>). <b>MetaEditor</b> khulbe.
                </li>
                <li>
                  MetaEditor er bam pashe <Path items={["MQL5", "Experts", "JournalSync.mq5"]} /> e double-click.
                </li>
                <li>
                  Upore <b>Compile</b> button (ba <Kbd>F7</Kbd>).
                </li>
                <li>
                  Niche <b>Errors</b> tab e <Code>0 errors</Code> lekha ashle hoye geche. MetaEditor bondho korun.
                </li>
              </ol>
              <Note kind="warn">
                MetaEditor e <b>Start / Debug</b> (<Kbd>F5</Kbd>) chapben na. Tahole &quot;JournalSync (debugging)&quot; namer ekta copy chole. Bhule chalu
                hole <Kbd>Shift</Kbd> + <Kbd>F5</Kbd> diye bondho korun.
              </Note>
            </Step>

            <Step n={8} id="webrequest" title="MT5 ke internet e pathanor onumoti din" time="1 min">
              <ol>
                <li>
                  MT5 er menu: <Path items={["Tools", "Options"]} /> → <b>Expert Advisors</b> tab.
                </li>
                <li>
                  <b>Allow WebRequest for listed URL</b> e tick din.
                </li>
                <li>
                  Nicher list e <b>add new URL</b> e double-click kore likhun: <Code>{APP_URL}</Code>
                  <br />
                  <span className="text-sm text-muted-foreground">
                    <Code>https://</Code> soho, shesh e <Code>/</Code> chara. Browser e je address diye Journal khulen, hubohu sheta.
                  </span>
                </li>
                <li>
                  <b>OK</b>.
                </li>
              </ol>
            </Step>

            <Step n={9} id="attach" title="EA chart e lagan" time="2 min">
              <ol>
                <li>
                  Ekta chart khola rakhun. Na thakle: <Path items={["File", "New Chart", "EURUSD"]} /> (je kono symbol cholbe).
                </li>
                <li>
                  Bam pashe <b>Navigator</b> (na dekhle <Path items={["View", "Navigator"]} /> ba <Kbd>Ctrl</Kbd> + <Kbd>N</Kbd>) →{" "}
                  <Path items={["Expert Advisors", "JournalSync"]} />
                  <br />
                  <span className="text-sm text-muted-foreground">
                    JournalSync na dekhle <b>Expert Advisors</b> e right-click → <b>Refresh</b>.
                  </span>
                </li>
                <li>
                  <b>JournalSync</b> ke mouse diye tene chart er upor chere din (drag &amp; drop). Ba right-click → <b>Attach to a chart</b>.
                </li>
                <li>
                  Je window khulbe tar <b>Inputs</b> tab:
                  <ul className="mt-1.5">
                    <li>
                      <b>Journal URL</b>: agei boshano (<Code>{APP_URL}</Code>). Bodlaben na.
                    </li>
                    <li>
                      <b>Sync key</b>: <b>Value</b> ghore double-click → Step 5 er key paste → <Kbd>Enter</Kbd>.
                    </li>
                    <li>
                      <b>History sent on first run (days)</b>: kot din ager trade pathabe (default 90). Purono shob chaile 365 ba 1000 din.
                    </li>
                  </ul>
                </li>
                <li>
                  <b>OK</b>.
                </li>
              </ol>
              <Note kind="info">
                EA kono trade kore na, shudhu data pathay. Tai upore <b>Algo Trading</b> button on/off jai thakuk, sync hobe.
              </Note>
            </Step>

            <Step n={10} id="check" title="Kaj korche kina dekhun" time="1 min">
              <ol>
                <li>
                  Chart er <b>upore-bam kone</b> 10–20 second er moddhe lekha ashbe:
                  <br />
                  <Code>Journal sync: synced 13:05 · 42 deals sent since start (42 new) · history from 2026.08.17</Code>
                </li>
                <li>
                  Journal e <b>Accounts</b> page refresh korun. Account e <b>Connected</b>, balance ar <b>Synced just now</b> dekhabe.
                </li>
                <li>
                  <b>Trades</b> ba <b>Calendar</b> e trade gula dekhun. Upore account filter e <b>All accounts</b> ba oi account select kora ache kina
                  dekhun.
                </li>
              </ol>
              <Note kind="done">Hoye geche! Ekhon theke notun trade 5–10 second er moddhe Journal e chole ashbe.</Note>
              <Note kind="tip">
                MT5 theke nijei add howa account er naam hoy <Code>Real ··5770</Code> er moto. Card e naam er pashe ✏️ <b>Name it</b> chepe pochonder naam
                din.
              </Note>
            </Step>

            <Step n={11} id="daily" title="Protidin er babohar">
              <ul>
                <li>
                  PC te <b>MT5 khola</b> thakle trade real-time e ashe. MT5 bondho korar age kichu korte hobe na.
                </li>
                <li>
                  PC bondho chilo? Abar MT5 khullei EA miss kora shob trade pathiye dey. Kichu hariye jay na.
                </li>
                <li>
                  Data dekhar jonno MT5 lage na: phone ba je kono browser theke Journal khulun. Phone e browser menu → <b>Add to Home Screen</b> dile app er
                  moto khule.
                </li>
                <li>
                  Exness e trading password bodlale MT5 e abar login korte hobe (<Path items={["File", "Login to Trade Account"]} />), noile sync thame.
                </li>
              </ul>
            </Step>

            <Step n={12} id="more" title="Aro account / onno user">
              <p>
                <b>Nijer arekta Exness account:</b>
              </p>
              <ul>
                <li>
                  MT5 e <Path items={["File", "Login to Trade Account"]} /> diye oi account e login korun. Ek-i EA ar ek-i key oi account er data pathabe,
                  Journal e notun card nijei toiri hobe.
                </li>
                <li>
                  Ekta MT5 e ek shomoy ekta account login thake. Duita account ek shathe real-time chaile MT5 abar install korun alada folder e (installer
                  er <b>Settings</b> e folder bodlan, jemon <Code>C:\MT5-Account2</Code>), oikhane Step 4–9 abar korun ek-i key diye.
                </li>
              </ul>
              <p>
                <b>Onno manush (onno user):</b>
              </p>
              <ul>
                <li>
                  Tini <b>nijer email</b> e Journal account khulben, <b>nijer PC te</b> nijer MT5 e ei puro guide follow korben, ar <b>nijer key</b> banaben.
                  Apnar key kauke diben na.
                </li>
              </ul>
            </Step>

            <Step n={13} id="history" title="Purono history abar pathano">
              <p>EA mone rakhe kon porjonto pathiyeche. Shob abar pathate chaile:</p>
              <ol>
                <li>
                  MT5: <Path items={["Tools", "Global Variables"]} /> (ba <Kbd>F3</Kbd>) → <Code>JournalSync_&lt;account number&gt;</Code> select →{" "}
                  <b>Delete</b>.
                </li>
                <li>
                  Chart e right-click → <Path items={["Expert Advisors", "Properties"]} /> (ba chart e click kore <Kbd>F7</Kbd>) → <b>Inputs</b> →{" "}
                  <b>History sent on first run (days)</b> = <Code>365</Code> → <b>OK</b>.
                </li>
              </ol>
              <Note kind="info">Ek-i trade duibar save hoy na, tai nishchinte abar pathate paren.</Note>
            </Step>

            <Step n={14} id="trouble" title="Shomossa hole">
              <p>
                Chart er upore-bam kone je lekha ashe, ar MT5 er <Path items={["Toolbox", "Experts"]} /> tab er <Code>JournalSync</Code> line gula dekhun.
              </p>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3.5 py-2.5 font-medium">Chart e lekha</th>
                      <th className="px-3.5 py-2.5 font-medium">Ki korben</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y [&_td]:px-3.5 [&_td]:py-3 [&_td]:align-top">
                    {[
                      ["set your Journal URL and sync key", "Step 9: Inputs e Sync key paste korun."],
                      ["add https://… in Tools > Options > Expert Advisors", "Step 8: URL ta WebRequest list e hubohu add korun."],
                      [
                        "can't reach … (code 1001) / server replied 1001",
                        "Antivirus er HTTPS/web scanning ar VPN off kore dekhun. Kaj korle antivirus e MT5 (terminal64.exe) ke exclude korun. URL https kina dekhun.",
                      ],
                      ["MT5 is not logged in to account …", "Step 4: trading password diye abar login korun. Toolbox e History tab ashte hobe."],
                      ["server replied 401", "Key vul ba revoke kora. Journal e notun key banan (Step 5), Inputs e paste korun."],
                      ["server replied 400: Unexpected payload…", "Journal er notun version deploy hoyeche kina dekhun, ar notun JournalSync.mq5 download kore Step 6–9 abar korun."],
                      ["synced … kintu trade ashe na", "History tab e trade ache kina dekhun. Purono hole Step 13. Journal er upore account filter All accounts kina dekhun."],
                      ["Kono lekha-i nei", "EA chart e lagano ache kina dekhun (chart er upore-dan kone EA er icon). Na thakle Step 9 abar."],
                    ].map(([msg, fix]) => (
                      <tr key={msg}>
                        <td className="w-[44%] font-mono text-[12.5px]">{msg}</td>
                        <td>{fix}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Note kind="info">
                Tobuo na hole chart er lekha ar <b>Experts</b> tab er screenshot niye admin ke pathan.
              </Note>
            </Step>
          </div>
        </main>
      </div>
    </div>
  );
}
