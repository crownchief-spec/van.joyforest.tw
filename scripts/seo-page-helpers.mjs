/** Shared SEO extraction / mutation helpers for static HTML pages */
import fs from "node:fs/promises";
import path from "node:path";
import { SITE_ORIGIN, toCanonicalUrl, toCleanPath } from "./seo-url-helpers.mjs";

export const BRAND = {
  zh: "揪好森露營車出租",
  en: "JoyForest CamperVan Rental",
  themeColor: "#1f6b52"
};

const BOOKING_OG =
  "https://van.joyforest.tw/assets/images/home/joyforest-campervan-at-white-villa-staycation-hero/joyforest-campervan-at-white-villa-staycation-hero-1200.jpg";

const NORTH_COAST_NIGHT =
  "https://van.joyforest.tw/assets/images/trip-ideas/taiwan-north-coast-campervan-night-beach-stars-shore.jpg";

/** Per-file og:image overrides when hero is shared but page needs unique share image */
export const OG_IMAGE_OVERRIDES = {
  "booking.html": BOOKING_OG,
  "en/booking.html": BOOKING_OG,
  "pages/resources/index.html":
    "https://van.joyforest.tw/assets/images/home/bundle-glamping-camping-life.png",
  "en/pages/resources/index.html":
    "https://van.joyforest.tw/assets/images/home/bundle-glamping-camping-life.png",
  "pages/resources/taipei-campervan-rental-guide.html":
    "https://van.joyforest.tw/assets/images/guide/taipei-campervan-rental-exterior-equipment-labeled-coast.png",
  "en/pages/resources/taipei-campervan-rental-guide.html":
    "https://van.joyforest.tw/assets/images/guide/taipei-campervan-rental-exterior-equipment-labeled-coast.png",
  "trip-stories/taipei-north-coast-story/index.html": NORTH_COAST_NIGHT,
  "en/trip-stories/taipei-north-coast-story/index.html": NORTH_COAST_NIGHT,
  "trip-stories/mountain-camping-van/index.html":
    "https://van.joyforest.tw/images/trip-stories/mountain-camping-van.jpg",
  "en/trip-stories/mountain-camping-van/index.html":
    "https://van.joyforest.tw/images/trip-stories/mountain-camping-van.jpg",
  "pages/resources/campervan-3days-2nights-trip-ideas.html":
    "https://van.joyforest.tw/assets/images/trip-ideas/taiwan-north-coast-campervan-sunrise-bed-window-beach-morning.jpg",
  "en/pages/resources/campervan-3days-2nights-trip-ideas.html":
    "https://van.joyforest.tw/assets/images/trip-ideas/taiwan-north-coast-campervan-sunrise-bed-window-beach-morning.jpg"
};

export const SKIP_HTML = new Set([
  "components/header.html",
  "components/footer.html",
  "components/header-en.html",
  "components/footer-en.html"
]);

export const escapeHtml = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export async function walkHtml(root, base = "") {
  const out = [];
  for (const e of await fs.readdir(path.join(root, base || "."), { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      out.push(...(await walkHtml(root, rel)));
    } else if (e.isFile() && e.name.endsWith(".html")) {
      out.push(rel);
    }
  }
  return out;
}

export function fileToRoute(rel) {
  if (rel === "index.html") return "/";
  if (rel === "en/index.html") return "/en/";
  if (rel.endsWith("/index.html")) {
    const dir = rel.slice(0, -"/index.html".length);
    return toCleanPath(`/${dir}/`);
  }
  return toCleanPath(`/${rel}`);
}

export function resolveRelativeImage(src, pageFile) {
  const raw = (src || "").trim();
  if (!raw || raw.startsWith("data:")) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw.split("?")[0];
  if (raw.startsWith("/")) return `${SITE_ORIGIN}${raw.split("?")[0]}`;

  const dirParts = pageFile.split("/").slice(0, -1);
  const out = [...dirParts];
  for (const part of raw.split("/")) {
    if (part === "..") out.pop();
    else if (part && part !== ".") out.push(part);
  }
  let pathname = `/${out.join("/")}`;
  // en/pages/* often uses ../../assets — normalize to site-root /assets or /images
  pathname = pathname.replace(/^\/en\/(assets|images)\//, "/$1/");
  return `${SITE_ORIGIN}${pathname}`;
}

export function extractHeroImage(html, pageFile) {
  const patterns = [
    /class="hero[^"]*"[^>]*style="[^"]*background-image:\s*url\(['"]?([^'")]+)/i,
    /class="trip-article-cover"[^>]+src="([^"]+)"/i,
    /class="hero__media"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/i,
    /<link\s+rel="preload"\s+as="image"\s+href="([^"]+)"/i
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return resolveRelativeImage(m[1], pageFile);
  }
  return "";
}

