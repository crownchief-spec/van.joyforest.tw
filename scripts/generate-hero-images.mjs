#!/usr/bin/env node
/** Generate responsive AVIF/WebP/JPEG variants for homepage hero */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "assets/images/home/joyforest-campervan-at-white-villa-staycation-hero.jpg");
const OUT_DIR = path.join(ROOT, "assets/images/home/joyforest-campervan-at-white-villa-staycation-hero");
const WIDTHS = [480, 768, 1200, 1600];

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const meta = await sharp(SRC).metadata();
  const base = "joyforest-campervan-at-white-villa-staycation-hero";

  for (const w of WIDTHS) {
    const pipeline = sharp(SRC).resize(w, null, { withoutEnlargement: true });
    await pipeline.clone().jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(OUT_DIR, `${base}-${w}.jpg`));
    await pipeline.clone().webp({ quality: 82 }).toFile(path.join(OUT_DIR, `${base}-${w}.webp`));
    await pipeline.clone().avif({ quality: 55 }).toFile(path.join(OUT_DIR, `${base}-${w}.avif`));
  }

  console.log("[generate-hero-images] OK:", OUT_DIR, `source ${meta.width}x${meta.height}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
