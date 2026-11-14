import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return {
    // Only the landing page is public; everything else is a private, signed-in app.
    rules: [{ userAgent: "*", allow: ["/$", "/login"], disallow: ["/api/", "/dashboard", "/trades", "/calendar", "/journal", "/notebook", "/settings", "/accounts"] }],
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
