# van.joyforest.tw

揪好森露營車出租｜靜態網站（HTML + CSS + JS），可直接部署到 Cloudflare Pages。

## 目錄結構

```
/
├── index.html
├── pages/
│   ├── campervan.html
│   ├── guide.html
│   └── faq.html
├── blog/
│   └── index.html
├── assets/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── main.js
│   └── images/
│       ├── home/
│       ├── campervan/
│       ├── guide/
│       ├── faq/
│       └── shared/
```

## 本機預覽

```bash
python3 -m http.server 8787
```

然後在瀏覽器打開 `http://localhost:8787/`。

## 客戶體驗文章（Markdown）

文章原始檔在 `content/trip-stories/*.md`（含 YAML frontmatter）。**改過文章或新增 `.md` 後**，請在專案根目錄執行：

```bash
npm install   # 首次或依賴變更時
npm run build
```

建置會更新：

- `content/trip-stories/articles.json`
- `assets/data/trip-stories-articles.json`（全站列表與 Footer 隨機兩則用）
- `trip-stories/<slug>/index.html`（各篇靜態頁）
- `sitemap.xml`（文章網址）

**請將上述變更一併提交並部署**，線上的客戶體驗列表、Footer 與 SEO 才會同步。

## Cloudflare Pages

- **Build command**：可設為 `npm install && npm run build`（若希望每次部署自動產生 JSON 與文章頁）；若改在本地建置後只上傳靜態檔，可留空。
- **Output directory**：留空（或 `/`）