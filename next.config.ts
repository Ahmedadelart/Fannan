import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // A small self-contained server for the Cloud Run container.
  output: "standalone",
  // Cache Components stays off for now: pages read the Host-based surface per request,
  // and Cloudflare does the edge caching. Revisit for the public renderer in phase 4.
  cacheComponents: false,
  poweredByHeader: false,
  // Tailwind runs through postcss.config.mjs for both builders. Production builds use webpack
  // (`next build --webpack`): Turbopack intermittently fails to fetch Google fonts at build time.
};

export default withNextIntl(nextConfig);
