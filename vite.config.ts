import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [preact()],
  server: {
    allowedHosts: ["localhost", "127.0.0.1", "::1", "cs-venues.hooniverse.net"],
  },
});
