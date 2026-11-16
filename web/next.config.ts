import type { NextConfig } from "next";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
  // Self-contained server for the Docker image (web/Dockerfile).
  output: "standalone",
  // Optional URL prefix (build time), e.g. `/demo` in deployment/ where the landing page owns `/`. See src/lib/base-path.ts.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  // The single application version shown in the header (package.json "version"), inlined at build time.
  env: { NEXT_PUBLIC_APP_VERSION: packageJson.version },
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
