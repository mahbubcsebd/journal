import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The MetaApi SDK uses Node-only websocket code; keep it out of the bundle.
  serverExternalPackages: ["metaapi.cloud-sdk"],
  // Ship the EA source with the download route.
  outputFileTracingIncludes: { "/api/ea/download": ["./mql5/**"] },
  experimental: {
    // MT5 history reports are UTF-16 HTML and can be several MB.
    serverActions: { bodySizeLimit: "10mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
