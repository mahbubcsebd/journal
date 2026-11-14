/** Only same-site paths: "/x" yes; "//evil.com", "/\\evil.com", control characters and absolute URLs no. */
export function safeNext(next: string | null | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\u0000-\u001f]/.test(next)) return "/dashboard";
  return next;
}
