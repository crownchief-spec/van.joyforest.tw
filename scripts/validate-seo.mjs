#!/usr/bin/env node
/**
 * SEO acceptance checks for van.joyforest.tw
 * Run against local files (default) or live site with --live
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SITE_ORIGIN, toCanonicalUrl, toCleanPath } from "./seo-url-helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const LIVE = process.argv.includes("--live");
const BASE = LIVE ? SITE_ORIGIN : null;

const results = { pass: [], fail: [], warn: [] };
const pass = (m) => results.pass.push(m);
const fail = (m) => results.fail.push(m);
const warn = (m) => results.warn.push(m);

async function walkHtml(dir, base = "") {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      out.push(...(await walkHtml(path.join(dir, e.name), rel)));
    } else if (e.isFile() && e.name.endsWith(".html")) {
      out.push(rel);
    }
  }
  return out;
}

function fileToPath(rel) {
  if (rel === "index.html") return "/";
  if (rel === "en/index.html") return "/en/";
  if (rel.endsWith("/index.html")) {
    const dir = rel.slice(0, -"/index.html".length);
    return toCleanPath(`/${dir}/`);
  }
  return toCleanPath(`/${rel}`);
}

async function fetchText(urlPath) {
  const url = `${BASE}${urlPath}`;
  const res = await fetch(url, { redirect: "manual" });
  return { status: res.status, headers: res.headers, html: await res.text(), url };
}

async function readLocal(rel) {
  const html = await fs.readFile(path.join(ROOT, rel), "utf8");
  return { status: 200, html, url: toCanonicalUrl(fileToPath(rel)) };
}

async function checkSitemap() {
  const xml = await fs.readFile(path.join(ROOT, "sitemap.xml"), "utf8");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  let redirectCount = 0;
  let badCanonical = 0;

  for (const loc of locs) {
    if (loc.includes(".html")) {
      fail(`Sitemap contains .html URL: ${loc}`);
      continue;
    }
    if (LIVE) {
      const res = await fetch(loc, { redirect: "manual" });
      if (res.status >= 300 && res.status < 400) {
        redirectCount++;
        fail(`Sitemap URL redirects (${res.status}): ${loc}`);
      } else if (res.status !== 200) {
        fail(`Sitemap URL not 200 (${res.status}): ${loc}`);
      }
    } else {
      pass(`Sitemap URL format OK: ${loc}`);
    }
  }

  if (redirectCount === 0 && !locs.some((l) => l.includes(".html"))) {
    pass(`Sitemap: ${locs.length} URLs, 0 .html entries`);
  }
  return { locs, badCanonical };
}

async function checkHtmlFile(rel) {
  if (rel.startsWith("components/")) return;
  const pagePath = fileToPath(rel);
  const { html, url } = LIVE ? await fetchText(pagePath) : await readLocal(rel);

  const canonicalM = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i);
  const canonical = canonicalM?.[1];
  if (!canonical) {
    if (!rel.includes("404") && !rel.includes("guide")) fail(`Missing canonical: ${rel}`);
    return;
  }
  if (canonical.includes(".html")) fail(`Canonical has .html: ${rel} → ${canonical}`);
  if (canonical !== url) fail(`Canonical mismatch: ${rel} canonical=${canonical} expected=${url}`);
  else pass(`Canonical OK: ${pagePath}`);

  const h1s = [...html.matchAll(/<h1\b[^>]*>/gi)];
  if (h1s.length !== 1) fail(`H1 count ${h1s.length}: ${rel}`);
  else pass(`H1 count OK: ${rel}`);

  const hrefs = [...html.matchAll(/\bhref="([^"]+)"/gi)].map((m) => m[1]);
  for (const href of hrefs) {
    const pathPart = href.split("#")[0];
    if (!pathPart.includes("van.joyforest.tw") && !pathPart.startsWith("/")) continue;
    if (pathPart.endsWith(".html") || pathPart.includes("/index.html")) {
      fail(`Internal .html href in ${rel}: ${href}`);
    }
  }

  const hreflangs = [...html.matchAll(/<link\s+rel="alternate"\s+hreflang="([^"]+)"\s+href="([^"]+)"/gi)];
  if (hreflangs.length > 0) {
    for (const [, , href] of hreflangs) {
      if (href.includes(".html")) fail(`hreflang .html in ${rel}: ${href}`);
    }
    const langs = hreflangs.map((m) => m[1]);
    if (!langs.includes("zh-Hant") || !langs.includes("en") || !langs.includes("x-default")) {
      warn(`Incomplete hreflang trio in ${rel}`);
    }
  }

  const ldBlocks = [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  for (const [, json] of ldBlocks) {
    try {
      JSON.parse(json);
      if (json.includes(".html")) fail(`JSON-LD .html URL in ${rel}`);
    } catch {
      fail(`Invalid JSON-LD in ${rel}`);
    }
  }
}

async function checkTitlesDescriptions() {
  const files = await walkHtml(ROOT);
  const titles = new Map();
  const descs = new Map();
  for (const rel of files) {
    if (rel.includes("404") || rel.includes("guide")) continue;
    const html = await fs.readFile(path.join(ROOT, rel), "utf8");
    const t = html.match(/<title>([^<]*)<\/title>/i)?.[1];
    const d = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1];
    if (t) {
      if (titles.has(t)) fail(`Duplicate title: "${t}" in ${rel} and ${titles.get(t)}`);
      else titles.set(t, rel);
    }
    if (d) {
      if (descs.has(d)) fail(`Duplicate description in ${rel} and ${descs.get(d)}`);
      else descs.set(d, rel);
    }
  }
  pass(`Unique titles: ${titles.size}, descriptions: ${descs.size}`);
}

async function main() {
  console.log(`[validate-seo] Mode: ${LIVE ? "live" : "local files"}\n`);
  await checkSitemap();
  const files = await walkHtml(ROOT);
  for (const rel of files) {
    if (rel.includes("guide.html") || rel.includes("booking/index")) continue;
    await checkHtmlFile(rel);
  }
  await checkTitlesDescriptions();

  console.log(`\n=== PASS: ${results.pass.length} ===`);
  console.log(`=== FAIL: ${results.fail.length} ===`);
  console.log(`=== WARN: ${results.warn.length} ===`);
  if (results.fail.length) {
    console.log("\nFailures:");
    results.fail.slice(0, 40).forEach((f) => console.log("  ✗", f));
    if (results.fail.length > 40) console.log(`  … and ${results.fail.length - 40} more`);
    process.exit(1);
  }
  console.log("\nAll checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
