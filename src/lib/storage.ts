import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Tiny blob store. Production uses a private Supabase Storage bucket over its
 * REST API (service-role key, server only); local development without
 * Supabase falls back to the `.uploads/` folder.
 */
const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "trade-images";
const LOCAL_DIR = path.join(process.cwd(), ".uploads");

const useSupabase = Boolean(SUPABASE_URL && SERVICE_KEY);

/**
 * New Supabase secret keys (`sb_secret_…`) aren't JWTs: they go in the `apikey`
 * header only. Legacy `service_role` keys are JWTs and also need `Authorization`.
 */
function authHeaders(): Record<string, string> {
  const key = SERVICE_KEY ?? "";
  return key.startsWith("eyJ") ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
}

function assertConfigured() {
  if (!useSupabase && process.env.NODE_ENV === "production") {
    throw new Error("File storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  }
}

function localPath(key: string) {
  const p = path.join(LOCAL_DIR, key);
  if (!p.startsWith(LOCAL_DIR + path.sep)) throw new Error("Invalid key");
  return p;
}

export async function putObject(key: string, data: Uint8Array, contentType: string) {
  assertConfigured();
  if (useSupabase) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${key}`, {
      method: "POST",
      headers: { ...authHeaders(), "content-type": contentType, "x-upsert": "true" },
      body: Buffer.from(data),
    });
    if (!res.ok) throw new Error(`Upload failed (${res.status})`);
    return;
  }
  const p = localPath(key);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, data);
}

export async function getObject(key: string): Promise<Uint8Array | null> {
  if (useSupabase) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/${BUCKET}/${key}`, {
      headers: authHeaders(),
    });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  }
  try {
    return new Uint8Array(await readFile(localPath(key)));
  } catch {
    return null;
  }
}

export async function deleteObjects(keys: string[]) {
  if (keys.length === 0) return;
  if (useSupabase) {
    await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
      method: "DELETE",
      headers: { ...authHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ prefixes: keys }),
    });
    return;
  }
  await Promise.all(keys.map((k) => rm(localPath(k), { force: true })));
}

/** Detect image type from magic bytes; never trust the client's MIME type. */
export function sniffImage(b: Uint8Array): { ext: string; type: string } | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: "png", type: "image/png" };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { ext: "gif", type: "image/gif" };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50)
    return { ext: "webp", type: "image/webp" };
  return null;
}

export const contentTypeFor = (key: string) =>
  ({ png: "image/png", jpg: "image/jpeg", gif: "image/gif", webp: "image/webp" })[key.split(".").pop() ?? ""] ?? "application/octet-stream";
