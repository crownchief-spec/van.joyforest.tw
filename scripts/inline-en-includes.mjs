#!/usr/bin/env node
/**
 * Bake English header/footer into all /en/ HTML pages so they never depend on
 * runtime fetch (avoids wrong-language includes on Cloudflare).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const EN_DIR = path.join(ROOT, "en");
const HEADER = path.join(ROOT, "components", "header-en.html");
const FOOTER = path.join(ROOT, "components", "footer-en.html");

const HEADER_PLACEHOLDER = '<div data-site-include="header"></div>';
const FOOTER_PLACEHOLDER = '<div data-site-include="footer"></div>';
const HEADER_RE = /<header class="site-header"[\s\S]*?<\/header>/;
const FOOTER_RE = /<footer class="site-footer">[\s\S]*?<\/footer>/;

async function walkHtml(dir, base = "") {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await walkHtml(path.join(dir, e.name), rel)));
    else if (e.isFile() && e.name.endsWith(".html")) out.push(rel);
  }
  return out;
}

function syncEnIncludes(html, headerBlock, footerBlock) {
  let next = html.replace(HEADER_PLACEHOLDER, headerBlock).replace(FOOTER_PLACEHOLDER, footerBlock);
  if (HEADER_RE.test(next)) next = next.replace(HEADER_RE, headerBlock);
  if (FOOTER_RE.test(next)) next = next.replace(FOOTER_RE, footerBlock);
  return next;
}

async function main() {
  const [headerHtml, footerHtml] = await Promise.all([
    fs.readFile(HEADER, "utf8"),
    fs.readFile(FOOTER, "utf8")
  ]);
  const headerBlock = headerHtml.trim();
  const footerBlock = footerHtml.trim();

  const files = await walkHtml(EN_DIR);
  let patched = 0;
  for (const rel of files) {
    if (rel === "booking/index.html") continue;
    const full = path.join(EN_DIR, rel);
    let html = await fs.readFile(full, "utf8");
    const next = syncEnIncludes(html, headerBlock, footerBlock);
    if (next !== html) {
      await fs.writeFile(full, next, "utf8");
      patched++;
      console.log("[inline-en-includes]", rel);
    }
  }
  console.log("[inline-en-includes] Done:", patched, "files updated");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
