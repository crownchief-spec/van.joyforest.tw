# 靜態網站 SEO / OG / AI 維護總表

## 每次新增頁面必填

- `title`：每頁唯一，含主要關鍵字與品牌名。
- `description`：120~160 字元內，與頁面內容一致。
- `canonical`：使用 `https://van.joyforest.tw` 正式網域。
- `og:url`：與 canonical 相同。
- `og:title` / `og:description`：可與 title/description 相同或微調。
- `og:image`：每頁獨立，優先該頁 hero 主圖，必須為絕對網址。
- `twitter:card=summary_large_image` + `twitter:image`。
- `schema`：至少 `WebPage`，依頁面型別補 `Service` / `FAQPage` / `Article`。
- `robots`：正式頁 `index,follow`；測試頁或感謝頁 `noindex,follow`。

## OG 圖選圖規則

1. 優先 `ogImage`（若有專用分享圖）。
2. 若無，使用 `heroImage`。
3. 再無則用該頁最主要內容圖。
4. 避免使用 lazy-load 縮圖、卡片小圖、裝飾圖。
5. 優先 1200x630，且路徑可公開讀取。

## 索引檔維護

- 新增正式頁時，同步更新：
  - `sitemap.xml`
  - `seo-map.json`
- `robots.txt` 應維持指向正式 sitemap。
- `404.html` 保持 `noindex,follow`。

## 追蹤碼預留位置

- 所有頁面 `<head>` 已預留：
  - `<!-- TODO: GA4 / GTM / Meta Pixel 可放在此區塊 -->`
- 若上線 tracking，請維持所有頁面一致，避免漏頁。

## 待補強項目

- 產生真實 `favicon.ico` 檔案（目前以 SVG icon 為主）。
- 若新增文章單頁，請建立文章級別 canonical 與 schema（`BlogPosting`）。
- 若新增 staging/demo/測試頁，務必設定 `noindex` 並從 sitemap 排除。
