import { defineConfig } from "vite";

export default defineConfig({
  base: "/cs-venues/",
  server: {
    allowedHosts: ["localhost", "127.0.0.1", "::1", "changhoon-sung.github.io"],
  },
});
