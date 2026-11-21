import "server-only";
import { notFound } from "next/navigation";
import { isSuperAdmin } from "@/lib/admin";
import { getCurrentUser } from "@/lib/session";

/** Admin pages and actions: anyone else gets a plain 404, so the area stays hidden. */
export async function requireSuperAdmin() {
  const u = await getCurrentUser();
  if (!u || !isSuperAdmin(u.email)) notFound();
  return u;
}
