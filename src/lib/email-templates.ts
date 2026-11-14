const APP = process.env.NEXT_PUBLIC_APP_NAME ?? "Journal";

export function otpEmail(otp: string) {
  const digits = otp
    .split("")
    .map(
      (d) =>
        `<td style="width:44px;height:52px;border:1px solid #e4e4e7;border-radius:10px;text-align:center;font:600 24px/52px ui-monospace,Menlo,monospace;color:#09090b;background:#fafafa">${d}</td>`,
    )
    .join('<td style="width:8px"></td>');

  const html = `<!doctype html>
<html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border-radius:16px;padding:36px 32px;border:1px solid #e4e4e7">
        <tr><td style="font:600 18px/1.2 inherit;color:#09090b;letter-spacing:-0.01em">
          <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#10b981;margin-right:8px"></span>${APP}
        </td></tr>
        <tr><td style="padding-top:28px;font:600 22px/1.3 inherit;color:#09090b">Your sign-in code</td></tr>
        <tr><td style="padding-top:8px;font:400 14px/1.6 inherit;color:#52525b">Enter this code to sign in. It expires in 10 minutes.</td></tr>
        <tr><td style="padding-top:24px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>${digits}</tr></table></td></tr>
        <tr><td style="padding-top:28px;font:400 12px/1.6 inherit;color:#a1a1aa">If you didn't request this, you can safely ignore this email. Never share this code with anyone.</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return {
    subject: `${otp} is your ${APP} sign-in code`,
    html,
    text: `Your ${APP} sign-in code is ${otp}. It expires in 10 minutes.`,
  };
}

/* ───────────────────────── Shared layout ───────────────────────── */

const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function layout(title: string, body: string, footer: string) {
  return `<!doctype html>
<html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#09090b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e4e4e7;border-radius:16px;padding:32px">
<tr><td style="font-size:16px;font-weight:600"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#10b981;margin-right:8px"></span>${APP}</td></tr>
<tr><td style="padding-top:24px;font-size:22px;font-weight:600;line-height:1.3">${esc(title)}</td></tr>
${body}
<tr><td style="padding-top:28px;font-size:12px;line-height:1.6;color:#a1a1aa">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
  `<tr><td style="padding-top:24px"><a href="${href}" style="display:inline-block;background:#09090b;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 18px;border-radius:10px">${esc(label)}</a></td></tr>`;

const settingsFooter = () =>
  `You get this because email notifications are on. <a href="${APP_URL()}/settings" style="color:#71717a">Change notification settings</a>.`;

/* ───────────────────────── Weekly report ───────────────────────── */

export type WeeklyReportData = {
  name: string;
  weekLabel: string;
  reportUrlPath: string;
  net: string;
  netPositive: boolean;
  trades: number;
  winRate: string;
  profitFactor: string;
  greenDays: string;
  best: string | null;
  worst: string | null;
  topSymbol: string | null;
  vsPrevious: string | null;
  goals: { label: string; ok: boolean }[];
};

export function weeklyReportEmail(d: WeeklyReportData) {
  const stat = (label: string, value: string, color = "#09090b") =>
    `<td style="padding:12px 14px;border:1px solid #e4e4e7;border-radius:10px;width:33%"><div style="font-size:12px;color:#71717a">${esc(label)}</div><div style="font:600 18px ui-monospace,Menlo,monospace;color:${color};margin-top:4px">${esc(value)}</div></td>`;
  const lines = [
    d.best && `Best day: <b>${esc(d.best)}</b>`,
    d.worst && `Worst day: <b>${esc(d.worst)}</b>`,
    d.topSymbol && `Top symbol: <b>${esc(d.topSymbol)}</b>`,
    d.vsPrevious && `Compared with the week before: <b>${esc(d.vsPrevious)}</b>`,
  ].filter(Boolean);
  const goals = d.goals.length
    ? `<tr><td style="padding-top:20px;font-size:14px;font-weight:600">Goals</td></tr>
       <tr><td style="padding-top:6px;font-size:14px;line-height:1.8;color:#3f3f46">${d.goals.map((g) => `${g.ok ? "✅" : "❌"} ${esc(g.label)}`).join("<br>")}</td></tr>`
    : "";
  const body = `
<tr><td style="padding-top:6px;font-size:14px;color:#52525b">Hi ${esc(d.name || "trader")}, here's how ${esc(d.weekLabel)} went.</td></tr>
<tr><td style="padding-top:20px">
  <div style="font-size:12px;color:#71717a">Net P&amp;L</div>
  <div style="font:700 34px ui-monospace,Menlo,monospace;color:${d.netPositive ? "#047857" : "#c2410c"}">${esc(d.net)}</div>
</td></tr>
<tr><td style="padding-top:16px"><table role="presentation" width="100%" cellspacing="6" cellpadding="0" style="margin:0 -6px"><tr>
  ${stat("Trades", String(d.trades))}${stat("Win rate", d.winRate)}${stat("Profit factor", d.profitFactor)}
</tr></table></td></tr>
<tr><td style="padding-top:16px;font-size:14px;line-height:1.8;color:#3f3f46">Green days: <b>${esc(d.greenDays)}</b><br>${lines.join("<br>")}</td></tr>
${goals}
${button(`${APP_URL()}${d.reportUrlPath}`, "Open the full report")}`;
  const text = [
    `${APP} — ${d.weekLabel}`,
    `Net P&L: ${d.net}`,
    `Trades: ${d.trades} · Win rate: ${d.winRate} · Profit factor: ${d.profitFactor}`,
    `Green days: ${d.greenDays}`,
    ...lines.map((l) => (l as string).replace(/<[^>]+>/g, "")),
    ...d.goals.map((g) => `${g.ok ? "[x]" : "[ ]"} ${g.label}`),
    `${APP_URL()}${d.reportUrlPath}`,
  ].join("\n");
  const subject = `${d.weekLabel.replace(/^the /, "")}: ${d.net} · ${d.trades} trades`;
  return { subject: subject[0].toUpperCase() + subject.slice(1), html: layout(`Your week: ${d.net}`, body, settingsFooter()), text };
}

/* ───────────────────────── Goal alert ───────────────────────── */

export function goalAlertEmail(d: { goalLabel: string; used: string; periodLabel: string }) {
  const body = `
<tr><td style="padding-top:8px;font-size:15px;line-height:1.6;color:#3f3f46">
  You've reached your <b>${esc(d.goalLabel)}</b> for ${esc(d.periodLabel)}: <b>${esc(d.used)}</b>.
</td></tr>
<tr><td style="padding-top:12px;font-size:15px;line-height:1.6;color:#3f3f46">
  This is the moment your rule exists for. Close the platform, take a break, and review the day in your journal instead of trading it back.
</td></tr>
${button(`${APP_URL()}/goals`, "View your goals")}`;
  return {
    subject: `Limit reached: ${d.goalLabel}`,
    html: layout("Time to stop for now", body, settingsFooter()),
    text: `You've reached your ${d.goalLabel} for ${d.periodLabel}: ${d.used}. Take a break and review in your journal. ${APP_URL()}/goals`,
  };
}
