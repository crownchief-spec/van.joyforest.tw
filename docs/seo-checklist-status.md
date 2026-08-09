# 網站上線後優化設定 — 100 項檢查表完成狀態

產生時間：2026-08-09
專案：van.joyforest.tw（靜態 HTML）

**圖例**：✅ 已完成　⚠️ 部分完成 / 待人工確認　📝 TODO

---

## 一、品牌與網站識別設定

| # | 項目 | 狀態 | 備註 |
|---|------|------|------|
| 1 | favicon.ico | ✅ | `/favicon.ico` 存在，各頁 head 已引用 |
| 2 | SVG favicon | ✅ | `/assets/images/shared/favicon.svg` 已由 SEO 產生器補入各頁 |
| 3 | favicon link tags | ✅ | SVG + `favicon.ico` + 64px PNG |
| 4 | apple-touch-icon | ✅ | `joyforest-campervan-rental-logo-icon-180.png` |
| 5 | manifest 檔 | ✅ | `/manifest.webmanifest` |
| 6 | manifest 引用 | ✅ | `seo-sync` 自動補齊 |
| 7 | theme-color | ✅ | `#1f6b52`（`BRAND.themeColor`） |
| 8 | logo alt | ✅ | header 使用品牌名稱 |
| 9 | 品牌名稱一致 | ✅ | 繁中「揪好森露營車出租」/ 英文「Joyforest Campervan Rental」 |
| 10 | 品牌名稱集中管理 | ✅ | `scripts/seo-page-helpers.mjs` → `BRAND` + `seo-map.json` |

## 二、每頁基礎 SEO

| # | 項目 | 狀態 | 備註 |
|---|------|------|------|
| 11 | 每頁獨立 title | ✅ | 108 頁已掃描，無重複 |
| 12 | 每頁獨立 meta description | ✅ | 無重複 |
| 13 | 每頁獨立 canonical | ✅ | clean URL、`https://van.joyforest.tw` |
| 14 | 每頁 og:url | ✅ | 與 canonical 一致 |
| 15 | 每頁 og:type | ✅ | 首頁 `website`；文章 `article` |
| 16 | HTML lang | ✅ | 繁中 `zh-Hant`；英文 `en` |
| 17 | 每頁 H1 | ✅ | 各頁皆有主標題 |
| 18 | H2/H3 結構 | ✅ | 驗證器檢查跳階；北海岸文章提醒標題已修正 |
| 19 | title 重複 | ✅ | validate 通過 |
| 20 | description 重複 | ✅ | validate 通過 |

## 三、社群分享 Open Graph

| # | 項目 | 狀態 | 備註 |
|---|------|------|------|
| 21 | 每頁 og:title | ✅ | 與 title 同步 |
| 22 | 每頁 og:description | ✅ | 與 description 同步 |
| 23 | 每頁 og:image | ✅ | 102 個可索引頁各有獨立 1200×630 分享圖 |
| 24 | 每頁 og:url | ✅ | |
| 25 | twitter:card | ✅ | `summary_large_image` |
| 26 | twitter:title | ✅ | |
| 27 | twitter:description | ✅ | |
| 28 | twitter:image | ✅ | 與 og:image 一致 |
| 29 | 移除寫死共用 og:image | ✅ | 已改為 hero 優先 + 覆寫表 |
| 30 | 驗證不同頁面不同圖 | ✅ | 嚴格檢查任何兩頁不得共用相同 og:image URL；目前 0 重複 |

## 四、OG 圖與 hero 圖策略

