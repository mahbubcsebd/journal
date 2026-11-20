/**
 * Checks the environment once at server start-up and explains what's missing,
 * instead of failing later with an obscure error.
 */
const REQUIRED = ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "NEXT_PUBLIC_APP_URL"] as const;
const PRODUCTION_REQUIRED = ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "EMAIL_FROM", "CRON_SECRET", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
const OPTIONAL = {
  GEMINI_API_KEY: "AI insights are disabled",
  METAAPI_TOKEN: "MetaApi cloud sync is disabled (the MT5 EA still works)",
  VAPID_PRIVATE_KEY: "phone/browser push alerts are disabled (npx web-push generate-vapid-keys)",
  TELEGRAM_BOT_TOKEN: "Telegram alerts are disabled",
} as const;

export function checkEnv() {
  const prod = process.env.NODE_ENV === "production";
  const missing = [...REQUIRED, ...(prod ? PRODUCTION_REQUIRED : [])].filter((k) => !process.env[k]);
  const problems: string[] = [];
  if (missing.length) problems.push(`Missing environment variables: ${missing.join(", ")}`);
  if (process.env.BETTER_AUTH_SECRET && process.env.BETTER_AUTH_SECRET.length < 32)
    problems.push("BETTER_AUTH_SECRET should be at least 32 characters (openssl rand -base64 32)");
  if (prod && process.env.BETTER_AUTH_URL?.startsWith("http://"))
    problems.push("BETTER_AUTH_URL must be your https:// production URL");
  if (prod && process.env.DATABASE_URL?.includes(":5432/") && process.env.DATABASE_URL.includes("supabase"))
    problems.push("DATABASE_URL should use Supabase's transaction pooler (port 6543) on Vercel");
  for (const p of problems) console.error(`[journal] ${p}`);
  for (const [k, why] of Object.entries(OPTIONAL)) if (!process.env[k]) console.info(`[journal] ${k} not set — ${why}.`);
  return problems;
}
