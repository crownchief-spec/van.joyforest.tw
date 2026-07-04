#!/usr/bin/env node
/**
 * Add English language switch button to Chinese pages only.
 * Does not modify en/ pages or pages that already have btn-lang.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zhLangSwitchHtml, zhPathToEn } from "./i18n-helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SKIP_FILES = new Set([
  "components/header.html",
  "components/footer.html",
  "components/header-en.html",
  "components/footer-en.html"
]);

const fileToPublicPath = (rel) => {
  const norm = rel.replace(/\\/g, "/");
  if (norm === "index.html") return "/";
  if (norm.endsWith("/")) {
    const dir = norm.slice(0, -"/".length);
    return `/${dir}/`;
  }
  return `/${norm}`;
};

async function walkHtml(dir, base = "") {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (rel === "en" || rel.startsWith("en/")) continue;
      out.push(...(await walkHtml(path.join(dir, e.name), rel)));
    } else if (e.isFile() && e.name.endsWith(".html") && !SKIP_FILES.has(rel)) {
      out.push(rel);
    }
  }
  return out;
};

const patchHero = (html, publicPath) => {
  const btn = zhLangSwitchHtml(publicPath);
  if (html.includes("btn-lang")) return html;

  const heroMatch = html.match(/<section[^>]*class="[^"]*\bhero\b[^"]*"[\s\S]*?<\/section>/);
  if (heroMatch) {
    const hero = heroMatch[0];
    const actionsMatch = hero.match(/<div class="hero-actions"[^>]*>[\s\S]*?<\/div>/);
    if (actionsMatch) {
      const patchedHero = hero.replace(
        actionsMatch[0],
        actionsMatch[0].replace(/<\/div>\s*$/, `\n            ${btn}\n          </div>`)
      );
      return html.replace(hero, patchedHero);
    }
    const patchedHero = hero.replace(
      /(<p class="lead">[\s\S]*?<\/p>\s*)(<\/div>\s*\n\s*<\/div>\s*\n\s*<\/section>)/,
      `$1          <div class="hero-actions" role="group" aria-label="Language">\n            ${btn}\n          </div>\n        $2`
    );
    if (patchedHero !== hero) return html.replace(hero, patchedHero);
  }

  if (html.includes("trip-article-hero")) {
    const block = `          <div class="trip-article-hero-actions">
            <div class="hero-actions" role="group" aria-label="Language">
              ${btn}
            </div>
          </div>
        </div>`;
    if (!html.includes("trip-article-hero-actions")) {
      const patched = html.replace(
        /(<div class="trip-article-hero__stats">[\s\S]*?<\/div>\s*)\n(\s*<\/div>\s*\n\s*<div class="trip-article-cover-wrap">)/,
        `$1\n${block}\n$2`
      );
      if (patched !== html) return patched;
    }
  }

  if (html.includes("booking-page-intro")) {
    const block = `          <div class="hero-lang-switch" role="group" aria-label="Language">
            ${btn}
          </div>`;
    if (!html.includes("hero-lang-switch")) {
      return html.replace(/(<\/p>\s*\n\s*<\/header>)/, `\n${block}\n        $1`);
    }
  }

  if (html.includes("<h1>404") || html.includes("頁面不存在")) {
    const block = `<p class="hero-lang-switch"><a class="btn btn-lang" href="${zhPathToEn(publicPath)}" lang="en" hreflang="en">English</a></p>`;
    return html.replace(/(<p><a class="btn btn-primary" href="\/">返回首頁<\/a><\/p>)/, `$1\n        ${block}`);
  }

  return html;
};

async function main() {
  const files = await walkHtml(ROOT);
  let patched = 0;
  for (const rel of files) {
    const full = path.join(ROOT, rel);
    const publicPath = fileToPublicPath(rel);
    let html = await fs.readFile(full, "utf8");
    const next = patchHero(html, publicPath);
    if (next !== html) {
      await fs.writeFile(full, next, "utf8");
      patched++;
      console.log("[add-zh-lang-switch]", rel);
    }
  }
  console.log("[add-zh-lang-switch] Done:", patched, "files patched");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