export function extractMeta(html, name) {
  const re = new RegExp(
    `<meta\\s+(?:name|property)="${name}"\\s+content="([^"]*)"`,
    "i"
  );
  return html.match(re)?.[1] ?? "";
}

export function extractTitle(html) {
  return html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "";
}

export function extractCanonical(html) {
  return html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1] ?? "";
}

export function extractOgImageAlt(html) {
  return extractMeta(html, "og:image:alt");
}

export function extractLang(html) {
  return html.match(/<html\s+lang="([^"]+)"/i)?.[1] ?? "zh-Hant";
}

export function extractRobotsNoindex(html) {
  const robots = extractMeta(html, "robots");
  return /noindex/i.test(robots);
}

export function extractSchemaTypes(html) {
  const types = new Set();
  for (const m of html.matchAll(/"@type"\s*:\s*"([^"]+)"/g)) types.add(m[1]);
  return [...types];
}

export function pickOgImage(pageFile, heroImage, currentOg, explicitOg) {
  if (explicitOg) return explicitOg;
  if (OG_IMAGE_OVERRIDES[pageFile]) return OG_IMAGE_OVERRIDES[pageFile];
  if (heroImage) return heroImage;
  if (currentOg && !currentOg.includes("shared/default")) return currentOg;
  return "";
}

export function inferOgType(route, html) {
  if (route.includes("/trip-stories/")) return "article";
  if (route.includes("/pages/resources/") && !route.endsWith("/resources/")) return "article";
  return "website";
}

export function setMetaContent(html, attr, key, value) {
  const val = escapeHtml(value);
  const re = new RegExp(
    `(<meta\\s+(?:name|property)="${key}"\\s+content=")([^"]*)(")`,
    "i"
  );
  if (re.test(html)) {
    return html.replace(re, (_match, prefix, _oldValue, suffix) => `${prefix}${val}${suffix}`);
  }
  const insertAfter = attr === "property" ? "og:site_name" : "description";
  const anchor = new RegExp(
    `(<meta\\s+(?:name|property)="${insertAfter}"[^>]*\\/?>)`,
    "i"
  );
  if (anchor.test(html)) {
    return html.replace(
      anchor,
      `$1\n    <meta ${attr}="${key}" content="${val}" />`
    );
  }
  return html.replace(
    /<\/head>/i,
    `    <meta ${attr}="${key}" content="${val}" />\n  </head>`
  );
}

export function setLinkHref(html, rel, href) {
  const val = escapeHtml(href);
  const re = new RegExp(`(<link\\s+rel="${rel}"\\s+href=")([^"]*)(")`, "i");
  if (re.test(html)) {
    return html.replace(re, (_match, prefix, _oldValue, suffix) => `${prefix}${val}${suffix}`);
  }
  return html;
}

export function setTitle(html, title) {
  return html.replace(/<title>[^<]*<\/title>/i, () => `<title>${escapeHtml(title)}</title>`);
}

export function ensureFaviconBlock(html) {
  const tags = [
    ['href="/favicon.ico"', '<link rel="icon" href="/favicon.ico" sizes="any" />'],
    ['href="/assets/images/shared/favicon.svg"', '<link rel="icon" href="/assets/images/shared/favicon.svg" type="image/svg+xml" />'],
    ['joyforest-campervan-rental-logo-icon-64.png', '<link rel="icon" href="/assets/images/shared/joyforest-campervan-rental-logo-icon-64.png" type="image/png" sizes="64x64" />'],
    ['rel="apple-touch-icon"', '<link rel="apple-touch-icon" href="/assets/images/shared/joyforest-campervan-rental-logo-icon-180.png" sizes="180x180" />'],
    ['rel="manifest"', '<link rel="manifest" href="/manifest.webmanifest" />']
  ];
  const missing = tags.filter(([needle]) => !html.includes(needle)).map(([, tag]) => `    ${tag}`);
  if (!missing.length) return html;
  return html.replace(/<\/head>/i, `${missing.join("\n")}\n  </head>`);
}

function ensureWebPageSchema(html, page, brandName) {
  if (page.noindex || extractSchemaTypes(html).includes("WebPage")) return html;
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${page.canonical}#webpage`,
    url: page.canonical,
    name: page.title,
    description: page.description,
    inLanguage: page.route.startsWith("/en") ? "en" : "zh-Hant",
    isPartOf: {
      "@type": "WebSite",
      "@id": `${SITE_ORIGIN}/#website`,
      url: `${SITE_ORIGIN}/`,
      name: brandName
    },
    ...(page.ogImage
      ? {
          primaryImageOfPage: {
            "@type": "ImageObject",
            url: page.ogImage,
            width: 1200,
            height: 630
          }
        }
      : {})
  };
  const block = `    <script type="application/ld+json" data-seo-managed="webpage">\n${JSON.stringify(schema, null, 2)}\n    </script>\n`;
  return html.replace(/<\/head>/i, `${block}  </head>`);
}

