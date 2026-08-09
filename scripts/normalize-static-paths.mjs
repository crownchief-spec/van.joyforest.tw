#!/usr/bin/env node
/** Normalize shared static assets to root-relative URLs so nested English pages resolve correctly. */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
async function walkHtml(dir, out = []) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) await walkHtml(target, out);
    else if (entry.isFile() && entry.name.endsWith(".html")) out.push(target);
  }
  return out;
}

function cleanInternalHtmlLinks(html) {
  return html.replace(
    /href="((?:https:\/\/van\.joyforest\.tw)?\/[^"#?]+)\.html([#?][^"]*)?"/gi,
    (_match, base, suffix = "") => {
      const clean = base.endsWith("/index") ? `${base.slice(0, -"/index".length)}/` : base;
      return `href="${clean}${suffix}"`;
    }
  );
}

async function main() {
  let changed = 0;
  for (const file of await walkHtml(ROOT)) {
    const html = await fs.readFile(file, "utf8");
    let next = cleanInternalHtmlLinks(html);
    if (file.startsWith(path.join(ROOT, "en", "pages", "resources"))) {
      next = next
        .replaceAll("../../assets/", "/assets/")
        .replaceAll("../../images/", "/images/");
    }
    if (next !== html) {
      await fs.writeFile(file, next, "utf8");
      changed++;
    }
  }
  console.log(`[normalize-static-paths] Updated ${changed} HTML files`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
