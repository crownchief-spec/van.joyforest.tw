#!/usr/bin/env node
/**
 * Migrate internal links, canonical, og:url, JSON-LD URLs to clean paths (no .html).
 * Adds reciprocal hreflang to Chinese pages that have English pairs.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SITE_ORIGIN,
  toCanonicalUrl,
  toCleanPath,
  resolveHrefToCleanPath
} from "./seo-url-helpers.mjs";
import { hreflangHeadHtml, zhPathToEn, enPathToZh } from "./i18n-helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SKIP_FILES = new Set([
  "pages/guide.html",
  "booking/index.html",
  "en/booking/index.html"
]);

const TEXT_EXTENSIONS = new Set([".html", ".json", ".js", ".mjs", ".xml", ".md"]);

async function walkFiles(dir, base = "") {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const rel = base ? `${base}/${e.name}` : e.name;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (rel === "node_modules" || rel === ".git") continue;
      out.push(...(await walkFiles(full, rel)));
    } else if (TEXT_EXTENSIONS.has(path.extname(e.name))) {
      out.push(rel);
    }
  }
  return out;
}

async function enPairExists(zhPath) {
  const enPath = zhPathToEn(zhPath);
  const enFile = enPath === "/en/"
    ? "en/index.html"
    : enPath.endsWith("/")
      ? `en${enPath.slice(3)}index.html`
      : `en${enPath.slice(3)}.html`;
  try {
    await fs.access(path.join(ROOT, enFile));
    return true;
  } catch {
    return false;
  }
}

function pagePathFromFile(relFile) {
  if (relFile === "index.html") return "/";
  if (relFile === "en/index.html") return "/en/";
  if (relFile.endsWith("/index.html")) {
    const dir = relFile.slice(0, -"/index.html".length);
    return toCleanPath(`/${dir}/`);
  }
  return toCleanPath(`/${relFile}`);
}

function replaceInternalHrefs(html, relFile) {
  return html.replace(/\b(href|src)=(["'])([^"'#]+(?:#[^"']*)?)\2/gi, (match, attr, quote, href) => {
    if (!href.includes(".html")) return match;
    if (href.startsWith("http") && !href.includes("van.joyforest.tw")) return match;
    const clean = resolveHrefToCleanPath(href, relFile);
    if (clean === href) return match;
    return `${attr}=${quote}${clean}${quote}`;
  });
}

function replaceCanonicalAndOg(html, pagePath) {
  const canonical = toCanonicalUrl(pagePath);
  let next = html.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${canonical}" />`
  );
  next = next.replace(
    /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:url" content="${canonical}" />`
  );
  return next;
}

function replaceJsonLdUrls(html) {
  return html.replace(/https:\/\/van\.joyforest\.tw[^"'\s]*/g, (url) => {
    if (!url.includes(".html") && !url.endsWith("/index.html")) return url;
    return toCanonicalUrl(url);
  });
}

function injectHreflang(html, pagePath, lang) {
  const hreflangBlock =
    lang === "zh"
      ? hreflangHeadHtml({
          zhCanonical: toCanonicalUrl(pagePath),
          enCanonical: toCanonicalUrl(zhPathToEn(pagePath))
        })
      : hreflangHeadHtml({
          zhCanonical: toCanonicalUrl(enPathToZh(pagePath)),
          enCanonical: toCanonicalUrl(pagePath)
        });

  if (/rel="alternate"\s+hreflang="zh-Hant"/i.test(html)) {
    return html.replace(
      /<link\s+rel="alternate"\s+hreflang="zh-Hant"[^>]*>\s*\n?\s*<link\s+rel="alternate"\s+hreflang="en"[^>]*>\s*\n?\s*<link\s+rel="alternate"\s+hreflang="x-default"[^>]*>/i,
      hreflangBlock.trim()
    );
  }

  return html.replace(
    /(<link\s+rel="canonical"[^>]*>\s*\n?)/i,
    `$1${hreflangBlock}\n`
  );
}

function shouldSkipHreflang(relFile, pagePath) {
  if (SKIP_FILES.has(relFile)) return true;
  if (relFile === "404.html" || relFile === "en/404.html") return true;
  if (pagePath.startsWith("/en")) return false;
  return false;
}

async function processHtml(relFile) {
  if (SKIP_FILES.has(relFile)) return { relFile, changed: false, skipped: true };
  const full = path.join(ROOT, relFile);
  let html = await fs.readFile(full, "utf8");
  const pagePath = pagePathFromFile(relFile);
  const lang = pagePath.startsWith("/en") ? "en" : "zh";

  let next = replaceInternalHrefs(html, relFile);
  next = replaceCanonicalAndOg(next, pagePath);
  next = replaceJsonLdUrls(next);

  if (!shouldSkipHreflang(relFile, pagePath)) {
    if (lang === "en" || (lang === "zh" && (await enPairExists(pagePath)))) {
      next = injectHreflang(next, pagePath, lang);
    }
  }

  if (next !== html) {
    await fs.writeFile(full, next, "utf8");
    return { relFile, changed: true };
  }
  return { relFile, changed: false };
}

async function processJsonOrJs(relFile) {
  const full = path.join(ROOT, relFile);
  let text = await fs.readFile(full, "utf8");
  if (!text.includes(".html")) return { relFile, changed: false };

  const next = text
    .replace(/https:\/\/van\.joyforest\.tw\/[^"'\s]*\.html/g, (u) => toCanonicalUrl(u))
    .replace(/"(\/(?:en\/)?[^"]*\.html)"/g, (m, p) => `"${toCleanPath(p)}"`)
    .replace(/'(\/(?:en\/)?[^']*\.html)'/g, (m, p) => `'${toCleanPath(p)}'`);

  if (next !== text) {
    await fs.writeFile(full, next, "utf8");
    return { relFile, changed: true };
  }
  return { relFile, changed: false };
}

async function main() {
  const files = await walkFiles(ROOT);
  let changed = 0;

  for (const rel of files) {
    if (rel.endsWith(".html")) {
      const r = await processHtml(rel);
      if (r.changed) {
        changed++;
        console.log("[migrate]", rel);
      }
    } else if (
      (rel.endsWith(".json") || rel.endsWith(".js") || rel === "sitemap.xml") &&
      !rel.startsWith("scripts/")
    ) {
      const r = await processJsonOrJs(rel);
      if (r.changed) {
        changed++;
        console.log("[migrate]", rel);
      }
    }
  }

  console.log(`[migrate-clean-urls] Done: ${changed} files updated`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
