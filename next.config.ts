import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit (PDF risk report, src/lib/pdf-report.ts) pulls in fontkit, whose
  // build output isn't compatible with Next's bundler — it needs to be
  // `require()`'d natively by Node at runtime instead of bundled. Without
  // this, `next build` fails on ./api/reports/risk with an SWC-helpers
  // export error from fontkit's ESM build.
  serverExternalPackages: ["pdfkit", "fontkit"],
};

export default nextConfig;
