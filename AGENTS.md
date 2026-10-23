# 專案驗證規則

## LINE 上線範圍（2026-10-23 使用者明確更正）

露營車與露營區網站目前都必須維持原本的個人 LINE 聯絡入口，禁止導向官方帳號。官方帳號僅限使用者本人私下測試，且目前先測露營車，露營區尚未進入使用階段。測試或修復授權不等於正式上線；只有使用者另行明確同意正式導入後，才能修改導流入口。

每次修改 LINE／AI 自動回覆、Webhook、日曆讀取、Cloudflare 綁定或部署設定後，完成前必須同時確認下列兩個檔期頁面能成功載入有效檔期資料：

- `https://van.joyforest.tw/pages/availability`
- `https://camp.8-ways.com/pages/availability`

任一失敗都不可回報完成；檢查時不得輸出活動標題、客戶姓名或私人內容。

正式環境程式修正必須先提交並推送到 Git，再等待該 Git 版本完成 Cloudflare 正式部署。禁止只手動部署尚未推送的程式，否則定時檔期同步提交會以 Git 舊版重新部署並覆蓋修正。

露營車前台與 API 必須保留同一個 Pages 部署內的 `assets/data/campervan-availability.json` 備援，不得只依賴 `camp.8-ways.com` 或任何跨網站 API。
