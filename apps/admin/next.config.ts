import path from "node:path";
import type { NextConfig } from "next";

const monorepoRoot = path.resolve(__dirname, "../..");

const nextConfig: NextConfig = {
  reactCompiler: false,
  /** Required for the combined API+admin production Docker image. */
  output: "standalone",
  /** Trace workspace packages from the monorepo root (not apps/admin only). */
  outputFileTracingRoot: monorepoRoot,
  transpilePackages: ["@workspace/ui", "@workspace/validation"],
  productionBrowserSourceMaps: false,
  turbopack: {
    root: monorepoRoot,
  },
};

export default nextConfig;
