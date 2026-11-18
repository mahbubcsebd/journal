"use server";

import { revalidatePath } from "next/cache";
import { AiError, aiModel, generateJson } from "@/lib/ai/gemini";
import { eventAnalysisResponseSchema, eventAnalysisSchema, type EventAnalysis } from "@/lib/ai/schemas";
import { getCurrentUser } from "@/lib/session";
import { getEvent, getNewsPrefs } from "@/server/queries/news";
import { ensureFreshCalendar, setEventAnalysis } from "@/server/services/news";

type Stored = { data: EventAnalysis; model: string; at: string; hadActual: boolean };

const SYSTEM = (lang: "en" | "bn") => `You are a senior macro analyst who explains economic news to retail forex and gold traders on Exness.
Explain clearly and practically for someone who is not an economist. Be balanced: give the conventional market reaction for each outcome and say it can differ when markets have priced it in or other news dominates.
Never promise a direction. Do not give personal financial advice; give general trading-risk guidance (e.g. avoid opening trades minutes before high-impact releases, spreads widen, slippage, reduce size, wait for the first candle to close).
${lang === "bn" ? "Write every text field in natural, simple Bengali (Bangla script). Keep symbols, currency codes, numbers and indicator names (CPI, NFP, PMI) in English." : "Write in clear, simple English."}
Return only the JSON described by the schema.`;

/** AI explanation of one calendar event, cached per language for every user. */
export async function analyzeEvent(id: string, lang: "en" | "bn", force = false): Promise<{ ok: true; data: EventAnalysis } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const event = await getEvent(id);
  if (!event) return { ok: false, error: "This event is no longer in the calendar." };
  const cached = (event.analysis as Record<string, Stored> | null)?.[lang];
  // Regenerate once the actual number is out, or when asked.
  if (cached && !force && (cached.hadActual || !event.actual)) return { ok: true, data: cached.data };

  const prefs = await getNewsPrefs(user);
  const symbols = [...new Set(["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "US30", ...prefs.symbols.slice(0, 6)])];
  try {
    const data = await generateJson({
      system: SYSTEM(lang),
      prompt: `Explain this scheduled economic release and how it usually moves markets.

EVENT: ${event.title}
CURRENCY: ${event.currency}
IMPACT: ${event.impact}
TIME (UTC): ${event.time.toISOString()}
FORECAST: ${event.forecast ?? "n/a"}
PREVIOUS: ${event.previous ?? "n/a"}
ACTUAL: ${event.actual ?? "not released yet"}

The trader watches: ${symbols.join(", ")}.
In "scenarios" cover: actual better than forecast, worse than forecast, and in line (plus a surprise/revision case if relevant).
In "affected" list 3-6 of the watched symbols this release moves most, with the direction they usually move if the number comes in better (stronger) than forecast, and a short reason in "ifBetter".
"tradingPlan": 3-5 concrete risk rules for this release.`,
      responseSchema: eventAnalysisResponseSchema,
      validate: eventAnalysisSchema,
      temperature: 0.3,
    });
    await setEventAnalysis(id, lang, { data, model: aiModel(), at: new Date().toISOString(), hadActual: Boolean(event.actual) } satisfies Stored);
    revalidatePath(`/news/${id}`);
    return { ok: true, data };
  } catch (e) {
    if (e instanceof AiError) return { ok: false, error: e.message };
    console.error("[news] analysis failed", e);
    return { ok: false, error: "Couldn't generate the explanation. Please try again." };
  }
}

/** Manual "Refresh calendar" from the news page. */
export async function refreshNews() {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  // At most every 5 minutes, however often it's clicked: the feed provider asks for light polling.
  const ran = await ensureFreshCalendar(5);
  revalidatePath("/news");
  return { ok: true, refreshed: ran };
}
