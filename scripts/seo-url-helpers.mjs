/** Canonical URL rules — final 200 URLs after server 301 from .html */
export const SITE_ORIGIN = "https://van.joyforest.tw";

const DIRECTORY_ROOTS = new Set([
  "/blog",
  "/pages/resources",
  "/en/blog",
  "/en/pages/resources"
]);

/** Normalize any path or URL to the public canonical pathname */
export const toCleanPath = (input) => {
  let path = String(input || "/").trim();
  if (!path) return "/";

  let hash = "";
  const hashIdx = path.indexOf("#");
  if (hashIdx >= 0) {
    hash = path.slice(hashIdx);
    path = path.slice(0, hashIdx);
  }

  if (path.startsWith("http://") || path.startsWith("https://")) {
    try {
      const u = new URL(path);
      path = u.pathname;
      if (!hash && u.hash) hash = u.hash;
    } catch {
      return input;
    }
  }

  if (path.endsWith("/")) {
    path = path.slice(0, -"/".length) || "/";
    if (path !== "/" && !path.endsWith("/")) path += "/";
  } else if (path.endsWith(".html")) {
    path = path.slice(0, -".html".length);
  }

  if (/^\/trip-stories\/[^/]+$/.test(path)) path += "/";
  if (/^\/en\/trip-stories\/[^/]+$/.test(path)) path += "/";

  if (DIRECTORY_ROOTS.has(path)) path += "/";
  if (path === "/en") path = "/en/";

  return (path || "/") + hash;
};

export const toCanonicalUrl = (input) => {
  const raw = String(input || "/");
  const hashIdx = raw.indexOf("#");
  const hash = hashIdx >= 0 ? raw.slice(hashIdx) : "";
  const path = toCleanPath(raw);
  const base = path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path;
  const pathOnly = hashIdx >= 0 ? base.replace(/#.*$/, "") : base;
  const cleanPath = toCleanPath(pathOnly);
  if (cleanPath === "/") return `${SITE_ORIGIN}/${hash}`;
  return `${SITE_ORIGIN}${cleanPath}${hash}`;
};

/** Resolve relative href against a page's directory to an absolute clean path */
export const resolveHrefToCleanPath = (href, pageFilePath) => {
  const raw = (href || "").trim();
  if (!raw || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:")) {
    return raw;
  }

  const hashIdx = raw.indexOf("#");
  const hash = hashIdx >= 0 ? raw.slice(hashIdx) : "";
  const pathPart = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw;

  if (!pathPart || pathPart === "#") return raw;

  if (pathPart.startsWith("http://") || pathPart.startsWith("https://") || pathPart.startsWith("//")) {
    if (pathPart.includes("van.joyforest.tw")) return toCanonicalUrl(raw);
    return raw;
  }

  const pageDir = pageFilePath.includes("/")
    ? `/${pageFilePath.split("/").slice(0, -1).join("/")}`
    : "/";
  const posix = pathPart.startsWith("/")
    ? pathPart
    : new URL(pathPart, `https://van.joyforest.tw${pageDir.endsWith("/") ? pageDir : pageDir + "/"}`).pathname;
  return toCleanPath(posix) + hash;
};

export const isInternalSiteUrl = (url) => {
  const u = String(url || "");
  return u.startsWith("/") || u.includes("van.joyforest.tw");
};

export const isRedirectOnlyPath = (path) => {
  const p = toCleanPath(path).replace(/#.*$/, "");
  return p === "/pages/guide" || p === "/pages/faq" || p === "/booking" && path.includes("index");
};

export const shouldIndexPath = (path) => {
  const p = toCleanPath(path).replace(/#.*$/, "");
  if (p === "/404" || p === "/en/404") return false;
  if (p === "/pages/guide" || p === "/pages/faq") return false;
  return true;
};
