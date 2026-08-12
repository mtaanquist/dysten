import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

/**
 * Next 16 removed `next lint`, so linting is the ESLint CLI run directly
 * (`npm run lint`) and `next build` no longer does it for us — which is why CI
 * runs it as its own step.
 */
export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Design prototypes: exported from Claude Design, never built or deployed.
    ".design/**",
    "scratchpad/**",
  ]),
]);
