#!/usr/bin/env node
/** Repair legacy meta blocks corrupted when dollar prices were interpreted as replacement groups. */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MAP_PATH = path.join(ROOT, "seo-map.json");
const ORIGIN = "https://van.joyforest.tw";

const escape = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function alternateLinks(file, canonical) {
  const isEnglish = file.startsWith("en/");
  const counterpart = isEnglish
    ? canonical.replace(`${ORIGIN}/en/`, `${ORIGIN}/`)
    : canonical === `${ORIGIN}/`
      ? `${ORIGIN}/en/`
      : canonical.replace(`${ORIGIN}/`, `${ORIGIN}/en/`);
  const zh = isEnglish ? counterpart : canonical;
  const en = isEnglish ? canonical : counterpart;
  return [
    `<link rel="alternate" hreflang="zh-Hant" href="${escape(zh)}" />`,
    `<link rel="alternate" hreflang="en" href="${escape(en)}" />`,
    `<link rel="alternate" hreflang="x-default" href="${escape(zh)}" />`
  ].join("\n    ");
}

function cleanBlock(page) {
  const brand = page.file.startsWith("en/") ? "Joyforest Campervan Rental" : "揪好森露營車出租";
  const locale = page.file.startsWith("en/") ? "en_US" : "zh_TW";
  const ogType = page.file.includes("trip-stories/") || page.file.includes("pages/resources/") ? "article" : "website";
  return `    <title>${escape(page.title)}</title>
    <meta name="description" content="${escape(page.description)}" />
    <link rel="canonical" href="${escape(page.canonical)}" />
    ${alternateLinks(page.file, page.canonical)}
    <meta property="og:type" content="${ogType}" />
    <meta property="og:locale" content="${locale}" />
    <meta property="og:site_name" content="${escape(brand)}" />
    <meta property="og:title" content="${escape(page.title)}" />
    <meta property="og:description" content="${escape(page.description)}" />
    <meta property="og:url" content="${escape(page.canonical)}" />
    <meta property="og:image" content="${escape(page.ogImage)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escape(page.title)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escape(page.title)}" />
    <meta name="twitter:description" content="${escape(page.description)}" />
    <meta name="twitter:image" content="${escape(page.ogImage)}" />
    <meta name="twitter:image:alt" content="${escape(page.title)}" />

`;
}

async function main() {
  const map = JSON.parse(await fs.readFile(MAP_PATH, "utf8"));
  let repaired = 0;
  for (const page of map.pages || []) {
    const file = path.join(ROOT, page.file);
    const html = await fs.readFile(file, "utf8");
    const head = html.match(/<head>([\s\S]*?)<\/head>/i)?.[1] || "";
    if (!/content="[^"\n]*<meta/i.test(head)) continue;

    const start = html.indexOf("<title>");
    const end = html.indexOf('<link rel="icon" href="/favicon.ico"');
    if (start < 0 || end <= start) {
      throw new Error(`Cannot isolate malformed SEO block: ${page.file}`);
    }
    const next = `${html.slice(0, start)}${cleanBlock(page)}    ${html.slice(end)}`;
    await fs.writeFile(file, next, "utf8");
    repaired++;
  }
  console.log(`[repair-malformed-seo] Repaired ${repaired} HTML files`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
