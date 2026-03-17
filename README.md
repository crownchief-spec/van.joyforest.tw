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

## Cloudflare Pages

- **Build command**：留空
- **Output directory**：留空（或 `/`）