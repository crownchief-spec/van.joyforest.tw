import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { marked } from "marked";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "content", "trip-stories");
const OUT_JSON = path.join(CONTENT_DIR, "articles.json");
const ASSETS_DATA_JSON = path.join(ROOT, "assets", "data", "trip-stories-articles.json");
const OUT_STORIES_DIR = path.join(ROOT, "trip-stories");
const SITEMAP = path.join(ROOT, "sitemap.xml");
const SITE_ORIGIN = "https://van.joyforest.tw";

import { hreflangHeadHtml, zhLangSwitchHtml } from "./i18n-helpers.mjs";

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const pickRelated = (all, currentSlug, limit = 3) => {
  const cur = all.find((a) => a.slug === currentSlug);
  if (!cur) return [];
  const others = all.filter((a) => a.slug !== currentSlug);
  const sameCat = others.filter((a) => a.category === cur.category);
  const rest = others.filter((a) => a.category !== cur.category);
  const merged = [...sameCat, ...rest];
  return merged.slice(0, limit);
};

const articlePageTemplate = ({
  slug,
  title,
  h1,
  description,
  heroLead,
  date,
  category,
  tags,
  coverImage,
  coverImageAlt,
  coverImageWidth,
  coverImageHeight,
  readingTime,
  bodyHtml,
  relatedHtml,
  jsonLd,
  wideBody,
  skipArticleCta,
  stylesheets = [],
  scripts = [],
  hasEnglish = true
}) => {
  const tagList = Array.isArray(tags) ? tags : [];
  const tagsMeta = tagList.map((t) => escapeHtml(t)).join("、");
  const displayH1 = h1 || title;
  const heroDesc = heroLead || description;
  const proseClass = wideBody
    ? "trip-article-prose trip-story-prose trip-article-prose--wide"
    : "trip-article-prose trip-story-prose";
  const extraStylesheetHtml = stylesheets
    .map((href) => `    <link rel="stylesheet" href="${escapeHtml(href)}" />`)
    .join("\n");
  const extraScriptHtml = scripts
    .map((src) => `    <script defer src="${escapeHtml(src)}"></script>`)
    .join("\n");
  const extraStylesheetBlock = extraStylesheetHtml ? `\n${extraStylesheetHtml}` : "";
  const extraScriptBlock = extraScriptHtml ? `\n${extraScriptHtml}` : "";
  return `<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#1f6b52" />
    <meta name="robots" content="index,follow,max-image-preview:large" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${SITE_ORIGIN}/trip-stories/${slug}/" />
${hasEnglish ? hreflangHeadHtml({ zhCanonical: `${SITE_ORIGIN}/trip-stories/${slug}/`, enCanonical: `${SITE_ORIGIN}/en/trip-stories/${slug}/` }) : ""}
    <meta property="og:type" content="article" />
    <meta property="og:locale" content="zh_TW" />
    <meta property="og:site_name" content="揪好森露營車出租" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${SITE_ORIGIN}/trip-stories/${slug}/" />
    <meta property="og:image" content="${SITE_ORIGIN}${coverImage}" />
    <meta property="og:image:width" content="${escapeHtml(coverImageWidth)}" />
    <meta property="og:image:height" content="${escapeHtml(coverImageHeight)}" />
    <meta property="og:image:alt" content="${escapeHtml(coverImageAlt || title)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${SITE_ORIGIN}${coverImage}" />
    <meta name="twitter:image:alt" content="${escapeHtml(coverImageAlt || title)}" />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="icon" href="/assets/images/shared/favicon.svg" type="image/svg+xml" />
    <link rel="icon" href="/assets/images/shared/joyforest-campervan-rental-logo-icon-64.png" type="image/png" sizes="64x64" />
    <link rel="apple-touch-icon" href="/assets/images/shared/joyforest-campervan-rental-logo-icon-180.png" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="preload" as="image" href="${escapeHtml(coverImage)}" fetchpriority="high" />
    <link rel="stylesheet" href="../../assets/css/style.css" />${extraStylesheetBlock}
    <script defer src="../../assets/js/main.js"></script>${extraScriptBlock}
    <script type="application/ld+json">${jsonLd}</script>
  </head>
  <body>
    <a class="skip-link" href="#main">跳到主要內容</a>
    <div data-site-include="header"></div>
    <article class="trip-article">
      <header class="trip-article-hero">
        <div class="container trip-article-hero__inner">
          <p class="trip-article-hero__meta">
            <a class="trip-article-hero__crumb" href="/pages/trip-ideas">客戶體驗評價</a>
            <span class="trip-article-hero__sep" aria-hidden="true">／</span>
            <span class="pill trip-article-hero__cat">${escapeHtml(category)}</span>
          </p>
          <h1 class="trip-article-hero__title">${escapeHtml(displayH1)}</h1>
          <p class="trip-article-hero__desc">${escapeHtml(heroDesc)}</p>
          <div class="trip-article-hero__stats">
            <time datetime="${escapeHtml(date)}">${escapeHtml(date)}</time>
            <span class="trip-article-hero__dot" aria-hidden="true">·</span>
            <span>${escapeHtml(readingTime)}</span>
            ${
              tagsMeta
                ? `<span class="trip-article-hero__dot" aria-hidden="true">·</span><span class="trip-article-hero__tags" title="標籤">${tagsMeta}</span>`
                : ""
            }
          </div>
          ${hasEnglish ? `<div class="trip-article-hero-actions">
            <div class="hero-actions" role="group" aria-label="Language">
              <a class="btn btn-lang" href="/en/trip-stories/${escapeHtml(slug)}/" lang="en" hreflang="en">English</a>
            </div>
          </div>` : ""}
        </div>
        <div class="trip-article-cover-wrap">
          <img
            class="trip-article-cover"
            src="${escapeHtml(coverImage)}"
            alt="${escapeHtml(coverImageAlt || title)}"
            title="${escapeHtml(coverImageAlt || title)}"
            width="${escapeHtml(coverImageWidth)}"
            height="${escapeHtml(coverImageHeight)}"
            loading="eager"
            fetchpriority="high"
            decoding="async"
          />
        </div>
      </header>
      <main id="main" class="trip-article-main section">
        <div class="container">
          <div class="${proseClass}">${bodyHtml}</div>
          <section class="trip-article-related section" aria-labelledby="related-title">
            <div class="section-title" id="related-title">
              <h2>相關客戶體驗評價文章</h2>
              <p>延伸閱讀其他路線、案例與使用情境。</p>
            </div>
            <div class="trip-hub-grid trip-hub-grid--related">${relatedHtml}</div>
          </section>
          ${
            skipArticleCta
              ? ""
              : `<section class="cta trip-article-cta fade-in" data-reveal>
            <h2>想用露營車安排這樣的旅行嗎？</h2>
            <p>你可以先告訴我們日期、人數、想去的方向與是否需要送車，我們會協助確認適合的租借方式與行程安排。</p>
            <div class="hero-actions">
              <a class="btn btn-primary" href="/booking">立即預約露營車</a>
              <a class="btn btn-outline" href="/pages/campervan">查看價格與車款介紹</a>
              <a class="btn btn-outline" href="/pages/booking-guide">看露營車使用教學</a>
            </div>
          </section>`
          }
        </div>
      </main>
    </article>
    <div data-site-include="footer"></div>
  </body>
</html>`;
};

