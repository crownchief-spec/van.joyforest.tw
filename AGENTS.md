# 專案驗證規則

## LINE 聯絡範圍（2026-10-24 使用者正式授權）

使用者已明確要求 camp.8-ways.com、van.joyforest.tw、joyforest.tw 的個人 LINE 聯絡入口統一改為官方帳號 `@281uducw`，加好友連結為 `https://line.me/R/ti/p/@281uducw`。LINE 為主要聯絡入口；WhatsApp、電話及 Email 保留為次要方式。此授權取代 2026-10-23 的暫不切換入口指示。

這只是網站聯絡導流切換，不是啟用 AI 自動回覆或 Webhook。使用者開啟官方帳號網頁後，由 Codex 閱讀訊息、先提出建議，再經使用者指示後送出。不得自行啟用自動客服、收款或自動訂房。

每次修改 LINE／AI 自動回覆、Webhook、日曆讀取、Cloudflare 綁定或部署設定後，完成前必須同時確認下列兩個檔期頁面能成功載入有效檔期資料：

- `https://van.joyforest.tw/pages/availability`
- `https://camp.8-ways.com/pages/availability`

任一失敗都不可回報完成；檢查時不得輸出活動標題、客戶姓名或私人內容。

正式環境程式修正必須先提交並推送到 Git，再等待該 Git 版本完成 Cloudflare 正式部署。禁止只手動部署尚未推送的程式，否則定時檔期同步提交會以 Git 舊版重新部署並覆蓋修正。

露營車前台與 API 必須保留同一個 Pages 部署內的 `assets/data/campervan-availability.json` 備援，不得只依賴 `camp.8-ways.com` 或任何跨網站 API。
