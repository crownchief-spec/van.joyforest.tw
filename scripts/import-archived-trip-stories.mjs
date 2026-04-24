/**
 * 將 content/trip-stories/_archive 內 Markdown 匯入為正式文章（含 YAML frontmatter）。
 * 執行後請跑 npm run build。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ARCH = path.join(ROOT, "content", "trip-stories", "_archive");
const OUT = path.join(ROOT, "content", "trip-stories");

const rows = [
  {
    slug: "hola-campervan-brand-case",
    file: "01-hola-snow-touch.md",
    title: "HOLA × SNOW TOUCH 快閃與露營車拍攝案例",
    description:
      "居家品牌 HOLA 以露營車結合 SNOW TOUCH 冰紗涼感系列，打造情緒中暑急救站快閃、戶外策展與車內形象拍攝；內文附專案實拍與劇照。",
    category: "品牌合作",
    tags: ["HOLA", "快閃活動", "廣告拍攝", "露營車行銷", "SNOW TOUCH"],
    coverImage: "/assets/images/trip-ideas/hola-snow-touch-outdoor-popup-tent.png",
    coverImageAlt: "HOLA SNOW TOUCH 情緒中暑急救站戶外快閃：白色棚帳下白藍條紋露營車與品牌布置",
    order: 11,
    readingTime: "約 6 分鐘"
  },
  {
    slug: "philips-campervan-brand-case",
    file: "02-philips-portable-power.md",
    title: "飛利浦行動電源 × 露營車公路形象片案例",
    description:
      "飛利浦推廣行動電池與戶外儲能時，以白藍露營車行駛山區公路與金色夕陽為視覺隱喻，呈現離網旅行中的拍攝與品牌故事。",
    category: "品牌合作",
    tags: ["飛利浦", "廣告拍攝", "形象片", "露營車"],
    coverImage: "/assets/images/trip-ideas/philips-campervan-portable-power-ad-mountain-road-golden-hour.jpg",
    coverImageAlt: "飛利浦廣告劇照：露營車行駛於山林公路金色夕陽空拍",
    order: 12,
    readingTime: "約 4 分鐘"
  },
  {
    slug: "hsinchu-bride-lounge-campervan-story",
    file: "03-hsinchu-generals-village-wedding.md",
    title: "新竹將軍眷村婚禮｜露營車當新娘休息室",
    description:
      "特色場地婚禮缺少標準新娘房時，客人租露營車緊鄰儀式動線停放，善用冷暖氣、衛浴與沙發床，打造行動更衣與休息空間。",
    category: "活動支援",
    tags: ["婚禮", "新竹", "新娘休息室", "眷村"],
    coverImage: "/assets/images/trip-ideas/hsinchu-generals-village-campervan-bride-dressing-lounge-wedding.jpg",
    coverImageAlt: "新竹眷村紅磚建築旁停放露營車作婚禮新娘休息室",
    order: 13,
    readingTime: "約 4 分鐘"
  },
  {
    slug: "taipei-north-coast-story",
    file: "04-taipei-101-north-coast.md",
    title: "台北 101 取車 → 北海岸過夜與晨光",
    description:
      "從信義區取車出發，沿北海岸慢遊：海味晚餐、星空浪潮入夜，隔日從車窗迎接海邊晨光，三張照片串起城市與海線的一趟小旅行。",
    category: "海邊路線",
    tags: ["台北101", "北海岸", "車宿", "日出"],
    coverImage: "/assets/images/trip-ideas/taipei-101-campervan-rental-departure-twilight-parking.jpg",
    coverImageAlt: "暮光中露營車於台北 101 前取車出發，前往北海岸過夜",
    order: 14,
    readingTime: "約 6 分鐘"
  },
  {
    slug: "miaoli-cape-paradise-car-camping-story",
    file: "05-miaoli-cape-paradise.md",
    title: "苗栗海角樂園｜風車暮色與海線車宿靈感",
    description:
      "苗栗海線開闊海岸與風車同框的暮色氛圍，分享海邊車宿的體感與規劃提醒，實際停車與過夜請依現場法規與告示。",
    category: "海邊路線",
    tags: ["苗栗", "海角樂園", "車宿", "風車"],
    coverImage: "/assets/images/trip-ideas/miaoli-cape-paradise-campervan-wind-turbine-coastal-car-camping-twilight.jpg",
    coverImageAlt: "苗栗海線暮色中露營車與風力發電機同框的車宿氛圍",
    order: 16,
    readingTime: "約 5 分鐘"
  },
  {
    slug: "international-guests-israel-surf-loop",
    file: "06-israel-guests-surf-loop.md",
    title: "以色列旅人七天環島｜衝浪、公路與露營車基地",
    description:
      "依真實交車情境發想：外國旅人在台北領車後，載著衝浪裝備與兄弟默契環島，從北海岸到墾丁再北上，露營車是移動客廳與床位。",
    category: "國際客人",
    tags: ["環島", "衝浪", "外國客人", "海線"],
    coverImage: "/assets/images/trip-ideas/israeli-guests-taipei-regent-handover-campervan-island-surf-trip.jpg",
    coverImageAlt: "國際旅人在台北街區與露營車交車合影",
    order: 17,
    readingTime: "約 7 分鐘"
  },
  {
    slug: "wuling-farm-campervan-story",
    file: "07-wuling-farm-mountain.md",
    title: "武陵農場｜山路、霧淞營地與露營車暖氣",
    description:
      "開露營車上武陵：山路與霧淞林相、到營地後木棧板燈串與開伙，高山氣候下車內冷暖氣讓旅程更從容。",
    category: "山區路線",
    tags: ["武陵農場", "高山", "山區", "露營區"],
    coverImage: "/assets/images/trip-ideas/wuling-farm-mountain-road-rime-ice-campervan-winter.jpg",
    coverImageAlt: "武陵高山公路旁露營車與霧淞林木",
    order: 18,
    readingTime: "約 5 分鐘"
  },
  {
    slug: "kenting-voucher",
    file: "08-kenting-coastal-inspiration.md",
    title: "墾丁海線｜椰林、暮色與露營車慢遊靈感",
    description:
      "南國椰林與海岸空拍、暮色山海與車泊氛圍，適合當墾丁旅遊券或行程發想；實際停靠以現場與預約說明為準。",
    category: "海邊路線",
    tags: ["墾丁", "海線", "慢旅行", "旅遊券"],
    coverImage: "/assets/images/trip-ideas/kenting-campervan-aerial-palm-coast-beach.jpg",
    coverImageAlt: "墾丁椰林海濱空拍與白色露營車",
    order: 19,
    readingTime: "約 4 分鐘"
  },
  {
    slug: "customer-trip-moments",
    file: "09-customer-trip-moments-kenting.md",
    title: "客人實拍｜墾丁揪團、夜景與煙火回憶",
    description:
      "實際客人出遊畫面精選：草地揪團合影、海邊自拍、親子車窗笑容、戶外電影夜、煙火與香檳晚餐等，呈現豪華露營車旅行氛圍。",
    category: "客戶體驗",
    tags: ["墾丁", "揪團", "親子", "夜景", "煙火"],
    coverImage: "/assets/images/trip-ideas/customer-group-five-grass-campervan-kenting-travel.jpg",
    coverImageAlt: "五位旅人於墾丁草地與露營車開心合影",
    order: 21,
    readingTime: "約 6 分鐘"
  },
  {
    slug: "campervan-meetup-gathering",
    file: "10-camping-club-meetup-christmas.md",
    title: "親子露營聚會｜聖誕手作與營區同樂",
    description:
      "租露營車開進營區參加親子露營團或車友聚會：手作、燈飾與薑餅屋 DIY，你的車是私人休息室與小廚房。",
    category: "親子旅行",
    tags: ["聚會", "親子", "聖誕", "露營區"],
    coverImage: "/assets/images/trip-ideas/customer-campervan-christmas-family-gathering-camping-club-collage.jpg",
    coverImageAlt: "親子露營聚會聖誕主題九宮格拼貼紀錄",
    order: 22,
    readingTime: "約 4 分鐘"
  },
  {
    slug: "vanlife-easy-women-couple",
    file: "11-vanlife-women-couple-glamping.md",
    title: "女生與情侶的 Van Life 靈感｜野廚、燈串與額頭床晨光",
    description:
      "不必和營柱拔河：露營車把床、廚房與衛浴帶著走。野廚、自拍、車邊燈串夜晚與天窗晨光，精緻懶人旅行靈感。",
    category: "好友旅行",
    tags: ["女生旅行", "情侶", "Van Life", "拍照"],
    coverImage: "/assets/images/trip-ideas/woman-campervan-outdoor-cooking-vanlife-picnic.jpg",
    coverImageAlt: "女生在露營車前戶外野廚料理",
    order: 23,
    readingTime: "約 5 分鐘"
  }
];

const yamlEscape = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');

for (const m of rows) {
  const srcPath = path.join(ARCH, m.file);
  let body = fs.readFileSync(srcPath, "utf8").trim();
  const fm = `---
title: "${yamlEscape(m.title)}"
slug: "${m.slug}"
description: "${yamlEscape(m.description)}"
date: "2026-04-24"
category: "${yamlEscape(m.category)}"
tags: ${JSON.stringify(m.tags)}
coverImage: "${m.coverImage}"
coverImageAlt: "${yamlEscape(m.coverImageAlt)}"
featured: false
order: ${m.order}
readingTime: "${m.readingTime}"
---

`;

  fs.writeFileSync(path.join(OUT, `${m.slug}.md`), `${fm}${body}\n`, "utf8");
  console.log("wrote", m.slug);
}
