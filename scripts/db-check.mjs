// Checks that DATABASE_URL and DIRECT_URL in .env.local actually log in to Postgres,
// and explains the most common Supabase connection problems.
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
config();

const hints = [
  [/Tenant or user not found/i, "Wrong project ref or pooler host (aws-0 vs aws-1). Copy the URL again from Supabase → Connect."],
  [/password authentication failed/i, "Wrong password. Special characters must be URL-encoded (@ → %40, # → %23, / → %2F, : → %3A)."],
  [/CONNECT_TIMEOUT|ETIMEDOUT/i, "Timed out. Is the Supabase project paused (Restore it) or is a VPN/firewall/antivirus blocking it? Try a mobile hotspot."],
  [/ENOTFOUND|EAI_AGAIN/i, "Host name can't be resolved. Check the host in the URL for typos or line breaks."],
  [/self[- ]signed|certificate/i, "TLS problem. Try adding ?sslmode=require to the end of the URL."],
  [/Invalid URL|TypeError/i, "The URL is malformed — usually an unencoded @ in the password or a line break."],
];

function describe(url) {
  try {
    const u = new URL(url);
    return `${u.username}@${u.hostname}:${u.port}${u.pathname}`;
  } catch {
    return "(not a valid URL)";
  }
}

let failed = false;
for (const name of ["DATABASE_URL", "DIRECT_URL"]) {
  const url = process.env[name];
  if (!url) {
    console.log(`SKIP ${name}: not set`);
    continue;
  }
  const started = Date.now();
  const sql = postgres(url, { prepare: false, connect_timeout: 15, max: 1, onnotice: () => {} });
  try {
    const [row] = await sql`select current_user as user, version() as version`;
    const tables = await sql`select count(*)::int as n from information_schema.tables where table_schema = 'public'`;
    console.log(`OK   ${name} → ${describe(url)} (${Date.now() - started} ms, user ${row.user}, ${tables[0].n} tables)`);
    if (tables[0].n === 0) console.log("     No tables yet — run: npm run db:migrate");
  } catch (e) {
    failed = true;
    const msg = `${e.code ?? ""} ${e.message ?? e}`.trim();
    console.log(`FAIL ${name} → ${describe(url)} (${Date.now() - started} ms)\n     ${msg}`);
    const hint = hints.find(([re]) => re.test(msg));
    if (hint) console.log(`     Hint: ${hint[1]}`);
  } finally {
    await sql.end({ timeout: 2 }).catch(() => {});
  }
}
process.exit(failed ? 1 : 0);
