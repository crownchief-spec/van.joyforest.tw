/** Shared i18n path helpers for zh ↔ en URL mapping */
export const SITE_ORIGIN = "https://van.joyforest.tw";

export const normalizePathname = (pathname) => {
  let p = pathname || "/";
  if (p.endsWith("/index.html")) {
    p = p.slice(0, -"/index.html".length) || "/";
  }
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p || "/";
};

const withTrailingSlashIfNeeded = (path, sourcePath) => {
  if ((sourcePath || "").endsWith("/") && path.length > 1 && !path.endsWith("/")) {
    return `${path}/`;
  }
  return path;
};

/** Chinese public path → English public path */
export const zhPathToEn = (zhPath) => {
  const p = normalizePathname(zhPath);
  if (p === "/") return "/en/";
  if (p.startsWith("/en")) return withTrailingSlashIfNeeded(p, zhPath);
  return withTrailingSlashIfNeeded(`/en${p}`, zhPath);
};

/** English public path → Chinese public path */
export const enPathToZh = (enPath) => {
  const p = normalizePathname(enPath);
  if (p === "/en" || p === "/en/") return "/";
  if (p.startsWith("/en/")) return withTrailingSlashIfNeeded(p.slice(3) || "/", enPath);
  return withTrailingSlashIfNeeded(p, enPath);
};

export const zhLangSwitchHtml = (zhPath) => {
  const en = zhPathToEn(zhPath);
  return `<a class="btn btn-lang" href="${en}" lang="en" hreflang="en">English</a>`;
};

export const enLangSwitchHtml = (enPath) => {
  const zh = enPathToZh(enPath);
  return `<a class="btn btn-lang" href="${zh}" lang="zh-Hant" hreflang="zh-Hant">中文</a>`;
};

export const hreflangHeadHtml = ({ zhCanonical, enCanonical }) => `    <link rel="alternate" hreflang="zh-Hant" href="${zhCanonical}" />
    <link rel="alternate" hreflang="en" href="${enCanonical}" />
    <link rel="alternate" hreflang="x-default" href="${zhCanonical}" />`;
