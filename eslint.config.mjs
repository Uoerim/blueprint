import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // The site admin panel is metadata-only by design: it may count and list
  // accounts, teams and audit events, but must never decrypt team content.
  {
    files: ["app/admin/**", "app/actions/admin.ts", "lib/clerk-admin.ts", "lib/site-roles.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "@/lib/crypto", message: "Admin code is metadata-only: never decrypt team content here." }] },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
