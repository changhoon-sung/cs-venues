import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [preact(), inlineEntryScript()],
  server: {
    allowedHosts: ["localhost", "127.0.0.1", "::1", "cs-venues.hooniverse.net"],
  },
});

function inlineEntryScript() {
  return {
    name: "inline-entry-script",
    enforce: "post" as const,
    generateBundle(_options: unknown, bundle: Record<string, { type: string; fileName: string; source?: string; code?: string }>) {
      const html = Object.values(bundle).find((item) => item.type === "asset" && item.fileName === "index.html");
      const entry = Object.values(bundle).find((item) => item.type === "chunk" && item.fileName.endsWith(".js"));
      if (!html?.source || !entry?.code) return;

      html.source = String(html.source).replace(
        /<script type="module" crossorigin src="\/assets\/[^"]+\.js"><\/script>/,
        `<script type="module">\n${entry.code}\n</script>`,
      );
      delete bundle[entry.fileName];
    },
  };
}
