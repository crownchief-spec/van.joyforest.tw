#!/usr/bin/env node
/**
 * SEO acceptance checks for van.joyforest.tw
 * Run against local files (default) or live site with --live
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SITE_ORIGIN, toCanonicalUrl, toCleanPath } from "./seo-url-helpers.mjs";
import sharp from "sharp";

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

  const meta = (key) =>
    html.match(new RegExp(`<meta\\s+(?:name|property)="${key}"\\s+content="([^"]*)"`, "i"))?.[1] || "";
  const noindex = /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html);
  const isRedirect = /<meta\s+http-equiv="refresh"/i.test(html) || /location\.replace\s*\(/i.test(html);
  const indexable = !noindex && !isRedirect && !rel.includes("404");
  if (/content="[^"\n]*<meta/i.test(html)) fail(`Malformed nested meta tag: ${rel}`);

  const canonicalM = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i);
  const canonical = canonicalM?.[1];
  if (!canonical) {
    if (!rel.includes("404") && !rel.includes("guide")) fail(`Missing canonical: ${rel}`);
    return;
  }
  if (canonical.includes(".html")) fail(`Canonical has .html: ${rel} → ${canonical}`);
  if (canonical !== url) fail(`Canonical mismatch: ${rel} canonical=${canonical} expected=${url}`);
  else pass(`Canonical OK: ${pagePath}`);

  if (indexable) {
    const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
    const description = meta("description");
    const lang = html.match(/<html\s+lang="([^"]+)"/i)?.[1] || "";
    if (!title) fail(`Missing title: ${rel}`);
    if (!description) fail(`Missing description: ${rel}`);
    if (rel.startsWith("en/") ? lang !== "en" : lang !== "zh-Hant") {
      fail(`Incorrect html lang (${lang || "missing"}): ${rel}`);
    }
    for (const key of ["og:title", "og:description", "og:url", "og:type", "og:image"]) {
      const count = [...html.matchAll(new RegExp(`(?:name|property)="${key}"`, "gi"))].length;
      if (!meta(key)) fail(`Missing ${key}: ${rel}`);
      if (count !== 1) fail(`${key} count ${count}, expected 1: ${rel}`);
    }
    for (const key of ["twitter:card", "twitter:title", "twitter:description", "twitter:image"]) {
      const count = [...html.matchAll(new RegExp(`(?:name|property)="${key}"`, "gi"))].length;
      if (!meta(key)) fail(`Missing ${key}: ${rel}`);
      if (count !== 1) fail(`${key} count ${count}, expected 1: ${rel}`);
    }
    const descriptionCount = [...html.matchAll(/<meta\s+name="description"/gi)].length;
    if (descriptionCount !== 1) fail(`description count ${descriptionCount}, expected 1: ${rel}`);
    if (meta("twitter:card") !== "summary_large_image") fail(`Wrong twitter:card: ${rel}`);
    if (meta("og:url") !== canonical) fail(`og:url differs from canonical: ${rel}`);
    if (!html.includes('name="theme-color"')) fail(`Missing theme-color: ${rel}`);
    if (!html.includes('rel="manifest"')) fail(`Missing manifest link: ${rel}`);
    if (!html.includes('href="/favicon.ico"')) fail(`Missing favicon.ico link: ${rel}`);
    if (!html.includes('href="/assets/images/shared/favicon.svg"')) fail(`Missing SVG favicon link: ${rel}`);
    if (!html.includes('rel="apple-touch-icon"')) fail(`Missing apple-touch-icon: ${rel}`);
  }

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

  const ldBlocks = [...html.matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  const schemaTypes = new Set();
  for (const [, json] of ldBlocks) {
    try {
      const parsed = JSON.parse(json);
      const collect = (value) => {
        if (!value || typeof value !== "object") return;
        if (typeof value["@type"] === "string") schemaTypes.add(value["@type"]);
        for (const nested of Object.values(value)) {
          if (Array.isArray(nested)) nested.forEach(collect);
          else collect(nested);
        }
      };
      collect(parsed);
      if (json.includes(".html")) fail(`JSON-LD .html URL in ${rel}`);
    } catch {
      fail(`Invalid JSON-LD in ${rel}`);
    }
  }
  if (indexable && !schemaTypes.has("WebPage")) fail(`Missing WebPage schema: ${rel}`);

  const headings = [...html.matchAll(/<h([1-6])\b[^>]*>/gi)].map((m) => Number(m[1]));
  for (let i = 1; indexable && i < headings.length; i++) {
    if (headings[i] > headings[i - 1] + 1) warn(`Heading level jump h${headings[i - 1]}→h${headings[i]}: ${rel}`);
  }

  const images = [...html.matchAll(/<img\b[^>]*>/gi)];
  for (const match of images) {
    const tag = match[0];
    if (!/\salt="[^"]*"/i.test(tag)) fail(`Image missing alt: ${rel}`);
    if (!/\swidth="\d+"/i.test(tag) || !/\sheight="\d+"/i.test(tag)) {
      fail(`Image missing intrinsic width/height: ${rel}`);
    }
    if (/class="[^"]*(?:hero|trip-article-cover)[^"]*"/i.test(tag) && /\sloading="lazy"/i.test(tag)) {
      fail(`Hero image must not be lazy-loaded: ${rel}`);
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

async function checkOgImages() {
  const files = await walkHtml(ROOT);
  const ogMap = new Map();
  let missing = 0;
  for (const rel of files) {
    if (rel.startsWith("components/") || rel.includes("404") || rel.includes("guide.html") || rel.includes("faq.html") || rel.includes("booking/index")) continue;
    const html = await fs.readFile(path.join(ROOT, rel), "utf8");
    if (/noindex/i.test(html)) continue;
    const og = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)?.[1];
    const tw = html.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"/i)?.[1];
    if (!og) {
      missing++;
      fail(`Missing og:image: ${rel}`);
      continue;
    }
    if (!og.startsWith("https://van.joyforest.tw/")) fail(`og:image not absolute: ${rel}`);
    if (!tw) fail(`Missing twitter:image: ${rel}`);
    else if (tw !== og) fail(`twitter:image differs from og:image: ${rel}`);
    if (!og.includes("/assets/images/og/")) fail(`og:image is not a dedicated page asset: ${rel}`);
    if (!LIVE) {
      const imagePath = path.join(ROOT, decodeURIComponent(new URL(og).pathname.replace(/^\/+/, "")));
      try {
        const meta = await sharp(imagePath).metadata();
        if (meta.width !== 1200 || meta.height !== 630) {
          fail(`og:image must be 1200x630: ${rel} (${meta.width}x${meta.height})`);
        }
      } catch {
        fail(`og:image file missing or unreadable: ${rel} → ${og}`);
      }
    }
    if (!ogMap.has(og)) ogMap.set(og, []);
    ogMap.get(og).push(rel);
  }
  const shared = [...ogMap.entries()].filter(([, arr]) => arr.length > 1);
  for (const [url, arr] of shared) {
    fail(`og:image shared by ${arr.length} pages: ${url} (${arr.join(", ")})`);
  }
  pass(`og:image present on indexable pages (missing: ${missing})`);
}

async function main() {
  console.log(`[validate-seo] Mode: ${LIVE ? "live" : "local files"}\n`);
  await checkSitemap();
  const files = await walkHtml(ROOT);
  for (const rel of files) {
    if (rel.startsWith("components/")) continue;
    if (rel.startsWith("components/")) continue;
    if (rel.includes("guide.html") || rel.includes("faq.html") || rel.includes("booking/index")) continue;
    await checkHtmlFile(rel);
  }
  await checkTitlesDescriptions();
  await checkOgImages();

  console.log(`\n=== PASS: ${results.pass.length} ===`);
  console.log(`=== FAIL: ${results.fail.length} ===`);
  console.log(`=== WARN: ${results.warn.length} ===`);
  if (results.warn.length) {
    console.log("\nWarnings:");
    results.warn.slice(0, 40).forEach((item) => console.log("  !", item));
  }
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
