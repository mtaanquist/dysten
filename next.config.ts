import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone emits .next/standalone: a self-contained server carrying only
  // the traced dependencies, which is what the Docker runner stage copies
  // instead of the whole node_modules tree.
  //
  // It is opt-in rather than always on because `next start` refuses to serve a
  // standalone build — leaving it on would break `npm start` for anyone running
  // a production build locally. The Dockerfile sets this.
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,
  reactStrictMode: true,
};

export default nextConfig;