const listThumbSrc = (a) => ((a.listImage || a.coverImage || "") + "").trim();
const listThumbAlt = (a) => ((a.listImageAlt || a.coverImageAlt || a.title || "") + "").trim();

const relatedCardHtml = (a) => `<article class="trip-hub-card trip-hub-card--compact fade-in" data-reveal>
  <a class="trip-hub-card__link" href="${escapeHtml(a.url)}">
    <div class="trip-hub-card__media">
      <img src="${escapeHtml(listThumbSrc(a))}" alt="${escapeHtml(listThumbAlt(a))}" width="400" height="225" loading="lazy" decoding="async" />
    </div>
    <div class="trip-hub-card__body">
      <span class="pill trip-hub-card__pill">${escapeHtml(a.category)}</span>
      <h3 class="trip-hub-card__title">${escapeHtml(a.title)}</h3>
      <p class="trip-hub-card__excerpt">${escapeHtml(a.description)}</p>
      <span class="trip-hub-card__more">閱讀文章</span>
    </div>
  </a>
</article>`;

async function patchSitemap(urls) {
  let xml = await fs.readFile(SITEMAP, "utf8");
  for (const loc of urls) {
    if (xml.includes(`<loc>${loc}</loc>`)) continue;
    const block = `  <url>
    <loc>${loc}</loc>
    <priority>0.65</priority>
  </url>
`;
    xml = xml.replace("</urlset>", `${block}</urlset>`);
  }
  await fs.writeFile(SITEMAP, xml, "utf8");
}

