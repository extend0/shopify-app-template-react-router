import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import legacyConfig from "./.eslintrc.cjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: [
      "node_modules/**",
      ".cache/**",
      "build/**",
      "app/build/**",
      "public/build/**",
      "public/_dev/**",
      "app/public/build/**",
      ".wrangler/**",
      ".shopify/**",
      ".react-router/**",
      "tmp/**",
      "extensions/*/dist/**",
      "*.tsbuildinfo",
      ".env*",
      ".dev.vars",
      "env.d.ts",
      "worker-configuration.d.ts",
      "shopify.app.toml",
    ],
  },
  ...compat.config(legacyConfig),
];