| # | 項目 | 狀態 | 備註 |
|---|------|------|------|
| 31 | hero 優先做 og:image | ✅ | `generate-og-images.mjs` 由各頁 hero/cover 產生專用圖 |
| 32 | 支援專用 og:image | ✅ | `seo-map.json` `ogImage` + `ogImageOverride` |
| 33 | 選圖邏輯 | ✅ | hero → trip-article-cover → preload |
| 34 | og:image 絕對網址 | ✅ | 全部 `https://van.joyforest.tw/...` |
| 35 | og:image 可公開讀取 | ✅ | 站內 `/assets/images/og/` 靜態資源 |
| 36 | 圖片 404 檢查 | ✅ | 本機逐頁驗證檔案存在、可解碼且為 1200×630；部署後仍需社群快取抽查 |
| 37 | 不抓 lazy-load 小圖 | ✅ | 僅取 hero / cover |
| 38 | 多主圖優先規則 | ✅ | `extractHeroImage()` 順序已定 |
| 39 | 首頁專用 og:image | ✅ | white-villa staycation hero |
| 40 | ogImage 欄位 | ✅ | `seo-map.json` + override 旗標 |

## 五、靜態網站可維護 SEO 結構

| # | 項目 | 狀態 | 備註 |
|---|------|------|------|
| 41 | 共用 SEO head 結構 | ✅ | `applyPageSeo()` |
| 42 | 支援完整欄位 | ✅ | title/desc/canonical/og/twitter/robots |
| 43 | per-page SEO 資料來源 | ✅ | `seo-map.json` |
| 44–49 | 每頁可獨立設定各欄位 | ✅ | 含 noindex、schemaType |
| 50 | 無模板系統也可維護 | ✅ | `npm run seo:sync` + 本文件 |

## 六、Canonical 與網址正規化

| # | 項目 | 狀態 | 備註 |
|---|------|------|------|
| 51 | 每頁 canonical | ✅ | |
| 52 | 正式網域 | ✅ | `van.joyforest.tw` |
| 53 | www/non-www | ✅ | 統一 non-www |
| 54 | https | ✅ | |
| 55 | 尾斜線一致 | ✅ | `toCleanPath()` |
| 56 | 類似頁 canonical | ✅ | guide/faq → booking-guide |
| 57 | 內部連結格式 | ✅ | `normalize-static-paths.mjs` 統一 clean URL 與根路徑資源 |
| 58 | 舊頁 redirect | ✅ | `_redirects` 提供 guide、faq、booking 舊址 301 |
| 59 | sitemap 與 canonical 一致 | ✅ | 102 URLs |
| 60 | query 不作正式頁 | ✅ | |

## 七、索引控制與搜尋引擎檔案

| # | 項目 | 狀態 | 備註 |
|---|------|------|------|
| 61 | robots.txt | ✅ | 含 Sitemap |
| 62 | robots.txt sitemap | ✅ | |
| 63 | sitemap.xml | ✅ | 自動產生，排除 components |
| 64 | 僅收錄正式頁 | ✅ | 排除 404、redirect stub |
| 65 | 排除重複頁 | ✅ | |
| 66 | noindex 支援 | ✅ | 404、guide、faq、booking/ redirect |
| 67 | 404.html | ✅ | 中英文 |
| 68 | 薄內容頁 | ⚠️ | blog 索引頁內容較薄，可持續補強 |
| 69 | staging/demo 避索引 | ✅ | 無 staging 頁 |
| 70 | 死連結掃描 | ✅ | `validate-site-assets.mjs` 驗證 108 頁、4,712 個站內引用 |

## 八、Schema 結構化資料

| # | 項目 | 狀態 | 備註 |
|---|------|------|------|
| 71 | 首頁 Organization | ✅ | |
| 72 | LocalBusiness | ✅ | 首頁已輸出 |
| 73 | WebSite | ✅ | |
| 74 | WebPage | ✅ | 所有可索引頁至少有 WebPage；缺少時由 managed schema 補入 |
| 75 | Service | ✅ | campervan 頁 |
| 76 | BreadcrumbList | ✅ | 有層級的頁面 |
| 77 | FAQPage | ✅ | booking-guide |
| 78 | Article/BlogPosting | ✅ | trip-stories |
| 79 | ImageObject | ✅ | 圖片主導頁已有；managed WebPage 以 `primaryImageOfPage` 描述分享主圖 |
| 80 | Schema 與頁面一致 | ✅ | validate JSON-LD |

