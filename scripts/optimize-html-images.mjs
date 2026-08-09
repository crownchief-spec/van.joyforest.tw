#!/usr/bin/env node
/** Add intrinsic dimensions and sensible loading hints to local HTML images. */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { SKIP_HTML, walkHtml } from "./seo-page-helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const dimensionCache = new Map();

function resolveImage(src, pageFile) {
  const clean = (src || "").split(/[?#]/)[0];
  if (!clean || /^(?:data:|https?:|\/\/)/i.test(clean)) return "";
  if (clean.startsWith("/")) return path.join(ROOT, decodeURIComponent(clean.slice(1)));
  return path.resolve(ROOT, path.dirname(pageFile), decodeURIComponent(clean));
}

async function dimensions(file) {
  if (!file) return null;
  if (dimensionCache.has(file)) return dimensionCache.get(file);
  try {
    const meta = await sharp(file).metadata();
    const value = meta.width && meta.height ? { width: meta.width, height: meta.height } : null;
    dimensionCache.set(file, value);
    return value;
  } catch {
    dimensionCache.set(file, null);
    return null;
  }
}

function upsert(tag, name, value) {
  const re = new RegExp(`\\s${name}="[^"]*"`, "i");
  if (re.test(tag)) return tag.replace(re, ` ${name}="${value}"`);
  return tag.replace(/\s*\/>$|>$/, (end) => ` ${name}="${value}"${end}`);
}

function remove(tag, name) {
  return tag.replace(new RegExp(`\\s${name}="[^"]*"`, "i"), "");
}

async function optimizeFile(rel) {
  const file = path.join(ROOT, rel);
  const html = await fs.readFile(file, "utf8");
  let imageIndex = 0;
  let changed = false;
  const matches = [...html.matchAll(/<img\b[^>]*>/gi)];
  let output = html;

  for (const match of matches.reverse()) {
    let tag = match[0];
    const src = tag.match(/\ssrc="([^"]+)"/i)?.[1] || "";
    const local = resolveImage(src, rel);
    const size = await dimensions(local);
    const isHero = /class="[^"]*(?:hero|trip-article-cover)[^"]*"/i.test(tag);
    const isLogo = /class="[^"]*(?:logo|brand)[^"]*"/i.test(tag) || /logo/i.test(src);
    const aboveFold = isHero || isLogo || imageIndex === matches.length - 1;

    if (size) {
      if (!/\swidth=/i.test(tag)) tag = upsert(tag, "width", size.width);
      if (!/\sheight=/i.test(tag)) tag = upsert(tag, "height", size.height);
    }
    if (!/\sdecoding=/i.test(tag)) tag = upsert(tag, "decoding", "async");
    if (aboveFold) {
      tag = remove(tag, "loading");
      if (isHero && !/\sfetchpriority=/i.test(tag)) tag = upsert(tag, "fetchpriority", "high");
    } else if (!/\sloading=/i.test(tag)) {
      tag = upsert(tag, "loading", "lazy");
    }

    if (tag !== match[0]) {
      output = `${output.slice(0, match.index)}${tag}${output.slice(match.index + match[0].length)}`;
      changed = true;
    }
    imageIndex++;
  }

  if (changed) await fs.writeFile(file, output, "utf8");
  return changed;
}

async function main() {
  const files = (await walkHtml(ROOT)).filter((file) => !SKIP_HTML.has(file));
  let changed = 0;
  for (const file of files) if (await optimizeFile(file)) changed++;
  console.log(`[optimize-html-images] Updated ${changed}/${files.length} HTML files`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
