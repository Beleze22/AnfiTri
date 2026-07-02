import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node-ical usa polyfills que conflitam com o bundler (Turbopack) em
  // build-time — marcar como externo para ser require'd em runtime no servidor.
  serverExternalPackages: ["node-ical"],
};

export default nextConfig;
