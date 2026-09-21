import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit (PDF risk report, src/lib/pdf-report.ts) pulls in fontkit, whose
  // build output isn't compatible with Next's bundler — it needs to be
  // `require()`'d natively by Node at runtime instead of bundled. Without
  // this, `next build` fails on ./api/reports/risk with an SWC-helpers
  // export error from fontkit's ESM build.
  serverExternalPackages: ["pdfkit", "fontkit"],

  // Baseline security headers (see SECURITY_REVIEW.md). Deliberately not
  // including a Content-Security-Policy here — a CSP strict enough to be
  // worth having is easy to get wrong and break the app (Next's inline
  // hydration scripts, Tailwind, etc.) without careful per-route tuning,
  // which is a follow-up worth doing deliberately rather than bolting on
  // here. HSTS is safe to always send: Coolify's Traefik terminates TLS in
  // front of this app, so every real request already arrived over HTTPS.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
