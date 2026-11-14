import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  aiInsight,
  challenge,
  deal,
  goal,
  journalEntry,
  note,
  setup,
  tag,
  trade,
  tradeImage,
  tradeTag,
  tradingAccount,
  transaction,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/session";

/** Everything the user has stored, as JSON (secrets and key hashes excluded). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const accounts = await db.select().from(tradingAccount).where(eq(tradingAccount.userId, user.id));
  const accountIds = accounts.map((a) => a.id);
  const any = accountIds.length ? accountIds : ["__none__"];
  const trades = await db.select().from(trade).where(eq(trade.userId, user.id));
  const tradeIds = trades.map((t) => t.id);
  const anyTrade = tradeIds.length ? tradeIds : ["__none__"];

  const [deals, transactions, tags, tradeTags, images, setups, journal, notes, goals, challenges, insights] = await Promise.all([
    db.select().from(deal).where(inArray(deal.accountId, any)),
    db.select().from(transaction).where(inArray(transaction.accountId, any)),
    db.select().from(tag).where(eq(tag.userId, user.id)),
    db.select().from(tradeTag).where(inArray(tradeTag.tradeId, anyTrade)),
    db.select({ id: tradeImage.id, tradeId: tradeImage.tradeId, caption: tradeImage.caption, createdAt: tradeImage.createdAt }).from(tradeImage).where(inArray(tradeImage.tradeId, anyTrade)),
    db.select().from(setup).where(eq(setup.userId, user.id)),
    db.select().from(journalEntry).where(eq(journalEntry.userId, user.id)),
    db.select().from(note).where(eq(note.userId, user.id)),
    db.select().from(goal).where(eq(goal.userId, user.id)),
    db.select().from(challenge).where(eq(challenge.userId, user.id)),
    db.select().from(aiInsight).where(eq(aiInsight.userId, user.id)),
  ]);

  const body = {
    exportedAt: new Date().toISOString(),
    format: "journal-export-v1",
    profile: { email: user.email, name: user.name, timezone: user.timezone, baseCurrency: user.baseCurrency, settings: user.settings, createdAt: user.createdAt },
    accounts: accounts.map((a) => ({ ...a, encryptedInvestorPassword: undefined })),
    trades,
    deals: deals.map((d) => ({ ...d, raw: undefined })),
    transactions,
    tags,
    tradeTags,
    screenshots: images.map((i) => ({ ...i, url: `/api/trade-images/${i.id}` })),
    setups,
    journal,
    notes,
    goals,
    challenges,
    aiInsights: insights,
  };
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="journal-export-${date}.json"`,
      "cache-control": "no-store",
    },
  });
}