## 九、圖片 SEO 與媒體最佳化

| # | 項目 | 狀態 | 備註 |
|---|------|------|------|
| 81 | 主要圖片 alt | ✅ | 驗證器要求每個 `<img>` 皆有 alt |
| 82 | hero 圖 alt | ✅ | og:image:alt 同步 |
| 83 | 避免 IMG_1234 | ⚠️ | 舊圖可逐步重新命名 |
| 84 | 重要圖片 SEO 命名 | ⚠️ | trip-stories cover 已改善 |
| 85 | 圖片尺寸合理 | ⚠️ | 首頁 hero 有 responsive 變體 |
| 86 | hero 不過度 lazy-load | ✅ | preload / 非 lazy |
| 87 | width/height | ✅ | `optimize-html-images.mjs` 已為 108 頁圖片補齊固有尺寸 |
| 88 | 壞圖修正 | ✅ | 修正 20 個英文資源頁錯誤相對路徑；4,712 個引用全數通過 |
| 89 | WebP/AVIF | ⚠️ | 首頁 hero 有；可逐步擴充 |
| 90 | 圖片資源整理 | ✅ | `seo-map.json` heroImage / ogImage |

## 十、AI / LLM / 技術補強

| # | 項目 | 狀態 | 備註 |
|---|------|------|------|
| 91 | llms.txt | ✅ | `/llms.txt` |
| 92 | llms.txt 結構 | ✅ | 品牌、服務、重要頁面 |
| 93 | 頁面摘要 | ✅ | 首頁與重要頁有文字摘要 |
| 94 | 關鍵資訊 HTML 呈現 | ✅ | FAQ、流程、聯絡方式 |
| 95 | AI 可理解品牌服務 | ✅ | |
| 96 | 內部連結結構 | ✅ | header/footer + 資源 hub |
| 97 | 手機/桌機 head 一致 | ✅ | 靜態 head，無 JS 注入 meta |
| 98 | Core Web Vitals 風險 | ✅ | 見下方風險清單；已加圖片尺寸、載入提示與靜態快取規則 |
| 99 | analytics 預留 | ✅ | 各頁 head 已有不含追蹤碼的 analytics placeholder 註解 |
| 100 | 維護總表 | ✅ | `seo-map.json` + `docs/seo-audit-report.md` |

---

## Core Web Vitals 風險盤點

- 大型 hero 背景圖（多頁使用高解析 JPG/PNG）
- YouTube iframe（booking-guide 教學影片）
- `fade-in` 動畫區塊（已針對影片卡片修正）
- 舊 JPG/PNG 圖片仍可逐步轉成 WebP/AVIF，避免一次大量改檔造成內容風險
- YouTube iframe 建議維持點擊後載入或 facade 策略
- GA4/GTM 尚缺正式 Measurement ID 與同意管理方式，因此目前只保留安全插入位置

---

## 未來新增頁面維護流程

1. 建立 HTML，設定 hero 主圖（`class="hero"` 或 `trip-article-cover`）
2. 在 `seo-map.json` 新增條目（或執行 `npm run seo:sync` 自動掃描）
3. 執行 `npm run seo:fix`；系統會由 hero 產生該頁獨立的 1200×630 og:image
4. 確認 link、圖片、canonical、schema、OG 與 Twitter 驗證全部通過
5. 部署後用 [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) 抽查 og:image

---

## 待人工／外部資料

- 部署後以 Facebook Sharing Debugger、LINE 實際貼連結，重新抓取首頁與主要轉換頁的分享快取
- 若要啟用 GA4/GTM，補正式 Measurement ID、事件命名與 Cookie/同意政策
- 舊照片中的中文檔名、`DM1`～`DM5` 與截圖檔名可在下一次素材整理時重新命名；目前均有正確 alt，不影響索引
- Blog 索引頁可隨新文章持續增加原創摘要，避免長期成為內容較薄的列表頁
