"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ACCOUNT_FILTER_COOKIE, getCurrentUser, getUserAccounts } from "@/lib/session";

/** Persist the global account filter (empty array = all accounts). */
export async function setAccountFilter(ids: string[]) {
  const current = await getCurrentUser();
  if (!current) return;
  const owned = new Set((await getUserAccounts(current.id)).map((a) => a.id));
  const valid = ids.filter((id) => owned.has(id));
  (await cookies()).set(ACCOUNT_FILTER_COOKIE, valid.length ? valid.join(",") : "all", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}
