import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { marked } from "marked";
import { hreflangHeadHtml, enLangSwitchHtml } from "./i18n-helpers.mjs";
import { enhanceEnTitle, enhanceEnDescription, keywordsMetaHtml } from "./en-seo-helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "content", "trip-stories-en");
const OUT_JSON = path.join(CONTENT_DIR, "articles.json");
const ASSETS_DATA_JSON = path.join(ROOT, "assets", "data", "trip-stories-articles-en.json");
const OUT_STORIES_DIR = path.join(ROOT, "en", "trip-stories");
const SITEMAP = path.join(ROOT, "sitemap.xml");
const SITE_ORIGIN = "https://van.joyforest.tw";

marked.setOptions({ gfm: true, breaks: true });

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
  return [...sameCat, ...rest].slice(0, limit);
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
  skipArticleCta
}) => {
  const tagList = Array.isArray(tags) ? tags : [];
  const tagsMeta = tagList.map((t) => escapeHtml(t)).join(", ");
  const displayH1 = h1 || title;
  const heroDesc = heroLead || description;
  const zhUrl = `/trip-stories/${slug}/`;
  const enUrl = `/en/trip-stories/${slug}/`;
  const proseClass = wideBody
    ? "trip-article-prose trip-story-prose trip-article-prose--wide"
    : "trip-article-prose trip-story-prose";
  const seoTitle = enhanceEnTitle(title);
  const seoDescription = enhanceEnDescription(description);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#1f6b52" />
    <meta name="robots" content="index,follow,max-image-preview:large" />
    <title>${escapeHtml(seoTitle)}</title>
    <meta name="description" content="${escapeHtml(seoDescription)}" />
${keywordsMetaHtml()}
    <link rel="canonical" href="${SITE_ORIGIN}${enUrl}" />
${hreflangHeadHtml({ zhCanonical: `${SITE_ORIGIN}${zhUrl}`, enCanonical: `${SITE_ORIGIN}${enUrl}` })}
    <meta property="og:type" content="article" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:site_name" content="JoyForest CamperVan Rental" />
    <meta property="og:title" content="${escapeHtml(seoTitle)}" />
    <meta property="og:description" content="${escapeHtml(seoDescription)}" />
    <meta property="og:url" content="${SITE_ORIGIN}${enUrl}" />
    <meta property="og:image" content="${SITE_ORIGIN}${coverImage}" />
    <meta property="og:image:width" content="${escapeHtml(coverImageWidth)}" />
    <meta property="og:image:height" content="${escapeHtml(coverImageHeight)}" />
    <meta property="og:image:alt" content="${escapeHtml(coverImageAlt || title)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(seoTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(seoDescription)}" />
    <meta name="twitter:image" content="${SITE_ORIGIN}${coverImage}" />
    <meta name="twitter:image:alt" content="${escapeHtml(coverImageAlt || title)}" />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="icon" href="/assets/images/shared/favicon.svg" type="image/svg+xml" />
    <link rel="icon" href="/assets/images/shared/joyforest-campervan-rental-logo-icon-64.png" type="image/png" sizes="64x64" />
    <link rel="apple-touch-icon" href="/assets/images/shared/joyforest-campervan-rental-logo-icon-180.png" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="preload" as="image" href="${escapeHtml(coverImage)}" fetchpriority="high" />
    <link rel="stylesheet" href="../../../assets/css/style.css" />
    <script defer src="../../../assets/js/main.js"></script>
    <script type="application/ld+json">${jsonLd}</script>
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to main content</a>
    <div data-site-include="header"></div>
    <article class="trip-article">
      <header class="trip-article-hero">
        <div class="container trip-article-hero__inner">
          <p class="trip-article-hero__meta">
            <a class="trip-article-hero__crumb" href="/en/pages/trip-ideas">Customer stories</a>
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
                ? `<span class="trip-article-hero__dot" aria-hidden="true">·</span><span class="trip-article-hero__tags" title="Tags">${tagsMeta}</span>`
                : ""
            }
          </div>
          <div class="trip-article-hero-actions">
            <div class="hero-actions" role="group" aria-label="Language">
              ${enLangSwitchHtml(enUrl)}
            </div>
          </div>
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
              <h2>Related customer stories</h2>
              <p>More routes, cases and use scenarios.</p>
            </div>
            <div class="trip-hub-grid trip-hub-grid--related">${relatedHtml}</div>
          </section>
          ${
            skipArticleCta
              ? ""
              : `<section class="cta trip-article-cta fade-in" data-reveal>
            <h2>Want to plan a trip like this?</h2>
            <p>Tell us your dates, group size, direction and whether you need delivery—we’ll help confirm rental options and pacing.</p>
            <div class="hero-actions">
              <a class="btn btn-primary" href="/en/booking">Book the campervan</a>
              <a class="btn btn-outline" href="/en/pages/campervan">Price &amp; van details</a>
              <a class="btn btn-outline" href="/en/pages/booking-guide">How to use the van</a>
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
      <span class="trip-hub-card__more">Read article</span>
    </div>
  </a>
</article>`;

async function patchSitemap(urls) {
  let xml = await fs.readFile(SITEMAP, "utf8");
  for (const loc of urls) {
    if (xml.includes(`<loc>${loc}</loc>`)) continue;
    const block = `  <url>
    <loc>${loc}</loc>
    <priority>0.6</priority>
  </url>
`;
    xml = xml.replace("</urlset>", `${block}</urlset>`);
  }
  await fs.writeFile(SITEMAP, xml, "utf8");
}

async function main() {
  const entries = await fs.readdir(CONTENT_DIR, { withFileTypes: true });
  const mdFiles = entries.filter((e) => e.isFile() && e.name.endsWith(".md")).map((e) => e.name);
  if (!mdFiles.length) {
    console.warn("[build-english-trip-stories] No .md files in", CONTENT_DIR);
    return;
  }

  const rawList = [];
  for (const file of mdFiles) {
    const full = path.join(CONTENT_DIR, file);
    const src = await fs.readFile(full, "utf8");
    const { data, content } = matter(src);
    const slug = (data.slug || "").trim();
    if (!slug) continue;
    const title = (data.title || slug).trim();
    rawList.push({
      slug,
      title,
      h1: (data.h1 || "").trim(),
      heroLead: (data.heroLead || "").trim(),
      description: (data.description || "").trim(),
      wideBody: Boolean(data.wideBody),
      skipArticleCta: Boolean(data.skipArticleCta),
      date: (data.date || "").trim(),
      category: (data.category || "Uncategorized").trim(),
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      coverImage: (data.coverImage || "").trim(),
      coverImageAlt: (data.coverImageAlt || title).trim(),
      coverImageWidth: Number.isFinite(Number(data.coverImageWidth)) ? Number(data.coverImageWidth) : 1200,
      coverImageHeight: Number.isFinite(Number(data.coverImageHeight)) ? Number(data.coverImageHeight) : 630,
      listImage: (data.listImage || "").trim(),
      listImageAlt: (data.listImageAlt || "").trim(),
      listVideo: (data.listVideo || "").trim(),
      listVideoPoster: (data.listVideoPoster || "").trim(),
      videoDuration: (data.videoDuration || "").trim(),
      featured: Boolean(data.featured),
      order: Number.isFinite(Number(data.order)) ? Number(data.order) : 999,
      readingTime: (data.readingTime || "").trim() || "About 5 min",
      url: `/en/trip-stories/${slug}/`,
      bodyMarkdown: content.trim()
    });
  }

  rawList.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return String(b.date).localeCompare(String(a.date));
  });

  const articles = rawList.map(({ bodyMarkdown, ...rest }) => {
    const o = { ...rest };
    ["listImage", "listImageAlt", "listVideo", "listVideoPoster", "videoDuration", "h1", "heroLead", "wideBody", "skipArticleCta"].forEach(
      (k) => {
        if (!o[k]) delete o[k];
      }
    );
    return o;
  });

  const payload = JSON.stringify({ generatedAt: new Date().toISOString(), articles }, null, 2);
  await fs.writeFile(OUT_JSON, payload, "utf8");
  await fs.mkdir(path.dirname(ASSETS_DATA_JSON), { recursive: true });
  await fs.writeFile(ASSETS_DATA_JSON, payload, "utf8");
  await fs.mkdir(OUT_STORIES_DIR, { recursive: true });

  for (const item of rawList) {
    const bodyHtml = marked.parse(item.bodyMarkdown);
    const relatedHtml = pickRelated(rawList, item.slug, 3).map((a) => relatedCardHtml(a)).join("\n");
    const enUrl = item.url;
    const zhUrl = `/trip-stories/${item.slug}/`;
    const graph = [
      {
        "@type": "Article",
        headline: item.title,
        description: item.description,
        datePublished: item.date,
        image: `${SITE_ORIGIN}${item.coverImage}`,
        inLanguage: "en",
        author: { "@type": "Organization", name: "JoyForest CamperVan Rental" },
        publisher: { "@type": "Organization", name: "JoyForest CamperVan Rental" },
        mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_ORIGIN}${enUrl}` }
      }
    ];
    if (item.listVideo) {
      graph.push({
        "@type": "VideoObject",
        name: item.title,
        description: item.description,
        thumbnailUrl: `${SITE_ORIGIN}${item.listVideoPoster || item.coverImage}`,
        contentUrl: `${SITE_ORIGIN}${item.listVideo}`,
        uploadDate: item.date,
        ...(item.videoDuration ? { duration: item.videoDuration } : {})
      });
    }
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_ORIGIN}/en/` },
        { "@type": "ListItem", position: 2, name: "Customer stories", item: `${SITE_ORIGIN}/en/pages/trip-ideas` },
        { "@type": "ListItem", position: 3, name: item.title, item: `${SITE_ORIGIN}${enUrl}` }
      ]
    });
    const jsonLd = JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
    const html = articlePageTemplate({ ...item, bodyHtml, relatedHtml, jsonLd });
    const dir = path.join(OUT_STORIES_DIR, item.slug);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "index.html"), html, "utf8");
  }

  const staticEnUrls = [
    `${SITE_ORIGIN}/en/`,
    `${SITE_ORIGIN}/en/booking`,
    `${SITE_ORIGIN}/en/pages/campervan`,
    `${SITE_ORIGIN}/en/pages/booking-guide`,
    `${SITE_ORIGIN}/en/pages/trip-ideas`,
    `${SITE_ORIGIN}/en/blog/`,
    `${SITE_ORIGIN}/en/pages/resources/`,
    ...[
      "taipei-campervan-rental-guide",
      "campervan-beginner-how-to-use",
      "campervan-3days-2nights-trip-ideas",
      "campervan-price-comparison",
      "family-campervan-travel",
      "campervan-vs-campsite",
      "taipei-taoyuan-hsinchu-campervan",
      "campervan-resources-youtube-guide",
      "customer-travel-photos-campervan-records",
      "campervan-rental-reviews-guide",
      "family-friends-couple-event-campervan-cases",
      "taiwan-campsite-map-regions-guide",
      "campervan-suitable-parking-stops-taiwan",
      "northern-taiwan-campervan-routes",
      "taoyuan-hsinchu-miaoli-campsites-campervan",
      "taiwan-coastal-routes-campervan-five-itineraries",
      "family-attractions-campervan-taiwan",
      "campervan-water-electricity-checklist",
      "campervan-newbie-articles-learning-path"
    ].map((s) => `${SITE_ORIGIN}/en/pages/resources/${s}`)
  ];

  await patchSitemap([...staticEnUrls, ...rawList.map((a) => `${SITE_ORIGIN}${a.url}`)]);

  console.log("[build-english-trip-stories] OK:", rawList.length, "English articles");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
