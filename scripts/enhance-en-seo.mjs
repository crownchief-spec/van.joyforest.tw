#!/usr/bin/env node
/**
 * Strengthen Taiwan / Taipei SEO on all /en/ HTML pages (titles, descriptions, keywords).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EN_PAGE_SEO_OVERRIDES,
  EN_SEO_KEYWORDS,
  enhanceEnDescription,
  enhanceEnTitle,
  escapeHtml
} from "./en-seo-helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EN_DIR = path.resolve(__dirname, "..", "en");

async function walkHtml(dir, base = "") {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await walkHtml(path.join(dir, e.name), rel)));
    else if (e.isFile() && e.name.endsWith(".html")) out.push(rel);
  }
  return out;
}

const readTitle = (html) => {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  return m ? m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"') : "";
};

const readMetaDescription = (html) => {
  const m =
    html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) ||
    html.match(/<meta\s+name="description"\s+content='([^']*)'/i) ||
    html.match(/<meta\s+[^>]*name="description"[^>]*content="([^"]*)"/is);
  if (!m) return "";
  return m[1]
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
};

const setTitle = (html, title) => html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);

const setMetaName = (html, name, content) => {
  const val = escapeHtml(content);
  const patterns = [
    new RegExp(`(<meta\\s+name="${name}"\\s+content=")([^"]*)(")`, "i"),
    new RegExp(`(<meta\\s+\\n\\s*name="${name}"\\s*\\n\\s*content=")([^"]*)(")`, "is")
  ];
  for (const re of patterns) {
    if (re.test(html)) return html.replace(re, `$1${val}$3`);
  }
  if (name === "keywords") {
    const descRe = /(<meta\s+name="description"[^>]*\/?>)/i;
    if (descRe.test(html)) return html.replace(descRe, `$1\n    <meta name="keywords" content="${val}" />`);
  }
  return html;
};

const setOgOrTwitter = (html, prop, content) => {
  const val = escapeHtml(content);
  const re = new RegExp(`(<meta\\s+(?:property|name)="${prop}"\\s+content=")([^"]*)(")`, "i");
  if (re.test(html)) return html.replace(re, `$1${val}$3`);
  const re2 = new RegExp(`(<meta\\s+\\n\\s*(?:property|name)="${prop}"\\s*\\n\\s*content=")([^"]*)(")`, "is");
  if (re2.test(html)) return html.replace(re2, `$1${val}$3`);
  return html;
};

function enhanceHtml(html, relPath) {
  const override = EN_PAGE_SEO_OVERRIDES[relPath];
  const title = override?.title ?? enhanceEnTitle(readTitle(html));
  const description = override?.description ?? enhanceEnDescription(readMetaDescription(html));
  const keywords = override?.keywords ?? EN_SEO_KEYWORDS;

  let next = setTitle(html, title);
  next = setMetaName(next, "description", description);
  next = setMetaName(next, "keywords", keywords);
  next = setOgOrTwitter(next, "og:title", title);
  next = setOgOrTwitter(next, "og:description", description);
  next = setOgOrTwitter(next, "twitter:title", title);
  next = setOgOrTwitter(next, "twitter:description", description);
  return next;
}

async function main() {
  const files = await walkHtml(EN_DIR);
  let patched = 0;
  for (const rel of files) {
    if (rel === "booking/index.html") continue;
    const full = path.join(EN_DIR, rel);
    const html = await fs.readFile(full, "utf8");
    const next = enhanceHtml(html, rel);
    if (next !== html) {
      await fs.writeFile(full, next, "utf8");
      patched++;
      console.log("[enhance-en-seo]", rel);
    }
  }
  console.log("[enhance-en-seo] Done:", patched, "files updated");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
