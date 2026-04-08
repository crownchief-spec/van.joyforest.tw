# Changelog

## 2026-04-08

### SEO / 社群分享 / 技術優化

- 全站主要頁面補齊 `theme-color`、`robots`、`canonical`、Open Graph、Twitter Card。
- 每頁 `og:image` 改為獨立設定，優先使用該頁 hero 主圖，移除共用預設縮圖策略。
- 首頁與內頁補強 Schema（Organization / WebSite / LocalBusiness / WebPage / Service / Article / FAQPage / BreadcrumbList）。
- 新增站級檔案：`robots.txt`、`sitemap.xml`、`manifest.webmanifest`、`llms.txt`、`404.html`。
- 新增 SEO 維護資產：`seo-map.json`、`seo-maintenance-checklist.md`。
- 新增品牌圖示資產：`assets/images/shared/favicon.svg`、`assets/images/shared/apple-touch-icon.svg`。

### 維護備註

- 目前 `favicon.ico` 仍待提供正式二進位圖檔（已先以 SVG favicon 支援）。
- 若後續新增文章單頁，請為每篇文章補 `BlogPosting` schema 與獨立 `og:image`。
