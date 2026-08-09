#!/usr/bin/env node
/**
 * Scan all HTML → merge seo-map.json → apply per-page SEO meta → write audit report
 * Usage: node scripts/seo-sync.mjs [--dry-run] [--map-only]
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyPageSeo,
  buildPageRecord,
  OG_IMAGE_OVERRIDES,
  SKIP_HTML,
  walkHtml,
  BRAND
} from "./seo-page-helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MAP_PATH = path.join(ROOT, "seo-map.json");
const REPORT_PATH = path.join(ROOT, "docs", "seo-audit-report.md");

const DRY = process.argv.includes("--dry-run");
const MAP_ONLY = process.argv.includes("--map-only");

async function main() {
  const mapRaw = JSON.parse(await fs.readFile(MAP_PATH, "utf8"));
  const mapByFile = new Map((mapRaw.pages || []).map((p) => [p.file, p]));

  const files = (await walkHtml(ROOT)).filter((f) => !SKIP_HTML.has(f));
  const records = [];

  for (const rel of files.sort()) {
    const html = await fs.readFile(path.join(ROOT, rel), "utf8");
    const record = buildPageRecord(rel, html, mapByFile.get(rel) || {});
    records.push(record);

    if (!MAP_ONLY && !DRY) {
      const brand = rel.startsWith("en/") ? BRAND.en : BRAND.zh;
      const next = applyPageSeo(html, record, brand);
      if (next !== html) {
        await fs.writeFile(path.join(ROOT, rel), next, "utf8");
      }
    }
  }

  const nextMap = {
    brand: mapRaw.brand || {
      name: BRAND.zh,
      domain: "https://van.joyforest.tw",
      themeColor: BRAND.themeColor,
      defaultLocale: "zh_TW",
      defaultLang: "zh-Hant"
    },
    ogImageStrategy: mapRaw.ogImageStrategy || {
      rule: "ogImage > heroImage > pageMainImage",
      preferredSize: "1200x630",
      mustBeAbsoluteUrl: true
    },
    pages: records.map(({ ogImageAlt, ogType, ...r }) => {
      const base = { ...r };
      const override = Boolean(OG_IMAGE_OVERRIDES[r.file]);
      if (override || (r.ogImage && r.heroImage && r.ogImage !== r.heroImage)) {
        base.ogImage = r.ogImage;
        base.ogImageOverride = true;
      } else {
        delete base.ogImage;
        delete base.ogImageOverride;
      }
      return base;
    }),
    todo: mapRaw.todo || []
  };

  if (!DRY) {
    await fs.writeFile(MAP_PATH, `${JSON.stringify(nextMap, null, 2)}\n`, "utf8");
  }

  await writeReport(records, files.length);

  const ogCounts = new Map();
  for (const r of records) {
    if (!r.ogImage || r.noindex) continue;
    ogCounts.set(r.ogImage, (ogCounts.get(r.ogImage) || 0) + 1);
  }
  const dupOg = [...ogCounts.entries()].filter(([, n]) => n > 2);

  console.log(`[seo-sync] Pages scanned: ${records.length}`);
  console.log(`[seo-sync] seo-map.json entries: ${nextMap.pages.length}`);
  if (dupOg.length) {
    console.log(`[seo-sync] WARN: og:image used on 3+ pages:`);
    dupOg.forEach(([url, n]) => console.log(`  (${n}) ${url}`));
  } else {
    console.log(`[seo-sync] No og:image shared by 3+ indexable pages`);
  }
  console.log(`[seo-sync] Report: ${REPORT_PATH}`);
  if (DRY) console.log("[seo-sync] Dry run — no files written");
}

async function writeReport(records, totalHtml) {
  const indexed = records.filter((r) => !r.noindex);
  const noOg = records.filter((r) => !r.noindex && !r.ogImage);
  const dupTitles = findDupes(records, "title");
  const dupDesc = findDupes(records, "description");
  const dupOg = findDupes(
    records.filter((r) => r.ogImage && !r.noindex),
    "ogImage"
  );
  const crossRouteDupOg = findCrossRouteDupOg(records);

  const lines = [
    "# SEO 維護總表（自動產生）",
    "",
    `產生時間：${new Date().toISOString().slice(0, 10)}`,
    "",
    "## 摘要",
    "",
    `- HTML 檔案總數：${totalHtml}`,
    `- seo-map 條目：${records.length}`,
    `- 可索引頁面：${indexed.length}`,
    `- 缺 og:image（可索引）：${noOg.length}`,
    "",
    "## 主要頁面 SEO 總表",
    "",
    "| page file | route | og:image | schema | noindex |",
    "| --- | --- | --- | --- | --- |",
    ...records
      .filter((r) => !r.file.includes("trip-stories/") || r.file.includes("family-beginner"))
      .slice(0, 40)
      .map(
        (r) =>
          `| ${r.file} | ${r.route} | ${short(r.ogImage)} | ${(r.schemaType || []).join(", ")} | ${r.noindex} |`
      ),
    "",
    "> 完整清單見根目錄 `seo-map.json`",
    "",
    "## 重複 og:image（≥2 頁，可索引）",
    "",
    dupOg.length
      ? dupOg.map(([v, files]) => `- \`${short(v)}\` → ${files.join(", ")}`).join("\n")
      : "- 無",
    "",
    "## 跨路由重複 og:image（排除僅中英對照）",
    "",
    crossRouteDupOg.length
      ? crossRouteDupOg
          .map(([v, routes]) => `- \`${short(v)}\` → ${[...routes].join(", ")}`)
          .join("\n")
      : "- 無",
    "",
    "## 重複 title",
    "",
    dupTitles.length
      ? dupTitles.map(([t, files]) => `- 「${t.slice(0, 40)}…」→ ${files.join(", ")}`).join("\n")
      : "- 無",
    "",
    "## 重複 description",
    "",
    dupDesc.length
      ? dupDesc.map(([d, files]) => `- ${files.join(", ")}`).join("\n")
      : "- 無",
    "",
    "## 缺 og:image / hero",
    "",
    noOg.length
      ? noOg.map((r) => `- ${r.file}`).join("\n")
      : "- 無",
    "",
    "## 維護說明",
    "",
    "1. 編輯 `seo-map.json` 中對應頁面的 `title`、`description`、`heroImage`、`noindex`",
    "2. 執行 `npm run seo:fix` 產生該頁獨立 1200×630 分享圖並同步 HTML head",
    "3. 流程會自動更新 sitemap、圖片尺寸與根路徑資源",
    "4. 流程最後會驗證站內連結、圖片、canonical、schema、OG 與 Twitter meta",
    ""
  ];

  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  if (!DRY) await fs.writeFile(REPORT_PATH, lines.join("\n"), "utf8");
}

function findCrossRouteDupOg(records) {
  const m = new Map();
  for (const r of records) {
    if (!r.ogImage || r.noindex) continue;
    const logical = r.file.replace(/^en\//, "");
    if (!m.has(r.ogImage)) m.set(r.ogImage, new Set());
    m.get(r.ogImage).add(logical);
  }
  return [...m.entries()].filter(([, routes]) => routes.size > 1);
}

function findDupes(records, key) {
  const m = new Map();
  for (const r of records) {
    const v = r[key];
    if (!v) continue;
    if (!m.has(v)) m.set(v, []);
    m.get(v).push(r.file);
  }
  return [...m.entries()].filter(([, files]) => files.length > 1);
}

function short(url) {
  if (!url) return "—";
  return url.replace("https://van.joyforest.tw", "").slice(0, 48);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
