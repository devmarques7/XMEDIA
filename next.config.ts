import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // versão desta build (a app compara com o servidor e avisa quando há uma nova)
  env: { NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_URL || "" },
  // PDFs originais das invoices (servidos com login por /api/invoices/file/[name])
  outputFileTracingIncludes: { "/api/invoices/file/[name]": ["./data/invoices-2026/*.pdf"] },
};

export default nextConfig;
