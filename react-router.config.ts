import type { Config } from "@react-router/dev/config";

export default {
  ssr: true,
  future: {
    // Required for @cloudflare/vite-plugin compatibility
    v8_viteEnvironmentApi: true,
  },
} satisfies Config;
