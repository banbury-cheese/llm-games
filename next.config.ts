import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/pdf-extract': [
      './scripts/pdf-extract.mjs',
      './node_modules/pdf-parse/**/*',
    ],
  },
};

export default nextConfig;