export function applyPageSeo(html, page, brandName) {
  const {
    title,
    description,
    canonical,
    ogImage,
    ogImageAlt,
    ogType,
    noindex,
    route
  } = page;

  let out = html;
  if (title) out = setTitle(out, title);
  if (description) out = setMetaContent(out, "name", "description", description);

  const robots = noindex
    ? "noindex,follow"
    : "index,follow,max-image-preview:large";
  if (/<meta\s+name="robots"/i.test(out)) {
    out = setMetaContent(out, "name", "robots", robots);
  } else {
    out = out.replace(
      /<meta charset="utf-8"\s*\/>/i,
      `<meta charset="utf-8" />\n    <meta name="robots" content="${robots}" />`
    );
  }

  if (canonical) out = setLinkHref(out, "canonical", canonical);

  const locale = route.startsWith("/en") ? "en_US" : "zh_TW";
  out = setMetaContent(out, "property", "og:type", ogType || "website");
  out = setMetaContent(out, "property", "og:locale", locale);
  out = setMetaContent(out, "property", "og:site_name", brandName);
  if (title) out = setMetaContent(out, "property", "og:title", title);
  if (description) out = setMetaContent(out, "property", "og:description", description);
  if (canonical) out = setMetaContent(out, "property", "og:url", canonical.replace(/#.*$/, ""));
  if (ogImage) {
    out = setMetaContent(out, "property", "og:image", ogImage);
    if (ogImageAlt) out = setMetaContent(out, "property", "og:image:alt", ogImageAlt);
    out = setMetaContent(out, "property", "og:image:width", "1200");
    out = setMetaContent(out, "property", "og:image:height", "630");
  }

  out = setMetaContent(out, "name", "twitter:card", "summary_large_image");
  if (title) out = setMetaContent(out, "name", "twitter:title", title);
  if (description) out = setMetaContent(out, "name", "twitter:description", description);
  if (ogImage) {
    out = setMetaContent(out, "name", "twitter:image", ogImage);
    if (ogImageAlt) out = setMetaContent(out, "name", "twitter:image:alt", ogImageAlt);
  }

  out = ensureFaviconBlock(out);
  if (!out.includes('name="theme-color"')) {
    out = out.replace(
      /<meta charset="utf-8"\s*\/>/i,
      `<meta charset="utf-8" />\n    <meta name="theme-color" content="${BRAND.themeColor}" />`
    );
  }
  if (!out.includes("Analytics placeholder:")) {
    out = out.replace(
      /<\/head>/i,
      "    <!-- Analytics placeholder: add GA4/GTM only after the measurement ID and consent policy are confirmed. -->\n  </head>"
    );
  }
  out = ensureWebPageSchema(out, page, brandName);
  return out;
}

export function buildPageRecord(rel, html, mapEntry = {}) {
  const route = mapEntry.route || fileToRoute(rel);
  const heroImage = extractHeroImage(html, rel) || mapEntry.heroImage || "";
  const currentOg = extractMeta(html, "og:image");
  const explicitOg = mapEntry.ogImageOverride ? mapEntry.ogImage : undefined;
  const ogImage = pickOgImage(rel, heroImage, currentOg, explicitOg);
  const title = mapEntry.title || extractTitle(html);
  const description = mapEntry.description || extractMeta(html, "description");
  const canonical = mapEntry.canonical || extractCanonical(html) || toCanonicalUrl(route);
  const isRedirect =
    /<meta\s+http-equiv="refresh"/i.test(html) || /location\.replace\s*\(/i.test(html);
  const noindex =
    isRedirect || (mapEntry.noindex ?? extractRobotsNoindex(html) ?? false);
  const schemaType = [...(mapEntry.schemaType || extractSchemaTypes(html))];
  if (!noindex && !schemaType.includes("WebPage")) schemaType.push("WebPage");

  return {
    file: rel,
    route,
    title,
    description,
    canonical: canonical.replace(/#.*$/, ""),
    heroImage,
    ogImage: ogImage || heroImage,
    ogImageAlt: mapEntry.ogImageAlt || extractOgImageAlt(html) || title,
    ogType: mapEntry.ogType || inferOgType(route, html),
    schemaType,
    noindex
  };
}
