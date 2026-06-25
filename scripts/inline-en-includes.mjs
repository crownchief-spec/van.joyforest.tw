#!/usr/bin/env node
/**
 * Bake English header/footer into all /en/ HTML pages so they never depend on
 * runtime fetch (avoids wrong-language includes on Cloudflare).
 * Also bakes two English customer stories per page (no JS fetch).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const EN_DIR = path.join(ROOT, "en");
const HEADER = path.join(ROOT, "components", "header-en.html");
const FOOTER = path.join(ROOT, "components", "footer-en.html");
const EN_ARTICLES_JSON = path.join(ROOT, "assets", "data", "trip-stories-articles-en.json");

const HEADER_PLACEHOLDER = '<div data-site-include="header"></div>';
const FOOTER_PLACEHOLDER = '<div data-site-include="footer"></div>';
const HEADER_RE = /<header class="site-header"[\s\S]*?<\/header>/;
const FOOTER_RE = /<footer class="site-footer">[\s\S]*?<\/footer>/;
const FOOTER_TRIP_STORY_RE = /<div class="footer-trip-story-random"[\s\S]*?<\/ul>\s*<\/div>/;

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const clipFooterSummary = (text, maxChars = 88) => {
  const t = String(text ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (t.length <= maxChars) return t;
  return t.slice(0, maxChars).trimEnd() + "…";
};

const seedHash = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const pickTwoSeeded = (items, seed) => {
  const copy = items.slice();
  let s = seed;
  for (let i = copy.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) >>> 0;
    const j = s % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(2, copy.length));
};

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

function bakeFooterTripStorySlot(article) {
  const title = (article.title || article.slug || "").trim();
  const summary = clipFooterSummary(article.description || "");
  const category = (article.category || "").trim();
  const url = ((article.url || `/en/trip-stories/${article.slug}/`) + "").trim();
  const imgPath = (article.listVideoPoster || article.listImage || article.coverImage || "").trim();
  const imgAlt = (article.listImageAlt || article.coverImageAlt || title || "").trim();
  const thumb = imgPath
    ? `<span class="footer-trip-story-random__thumb">
              <img data-footer-trip-story-img src="${escapeHtml(imgPath)}" alt="${escapeHtml(imgAlt)}" width="132" height="88" loading="lazy" decoding="async" />
            </span>`
    : `<span class="footer-trip-story-random__thumb" hidden>
              <img data-footer-trip-story-img alt="" width="132" height="88" loading="lazy" decoding="async" />
            </span>`;
  const catHidden = category ? "" : ' hidden';
  return `        <li class="footer-trip-story-random__item" data-footer-trip-story-slot>
          <a class="footer-trip-story-random__link" data-footer-trip-story-link href="${escapeHtml(url)}" aria-label="${escapeHtml(`${title}。${summary}`)}">
            ${thumb}
            <span class="footer-trip-story-random__copy">
              <span class="footer-trip-story-random__category" data-footer-trip-story-category${catHidden}>${escapeHtml(category)}</span>
              <span class="footer-trip-story-random__title" data-footer-trip-story-title>${escapeHtml(title)}</span>
              <span class="footer-trip-story-random__summary" data-footer-trip-story-summary>${escapeHtml(summary)}</span>
              <span class="footer-trip-story-random__more">Read more</span>
            </span>
          </a>
        </li>`;
}

function bakeFooterTripStories(html, articles, relPath) {
  const valid = articles.filter(
    (a) => a && (a.slug || "").trim() && (a.url || "").trim().startsWith("/en/")
  );
  if (!valid.length || !FOOTER_TRIP_STORY_RE.test(html)) return html;
  const picks = pickTwoSeeded(valid, seedHash(relPath));
  const slotsHtml = picks.map(bakeFooterTripStorySlot).join("\n");
  const block = `<div class="footer-trip-story-random" data-footer-trip-story data-footer-trip-story-lang="en" data-footer-trip-story-prefilled="true">
      <h3 class="footer-trip-story-random__heading">
        <a href="/en/pages/trip-ideas.html">Campervan customer stories</a>
      </h3>
      <ul class="footer-trip-story-random__list" role="list" aria-label="Two recommended campervan customer stories">
${slotsHtml}
      </ul>
    </div>`;
  return html.replace(FOOTER_TRIP_STORY_RE, block);
}

async function main() {
  const [headerHtml, footerHtml, articlesRaw] = await Promise.all([
    fs.readFile(HEADER, "utf8"),
    fs.readFile(FOOTER, "utf8"),
    fs.readFile(EN_ARTICLES_JSON, "utf8")
  ]);
  const headerBlock = headerHtml.trim();
  const footerBlock = footerHtml.trim();
  const articles = JSON.parse(articlesRaw).articles || [];

  const files = await walkHtml(EN_DIR);
  let patched = 0;
  for (const rel of files) {
    if (rel === "booking/index.html") continue;
    const full = path.join(EN_DIR, rel);
    let html = await fs.readFile(full, "utf8");
    let next = syncEnIncludes(html, headerBlock, footerBlock);
    next = bakeFooterTripStories(next, articles, rel);
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
