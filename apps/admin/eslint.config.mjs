import { config as nextConfig } from "@workspace/eslint-config/next.js";

/**
 * Ban magic-string TanStack Query keys in call sites. Use factories from
 * `@/lib/query-keys` instead (e.g. `fileKeys.detail(orgId, id)`).
 *
 * Allowed: spreading / calling factories, `as const` tuples defined in
 * `lib/query-keys.ts` itself (that file is ignored below).
 */
const noMagicQueryKeys = {
  files: ["**/*.{ts,tsx}"],
  ignores: ["**/lib/query-keys.ts", "**/scripts/**"],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector:
          "Property[key.name='queryKey'] > ArrayExpression > Literal[value=/^(files|jobs|orgs|providers|api-keys|users|dashboard|metrics|analytics|auth|account)/]",
        message:
          "Do not use magic-string query keys. Import a factory from `@/lib/query-keys` (e.g. fileKeys, jobKeys, orgKeys).",
      },
      {
        selector:
          "CallExpression[callee.property.name='invalidateQueries'] Property[key.name='queryKey'] > ArrayExpression > Literal[value=/^(files|jobs|orgs|providers|api-keys|users|dashboard|metrics|analytics|auth|account)/]",
        message:
          "Do not invalidate with magic-string query keys. Use invalidateX helpers or factories from `@/lib/query-keys`.",
      },
    ],
  },
};

/** @type {import("eslint").Linter.Config[]} */
export default [...nextConfig, noMagicQueryKeys];
