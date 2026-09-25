#!/usr/bin/env node
// Inlines the data and scripts into one self-contained file, dist/index.html,
// that opens anywhere (GitHub Pages, email attachment, a double-click).
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

let html = await readFile(join(root, "index.html"), "utf8");
const scriptTag = /<script src="([^"]+)"><\/script>/g;
const sources = {};
for (const [, src] of html.matchAll(scriptTag)) {
  sources[src] = await readFile(join(root, src), "utf8");
}
html = html.replace(scriptTag, (_, src) => `<script>\n${sources[src].replace(/<\/script/gi, "<\\/script")}</script>`);

await mkdir(join(root, "dist"), { recursive: true });
await writeFile(join(root, "dist/index.html"), html);
console.log(`Wrote dist/index.html (${(html.length / 1024).toFixed(1)} KB)`);

// Page-body fragment for hosts that supply their own document skeleton
// (such as a claude.ai Artifact).
const fragment = html
  .replace(/<!doctype html>\s*/i, "")
  .replace(/<\/?(html|head|body)\b[^>]*>\s*/gi, "")
  .replace(/<meta charset="utf-8">\s*/i, "")
  .replace(/<meta name="viewport"[^>]*>\s*/i, "");
await writeFile(join(root, "dist/fragment.html"), fragment);