async function main() {
  const entries = await fs.readdir(CONTENT_DIR, { withFileTypes: true });
  const mdFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => e.name);

  if (!mdFiles.length) {
    console.warn("[build-trip-stories] No .md files in", CONTENT_DIR);
    return;
  }

  const rawList = [];
  for (const file of mdFiles) {
    const full = path.join(CONTENT_DIR, file);
    const src = await fs.readFile(full, "utf8");
    const { data, content } = matter(src);
    const slug = (data.slug || "").trim();
    if (!slug) {
      console.warn("[build-trip-stories] Skip (no slug):", file);
      continue;
    }
    const title = (data.title || slug).trim();
    const h1 = (data.h1 || "").trim();
    const heroLead = (data.heroLead || "").trim();
    const description = (data.description || "").trim();
    const wideBody = Boolean(data.wideBody);
    const skipArticleCta = Boolean(data.skipArticleCta);
    const stylesheets = Array.isArray(data.stylesheets) ? data.stylesheets.map(String) : [];
    const scripts = Array.isArray(data.scripts) ? data.scripts.map(String) : [];
    const hasEnglish = data.hasEnglish !== false;
    const date = (data.date || "").trim();
    const category = (data.category || "未分類").trim();
    const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];
    const coverImage = (data.coverImage || "").trim();
    const coverImageAlt = (data.coverImageAlt || title).trim();
    const coverImageWidth = Number.isFinite(Number(data.coverImageWidth)) ? Number(data.coverImageWidth) : 1200;
    const coverImageHeight = Number.isFinite(Number(data.coverImageHeight)) ? Number(data.coverImageHeight) : 630;
    const listImage = (data.listImage || "").trim();
    const listImageAlt = (data.listImageAlt || "").trim();
    const listVideo = (data.listVideo || "").trim();
    const listVideoPoster = (data.listVideoPoster || "").trim();
    const videoDuration = (data.videoDuration || "").trim();
    const featured = Boolean(data.featured);
    const order = Number.isFinite(Number(data.order)) ? Number(data.order) : 999;
    const readingTime = (data.readingTime || "").trim() || "約 5 分鐘";
    const url = `/trip-stories/${slug}/`;

    rawList.push({
      slug,
      title,
      h1,
      heroLead,
      description,
      wideBody,
      skipArticleCta,
      stylesheets,
      scripts,
      hasEnglish,
      date,
      category,
      tags,
      coverImage,
      coverImageAlt,
      coverImageWidth,
      coverImageHeight,
      listImage,
      listImageAlt,
      listVideo,
      listVideoPoster,
      videoDuration,
      featured,
      order,
      readingTime,
      url,
      bodyMarkdown: content.trim()
    });
  }

  rawList.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return String(b.date).localeCompare(String(a.date));
  });

  const articles = rawList.map(({ bodyMarkdown, ...rest }) => {
    const o = { ...rest };
    if (!o.listImage) delete o.listImage;
    if (!o.listImageAlt) delete o.listImageAlt;
    if (!o.listVideo) delete o.listVideo;
    if (!o.listVideoPoster) delete o.listVideoPoster;
    if (!o.videoDuration) delete o.videoDuration;
    if (!o.h1) delete o.h1;
    if (!o.heroLead) delete o.heroLead;
    if (!o.wideBody) delete o.wideBody;
    if (!o.skipArticleCta) delete o.skipArticleCta;
    delete o.stylesheets;
    delete o.scripts;
    return o;
  });
  const generatedAt = new Date().toISOString();
  const payload = JSON.stringify({ generatedAt, articles }, null, 2);
  await fs.writeFile(OUT_JSON, payload, "utf8");
  await fs.mkdir(path.dirname(ASSETS_DATA_JSON), { recursive: true });
  await fs.writeFile(ASSETS_DATA_JSON, payload, "utf8");

  await fs.mkdir(OUT_STORIES_DIR, { recursive: true });

  for (const item of rawList) {
    const bodyHtml = marked.parse(item.bodyMarkdown);
    const related = pickRelated(rawList, item.slug, 3);
    const relatedHtml = related.map((a) => relatedCardHtml(a)).join("\n");

    const graph = [
      {
        "@type": "Article",
        headline: item.title,
        description: item.description,
        datePublished: item.date,
        image: `${SITE_ORIGIN}${item.coverImage}`,
        author: { "@type": "Organization", name: "揪好森露營車出租" },
        publisher: { "@type": "Organization", name: "揪好森露營車出租" },
        mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_ORIGIN}${item.url}` }
      }
    ];
    if (item.listVideo) {
      const thumb = item.listVideoPoster || item.coverImage;
      graph.push({
        "@type": "VideoObject",
        name: item.title,
        description: item.description,
        thumbnailUrl: `${SITE_ORIGIN}${thumb}`,
        contentUrl: `${SITE_ORIGIN}${item.listVideo}`,
        uploadDate: item.date,
        ...(item.videoDuration ? { duration: item.videoDuration } : {})
      });
    }
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "首頁", item: `${SITE_ORIGIN}/` },
        {
          "@type": "ListItem",
          position: 2,
          name: "客戶體驗評價",
          item: `${SITE_ORIGIN}/pages/trip-ideas`
        },
        {
          "@type": "ListItem",
          position: 3,
          name: item.title,
          item: `${SITE_ORIGIN}${item.url}`
        }
      ]
    });
    const jsonLd = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": graph
    });

    const html = articlePageTemplate({
      slug: item.slug,
      title: item.title,
      h1: item.h1,
      heroLead: item.heroLead,
      description: item.description,
      date: item.date,
      category: item.category,
      tags: item.tags,
      coverImage: item.coverImage,
      coverImageAlt: item.coverImageAlt,
      coverImageWidth: item.coverImageWidth,
      coverImageHeight: item.coverImageHeight,
      readingTime: item.readingTime,
      bodyHtml,
      relatedHtml,
      jsonLd,
      wideBody: item.wideBody,
      skipArticleCta: item.skipArticleCta,
      stylesheets: item.stylesheets,
      scripts: item.scripts,
      hasEnglish: item.hasEnglish !== false
    });

    const dir = path.join(OUT_STORIES_DIR, item.slug);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "index.html"), html, "utf8");
  }

  const sitemapUrls = rawList.map((a) => `${SITE_ORIGIN}${a.url}`);
  await patchSitemap(sitemapUrls);

  console.log(
    "[build-trip-stories] OK:",
    rawList.length,
    "articles →",
    path.relative(ROOT, OUT_JSON),
    "+",
    path.relative(ROOT, ASSETS_DATA_JSON),
    "+",
    path.relative(ROOT, OUT_STORIES_DIR)
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
