(() => {
  "use strict";

  const LIVE_SIGNING_BASE = "https://van.joyforest.tw/pages/e-sign-contract.html";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const adminView = $("#admin-view");
  const signerView = $("#signer-view");
  const criticalKeys = new Set(["rentalStartDate", "rentalStartTime", "rentalEndDate", "rentalEndTime", "deliveryLocation", "returnLocation", "rentalFee", "reservationDeposit", "securityDeposit"]);
  const fieldLabels = {
    customerName: "承租人姓名", phone: "聯絡電話", birthDate: "出生年月日", idNumber: "身分證／護照號碼", address: "戶籍／聯絡地址",
    rentalStartDate: "租借開始日期", rentalStartTime: "開始時間", rentalEndDate: "租借結束日期", rentalEndTime: "結束時間",
    deliveryLocation: "交車地點", returnLocation: "還車地點", rentalFee: "第二份｜車廂設備租金", reservationDeposit: "第二份｜預約訂金", securityDeposit: "第二份｜還車結算押金"
  };
  let draft = null;
  let originalDraft = null;
  let draftToken = "";
  let signatureHasInk = false;
  let signatureDataUrl = "";
  let documentFront = "";
  let documentBack = "";
  let vehiclePdfBlob = null;
  let cabinPdfBlob = null;
  let ownerPdfBlob = null;
  let vehiclePdfUrl = "";
  let cabinPdfUrl = "";
  let ownerPdfUrl = "";
  let localConfig = null;

  function encodeDraft(data) {
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function decodeDraft(encoded) {
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalized + "===".slice((normalized.length + 3) % 4));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function todayYmd() {
    const date = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function formatMoneyLike(value) {
    const digits = String(value || "").replace(/[^\d]/g, "");
    return digits ? `NT$${Number(digits).toLocaleString("zh-TW")}` : String(value || "");
  }

  function setFormValues(form, data) {
    Object.entries(data || {}).forEach(([key, value]) => {
      const input = form.elements.namedItem(key);
      if (input) input.value = value ?? "";
    });
  }

  function collectForm(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  async function buildAdmin() {
    adminView.hidden = false;
    const form = $("#admin-form");
    try {
      const response = await fetch("/api/config", { cache: "no-store" });
      if (response.ok) localConfig = await response.json();
    } catch {}
    if (!localConfig && location.hostname.endsWith("joyforest.tw")) {
      adminView.innerHTML = '<section class="card"><h1>請使用專屬簽約連結</h1><p>這是客戶簽署頁。合約建立請從揪好森本機管理頁進行。</p></section>';
      return;
    }
    $("#calendar-date").value = todayYmd();
    form.elements.namedItem("rentalStartDate").value = todayYmd();
    form.elements.namedItem("rentalEndDate").value = todayYmd();

    $("#calendar-search").addEventListener("click", async () => {
      const date = $("#calendar-date").value;
      const status = $("#calendar-status");
      const results = $("#calendar-results");
      if (!date) return;
      status.className = "status-line";
      status.textContent = "正在搜尋露營車行事曆…";
      results.innerHTML = "";
      try {
        const response = await fetch(`/api/calendar-events?date=${encodeURIComponent(date)}`, { cache: "no-store" });
        if (!response.ok) throw new Error("目前頁面未連接私人行事曆，請手動填寫或使用本機管理頁。 ");
        const payload = await response.json();
        if (!payload.events?.length) {
          status.textContent = payload.warning || "這一天沒有找到露營車預約，可手動填寫或載入示範資料。";
          return;
        }
        status.textContent = `找到 ${payload.events.length} 筆行程，請選擇要帶入的客人。`;
        payload.events.forEach((event) => {
          const article = document.createElement("article");
          article.className = "calendar-result";
          const statusText = event.status === "waitlist" ? "可候補／尚未付訂金" : event.status === "unavailable" ? "不可預訂" : "已確認預約";
          article.innerHTML = `<div><span class="status-pill ${event.status}">${statusText}</span><h3></h3><p></p></div><button class="button outline" type="button">帶入這筆資料</button>`;
          $("h3", article).textContent = event.summary;
          $("p", article).textContent = `${event.startDate} ～ ${event.endDate}｜${event.customerName || "姓名待補"}`;
          $("button", article).addEventListener("click", () => {
            setFormValues(form, {
              customerName: event.customerName,
              phone: event.phone,
              idNumber: event.idNumber,
              rentalStartDate: event.startDate,
              rentalEndDate: event.endDate,
              deliveryLocation: event.deliveryLocation,
              returnLocation: event.returnLocation,
              rentalFee: formatMoneyLike(event.rentalFee),
              reservationDeposit: formatMoneyLike(event.reservationDeposit),
              calendarStatus: event.status,
              calendarSummary: event.summary
            });
            status.textContent = `已帶入：${event.summary}。請補齊缺少的欄位。`;
            form.elements.namedItem("customerName").focus();
          });
          results.append(article);
        });
      } catch (error) {
        status.className = "status-line error";
        status.textContent = error.message;
      }
    });

    $("#demo-fill").addEventListener("click", () => {
      setFormValues(form, {
        customerName: "王小明（示範）", phone: "0912-345-678", birthDate: "1990-01-01", idNumber: "A123456789",
        address: "台北市（示範地址）", rentalStartDate: "2026-09-29", rentalStartTime: "15:00", rentalEndDate: "2026-09-30",
        rentalEndTime: "15:00", deliveryLocation: "台北市指定地點", returnLocation: "台北市指定地點", rentalFee: "NT$8,800",
        reservationDeposit: "NT$2,800", securityDeposit: "NT$5,000", calendarStatus: "manual", calendarSummary: "示範資料（不是正式行事曆）"
      });
      $("#calendar-status").textContent = "已載入示範資料；建立正式連結前請換成真實客人內容。";
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = {
        ...collectForm(form),
        issuedAt: new Date().toISOString(),
        version: "web-contract-1",
        provider: localConfig?.provider || {},
        vehicle: localConfig?.vehicle || {}
      };
      const encoded = encodeDraft(data);
      const localUrl = `${location.origin}${location.pathname}#contract=${encoded}`;
      const liveUrl = `${LIVE_SIGNING_BASE}#contract=${encoded}`;
      const localPreview = new URLSearchParams(location.search).get("preview") === "local";
      const targetUrl = localPreview ? localUrl : (location.hostname === "127.0.0.1" || location.hostname === "localhost" ? liveUrl : localUrl);
      const opened = window.open(targetUrl, "_blank");
      if (opened) opened.opener = null;
      if (!opened) {
        navigator.clipboard?.writeText(targetUrl);
        alert(`簽約連結已建立，請貼給客人：\n\n${targetUrl}`);
      }
    });
  }

  function makeSignerField(key, value) {
    const label = document.createElement("label");
    if (key === "address" || key === "deliveryLocation" || key === "returnLocation") label.className = "full";
    const type = key.includes("Date") ? "date" : key.includes("Time") ? "time" : key === "phone" ? "tel" : "text";
    label.innerHTML = `<span>${fieldLabels[key]}</span><input name="${key}" type="${type}" />`;
    $("input", label).value = value || "";
    if (["customerName", "phone", "rentalStartDate", "rentalEndDate"].includes(key)) $("input", label).required = true;
    return label;
  }

  function buildSigner(encoded) {
    try {
      draft = decodeDraft(encoded);
    } catch {
      document.body.innerHTML = '<main class="page-shell"><section class="card"><h1>簽約連結無效</h1><p>請聯絡揪好森重新取得簽約連結。</p></section></main>';
      return;
    }
    originalDraft = structuredClone(draft);
    draftToken = crypto.randomUUID().replaceAll("-", "").slice(0, 20);
    signerView.hidden = false;
    const fieldRoot = $("#signer-fields");
    Object.keys(fieldLabels).forEach((key) => fieldRoot.append(makeSignerField(key, draft[key])));
    renderContractText(draft);
    fieldRoot.addEventListener("input", (event) => {
      if (criticalKeys.has(event.target.name) && event.target.value !== String(originalDraft[event.target.name] || "")) {
        $("#critical-change-warning").hidden = false;
      }
      renderContractText({ ...draft, ...collectForm($("#signer-form")) });
    });
    $("#reward-bundle-selected").addEventListener("change", (event) => {
      renderContractText({ ...draft, ...collectForm($("#signer-form")), rewardBundleSelected: event.target.checked });
    });
    setupImageInput("document-front", "document-front-preview", (value) => { documentFront = value; });
    setupImageInput("document-back", "document-back-preview", (value) => { documentBack = value; });
    setupSignaturePad();
    $("#signer-form").addEventListener("submit", completeSigning);
    $("#share-vehicle").addEventListener("click", () => sharePdf("vehicle"));
    $("#share-cabin").addEventListener("click", () => sharePdf("cabin"));
    $("#share-owner").addEventListener("click", () => sharePdf("owner"));
  }

  function renderContractText(data) {
    const root = $("#contract-text");
    if (!root) return;
    const grouped = [];
    contractPageModels(data).forEach((model) => {
      let group = grouped.find((item) => item.partId === model.partId);
      if (!group) {
        group = {
          partId: model.partId,
          partNumber: model.partNumber,
          partTitle: model.partTitle,
          partSummary: model.partSummary,
          illustrationSrc: model.illustrationSrc,
          illustrationAlt: model.illustrationAlt,
          scopeType: model.scopeType,
          scopeCaption: model.scopeCaption,
          sections: []
        };
        grouped.push(group);
      }
      if (model.visualAppendixSrc) {
        group.visualAppendixSrc = model.visualAppendixSrc;
        group.visualAppendixAlt = model.visualAppendixAlt;
      }
      group.sections.push(...model.sections);
    });
    root.replaceChildren();
    grouped.forEach((group) => {
      const article = document.createElement("article");
      article.className = "contract-document";
      article.id = group.partId;

      const header = document.createElement("header");
      header.className = "contract-document__header";
      const part = document.createElement("span");
      part.className = "contract-document__part";
      part.textContent = group.partNumber;
      const title = document.createElement("h3");
      title.textContent = group.partTitle;
      const summary = document.createElement("p");
      summary.textContent = group.partSummary;
      header.append(part, title, summary);

      const scopeFigure = document.createElement("figure");
      scopeFigure.className = `contract-scope-figure contract-scope-figure--${group.scopeType}`;
      const media = document.createElement("div");
      media.className = "contract-scope-figure__media";
      const image = document.createElement("img");
      image.src = group.illustrationSrc;
      image.alt = group.illustrationAlt;
      image.title = group.illustrationAlt;
      image.width = 1182;
      image.height = 665;
      image.loading = "lazy";
      image.decoding = "async";
      const badge = document.createElement("span");
      badge.className = "contract-scope-figure__badge";
      badge.textContent = group.scopeType === "vehicle" ? "本契約：K2500 車體" : "本契約：藍色露營車廂";
      media.append(image, badge);
      const caption = document.createElement("figcaption");
      caption.textContent = group.scopeCaption;
      scopeFigure.append(media, caption);

      const body = document.createElement("div");
      body.className = "contract-document__body";
      group.sections.forEach((section) => {
        const clause = document.createElement("section");
        clause.className = "contract-clause";
        const heading = document.createElement("h4");
        heading.textContent = section.heading;
        clause.append(heading);
        section.paragraphs.forEach((paragraph) => {
          const text = document.createElement("p");
          text.textContent = paragraph;
          if (String(paragraph).trim().startsWith("•")) text.dataset.listItem = "true";
          clause.append(text);
        });
        body.append(clause);
      });
      article.append(header, scopeFigure, body);
      if (group.visualAppendixSrc) {
        const appendix = document.createElement("figure");
        appendix.className = "contract-visual-appendix";
        const appendixImage = document.createElement("img");
        appendixImage.src = group.visualAppendixSrc;
        appendixImage.alt = group.visualAppendixAlt;
        appendixImage.title = group.visualAppendixAlt;
        appendixImage.width = 760;
        appendixImage.height = 1160;
        appendixImage.loading = "lazy";
        appendixImage.decoding = "async";
        const appendixCaption = document.createElement("figcaption");
        appendixCaption.textContent = "露營車廂結構尺寸與內外觀，作為第二份合約的租賃標的參考。";
        appendix.append(appendixImage, appendixCaption);
        article.append(appendix);
      }
      root.append(article);
    });
  }

  function contractPageModels(data) {
    const provider = data.provider || {};
    const vehicle = data.vehicle || {};
    const rentalPeriod = `${data.rentalStartDate || "____-__-__"} ${data.rentalStartTime || "__:__"} 至 ${data.rentalEndDate || "____-__-__"} ${data.rentalEndTime || "__:__"}`;
    const customer = `${data.customerName || "____________"}｜證件號碼：${data.idNumber || "____________"}｜電話：${data.phone || "____________"}`;
    const providerLine = `${provider.name || "揪好森露營車出租"}${provider.role ? `（${provider.role}）` : ""}`;
    return [
      {
        partId: "contract-vehicle",
        partNumber: "第一份契約",
        partTitle: "借車合約",
        partSummary: "K2500 車體無償借用，規範合法駕駛、行車費用、車況、故障與交通事故處理。",
        illustrationSrc: "/assets/images/contract/campervan-vehicle-and-cabin-overview-line-diagram.webp",
        illustrationAlt: "JoyForest CamperVan 的 K2500 前方車體、底盤與後方露營車廂區分線稿",
        scopeType: "vehicle",
        scopeCaption: "第一份契約標的是前方 K2500 車體、底盤、動力與行駛系統；不包含後方露營車廂與露營設備。",
        title: "第一部分｜借車合約",
        subtitle: "借用車輛與行車責任",
        sections: [
          { heading: "合約雙方", paragraphs: [`車輛提供方（甲方）：${providerLine}`, `車輛借用方（乙方）：${customer}`] },
          { heading: "借用車輛", paragraphs: [`車牌：${vehicle.plate || "RBU-8280"}｜車型：${vehicle.description || "KIA 卡旺 2497cc 雙廂式"}`, `借用期間：${rentalPeriod}`] },
          { heading: "借用內容", paragraphs: [
            "• 借用標的：K2500 車體、底盤、動力與行駛系統；不包含第二份契約的露營車廂與露營設備。",
            "• 借用費用：甲方將前述 K2500 車體無償借予乙方使用，本份契約不收取車輛租金。",
            "• 乙方使用本車輛期間，須承擔使用本車輛產生的所有燃油費（滿油出車、滿油還車）、高速公路 ETC 費用、停車費等相關費用。",
            "• 乙方須具備合法小型車駕駛執照，並隨身攜帶。無照駕駛、酒駕、毒駕或交由他人駕駛（有駕照或無照）發生事故，導致保險公司拒絕理賠時，乙方須負擔所有相關責任與費用。",
            "• 簽訂本合約後，甲方須將本車輛的行照、車輛保險證等文件隨車提供給乙方，乙方應妥善保管。如有遺失，乙方應賠償相應損失。",
            "• 在乙方使用本車輛期間，乙方不得將該車買賣、抵押、質押或贈與，亦不得使用該車輛從事營業性活動。"
          ] }
        ]
      },
      {
        partId: "contract-vehicle",
        partNumber: "第一份契約",
        partTitle: "借車合約",
        partSummary: "K2500 車體無償借用，規範合法駕駛、行車費用、車況、故障與交通事故處理。",
        illustrationSrc: "/assets/images/contract/campervan-vehicle-and-cabin-overview-line-diagram.webp",
        illustrationAlt: "JoyForest CamperVan 的 K2500 前方車體、底盤與後方露營車廂區分線稿",
        scopeType: "vehicle",
        scopeCaption: "第一份契約標的是前方 K2500 車體、底盤、動力與行駛系統；不包含後方露營車廂與露營設備。",
        title: "第一部分｜借車合約",
        subtitle: "故障、事故與雙方資料",
        sections: [
          { heading: "車況與故障", paragraphs: [
            "• 交還時應保證車輛運行良好。車輛使用過程中出現故障或異常，乙方應及時通知甲方，並將本車輛運至甲方指定維修廠進行檢查維修。乙方不得拆卸或更換原車裝置及零件；因非正常使用造成的事故責任及損失費用，均由乙方承擔。"
          ] },
          { heading: "事故與保險", paragraphs: [
            "• 車輛借用期間如發生事故，乙方應立即通知甲方，甲方及時協助乙方向保險公司報案，乙方支付因此產生的一切費用。",
            "• 如屬保險賠付範圍，費用由保險公司承擔；屬保險責任免賠或其他原因導致保險公司拒賠的損失，由乙方承擔。如保險公司不受理此案，則由乙方全部負責，同時承擔車輛修理費、修理期間的經濟損失及與本案相關所產生的費用。"
          ] },
          { heading: "甲方", paragraphs: [`姓名：${provider.name || ""}（${provider.role || "聯邦國際租賃股份有限公司桃園分公司租賃小貨車長租租用人"}）`, `出生年月日：${provider.birthDate || "民國 71 年 7 月 22 日"}`, `身分證字號：${provider.idNumber || "J122062030"}`, `聯絡電話：${provider.phone || "0911252302"}`, `戶籍地址：${provider.address || "桃園市中壢區元化路 95 巷 14 號 4 樓"}`, "甲方簽名：____________________"] },
          { heading: "乙方", paragraphs: [`姓名：${data.customerName || "____________"}`, `出生年月日：${data.birthDate || "____________"}`, `身分證字號：${data.idNumber || "____________"}`, `聯絡電話：${data.phone || "____________"}`, `戶籍地址：${data.address || "____________"}`, "乙方簽名：見本電子文件每頁所附手寫電子簽名"] }
        ]
      },
      {
        partId: "contract-cabin",
        partNumber: "第二份契約",
        partTitle: "露營車廂租賃合約",
        partSummary: "藍色露營車廂與露營設備有償租賃，規範租金、使用方式、返還與損害責任。",
        illustrationSrc: "/assets/images/contract/blue-camper-cabin-rental-scope-diagram.webp",
        illustrationAlt: "JoyForest CamperVan 插圖中以藍色標示有償租賃的露營車廂範圍",
        scopeType: "cabin",
        scopeCaption: "第二份契約標的是圖中藍色露營車廂與交車時點交的露營設備；不包含前方 K2500 車體。",
        title: "第二部分｜露營車廂租賃合約",
        subtitle: "租賃標的、期間與費用",
        sections: [
          { heading: "合約雙方", paragraphs: [`出租人（甲方）：${providerLine}`, `承租人（乙方）：${customer}`] },
          { heading: "租賃規定", paragraphs: [
            "租賃物：圖中藍色露營車廂及交車時點交的露營設備；不包含第一份契約無償借用的 K2500 車體。",
            `租賃期間：${rentalPeriod}`,
            `露營車廂與設備租賃費用：${data.rentalFee || "____________"}｜預約訂金：${data.reservationDeposit || "____________"}｜還車結算押金：${data.securityDeposit || "____________"}`,
            "押金：新臺幣伍仟元整（還車時退還；扣除 ETC 或如有露營車廂、車體、設備損傷及其他未結清費用）。",
            "本票：無需本票。"
          ] },
          { heading: "五星評價回饋活動", paragraphs: [
            "網美露營套組／影音娛樂套組優惠免費體驗免租金（原租賃費用 NT$3,800）。交車時完成評論附圖：Google 地圖商家兩則五星評論，或 Google 地圖商家五星評論及 Instagram 追蹤、發文標註各一則。",
            `本次選擇：${data.rewardBundleSelected ? "☑ 參加五星評價回饋活動並體驗套組" : "☐ 未選擇參加五星評價回饋活動"}`
          ] }
        ]
      },
      {
        partId: "contract-cabin",
        partNumber: "第二份契約",
        partTitle: "露營車廂租賃合約",
        partSummary: "藍色露營車廂與露營設備有償租賃，規範租金、使用方式、返還與損害責任。",
        illustrationSrc: "/assets/images/contract/blue-camper-cabin-rental-scope-diagram.webp",
        illustrationAlt: "JoyForest CamperVan 插圖中以藍色標示有償租賃的露營車廂範圍",
        scopeType: "cabin",
        scopeCaption: "第二份契約標的是圖中藍色露營車廂與交車時點交的露營設備；不包含前方 K2500 車體。",
        title: "第二部分｜露營車廂租賃合約",
        subtitle: "使用、事故與賠償責任",
        sections: [
          { heading: "租賃內容", paragraphs: [
            "• 租賃時間超出預定期間，加收費用每小時 NT$300，並請預先與甲方確認。",
            "• 租賃期間如發生交通事故導致露營車廂損壞，乙方應立即通知甲方並報案。如屬保險賠付範圍，費用由保險公司承擔；屬保險責任免賠或其他原因導致保險公司拒賠的損失，由乙方承擔露營車廂修理費、修理期間的經濟損失及與本案相關所產生的費用。",
            "• 露營車廂並非車體，因此事故保險賠付時並非視為車損，而是財損（財物損失）；一般強制險無法賠償財損。",
            "• 露營車廂維修費用依維修廠報價。指定維修廠：家吼勝 HOME FUN／露營車俱樂部，桃園市八德區廣興路 1320 號。",
            "• 乙方租用露營車廂期間，不得將其買賣、抵押、質押、贈與或用於從事營業性活動。",
            "• 交還時應保證露營車廂物品完整、功能正常，並以租賃時錄影憑證為準。",
            "• 露營車廂使用過程中出現故障或異常，乙方應及時通知甲方。歸還時甲方將交由指定維修廠維修。乙方不得拆卸或更換裝置及零件；因非正常使用造成的事故責任及損失費用，均由乙方承擔。"
          ] }
        ]
      },
      {
        partId: "contract-cabin",
        partNumber: "第二份契約",
        partTitle: "露營車廂租賃合約",
        partSummary: "藍色露營車廂與露營設備有償租賃，規範租金、使用方式、返還與損害責任。",
        illustrationSrc: "/assets/images/contract/blue-camper-cabin-rental-scope-diagram.webp",
        illustrationAlt: "JoyForest CamperVan 插圖中以藍色標示有償租賃的露營車廂範圍",
        scopeType: "cabin",
        scopeCaption: "第二份契約標的是圖中藍色露營車廂與交車時點交的露營設備；不包含前方 K2500 車體。",
        title: "第二部分｜露營車廂租賃合約",
        subtitle: "雙方資料與電子簽署",
        sections: [
          { heading: "甲方", paragraphs: [`姓名：${provider.name || ""}（${provider.role || "聯邦國際租賃股份有限公司桃園分公司租賃小貨車長租租用人"}）`, `出生年月日：${provider.birthDate || "民國 71 年 7 月 22 日"}`, `身分證字號：${provider.idNumber || "J122062030"}`, `聯絡電話：${provider.phone || "0911252302"}`, `戶籍地址：${provider.address || "桃園市中壢區元化路 95 巷 14 號 4 樓"}`, "甲方簽名：____________________"] },
          { heading: "乙方", paragraphs: [`姓名：${data.customerName || "____________"}`, `出生年月日：${data.birthDate || "____________"}`, `身分證字號：${data.idNumber || "____________"}`, `聯絡電話：${data.phone || "____________"}`, `戶籍地址：${data.address || "____________"}`, "乙方簽名：見本電子文件每頁所附手寫電子簽名"] },
          { heading: "電子簽署", paragraphs: ["乙方於本系統完成手寫簽名後，本份合約的文字、租賃標的圖片、資料確認頁、簽署時間、文件編號及電子簽名共同構成完整電子文件。"] }
        ]
      },
      {
        partId: "contract-cabin",
        partNumber: "第二份契約",
        partTitle: "露營車廂租賃合約",
        partSummary: "藍色露營車廂與露營設備有償租賃，規範租金、使用方式、返還與損害責任。",
        illustrationSrc: "/assets/images/contract/blue-camper-cabin-rental-scope-diagram.webp",
        illustrationAlt: "JoyForest CamperVan 插圖中以藍色標示有償租賃的露營車廂範圍",
        scopeType: "cabin",
        scopeCaption: "第二份契約標的是圖中藍色露營車廂與交車時點交的露營設備；不包含前方 K2500 車體。",
        title: "第二部分｜露營車廂租賃合約",
        subtitle: "露營車廂結構圖與內外觀",
        visualAppendixSrc: "/assets/images/contract/camper-cabin-structure-and-interior-reference.webp",
        visualAppendixAlt: "露營車廂長寬高尺寸、外觀、設備艙、遮陽棚、客廳座位與浴廁內裝參考圖",
        sections: []
      }
    ];
  }

  function drawContractParagraph(ctx, text, x, y, maxWidth, lineHeight = 36) {
    let line = "";
    for (const char of [...String(text || "")]) {
      if (ctx.measureText(line + char).width > maxWidth && line) {
        ctx.fillText(line, x, y);
        line = char;
        y += lineHeight;
      } else {
        line += char;
      }
    }
    if (line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
    }
    return y;
  }

  function drawImageContain(ctx, image, x, y, width, height) {
    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
  }

  async function contractPagePng(model, index, total, signedAt, documentId, signatureSrc) {
    const canvas = document.createElement("canvas");
    canvas.width = 1240;
    canvas.height = 1754;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fffdfa";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#173f34";
    ctx.fillRect(0, 0, canvas.width, 210);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 52px -apple-system, sans-serif";
    ctx.fillText(model.title, 74, 96);
    ctx.font = "24px -apple-system, sans-serif";
    ctx.fillText(model.subtitle, 74, 145);
    ctx.fillText(`第 ${index + 1}／${total} 頁`, 1030, 145);
    if (model.visualAppendixSrc) {
      const appendixImage = await loadImage(model.visualAppendixSrc);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(74, 250, 1092, 1290);
      drawImageContain(ctx, appendixImage, 94, 270, 1052, 1250);
    } else {
      let y = 275;
      model.sections.forEach((section) => {
        ctx.fillStyle = "#173f34";
        ctx.font = "800 29px -apple-system, sans-serif";
        ctx.fillText(section.heading, 74, y);
        y += 49;
        ctx.fillStyle = "#1d2925";
        ctx.font = "23px -apple-system, sans-serif";
        section.paragraphs.forEach((paragraph) => {
          y = drawContractParagraph(ctx, paragraph, 86, y, 1060, 35) + 12;
        });
        y += 18;
      });
    }
    ctx.strokeStyle = "#b8c9c0";
    ctx.beginPath();
    ctx.moveTo(74, 1590);
    ctx.lineTo(1166, 1590);
    ctx.stroke();
    ctx.fillStyle = "#54615b";
    ctx.font = "18px -apple-system, sans-serif";
    ctx.fillText(`文件編號：${documentId}｜簽署時間：${signedAt}`, 74, 1630);
    if (signatureSrc) {
      const signature = await loadImage(signatureSrc);
      ctx.drawImage(signature, 820, 1588, 300, 105);
      ctx.fillText("承租人電子簽名", 820, 1710);
    } else {
      ctx.fillText("簽署後將在每頁附上文件編號、時間與電子簽名。", 74, 1680);
    }
    return canvas.toDataURL("image/png");
  }

  async function contractScopePagePng(partId, signedAt, documentId, signatureSrc) {
    const vehiclePart = partId === "contract-vehicle";
    const canvas = document.createElement("canvas");
    canvas.width = 1240;
    canvas.height = 1754;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fffdfa";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = vehiclePart ? "#7c4f26" : "#173f34";
    ctx.fillRect(0, 0, canvas.width, 240);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 49px -apple-system, sans-serif";
    ctx.fillText(vehiclePart ? "第一份契約標的｜K2500 車體" : "第二份契約標的｜藍色露營車廂", 70, 105);
    ctx.font = "25px -apple-system, sans-serif";
    ctx.fillText(vehiclePart ? "無償借用｜不收取車輛租金" : "有償租賃｜租金僅對應車廂與露營設備", 70, 160);

    const illustration = await loadImage(vehiclePart
      ? "/assets/images/contract/campervan-vehicle-and-cabin-overview-line-diagram.webp"
      : "/assets/images/contract/blue-camper-cabin-rental-scope-diagram.webp");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(70, 300, 1100, 700);
    drawImageContain(ctx, illustration, 90, 320, 1060, 660);
    ctx.strokeStyle = vehiclePart ? "#b36c2f" : "#2d89ad";
    ctx.lineWidth = 8;
    if (vehiclePart) ctx.strokeRect(180, 525, 475, 355);
    else ctx.strokeRect(355, 385, 700, 455);
    ctx.fillStyle = vehiclePart ? "#7c4f26" : "#173f34";
    ctx.font = "800 32px -apple-system, sans-serif";
    ctx.fillText(vehiclePart ? "本契約：前方 K2500 車體與行駛系統" : "本契約：圖中藍色露營車廂與露營設備", 90, 1080);
    ctx.font = "25px -apple-system, sans-serif";
    ctx.fillStyle = "#34423c";
    const scopeText = vehiclePart
      ? "第一份契約標的是 K2500 車體、底盤、動力與行駛系統；不包含後方露營車廂與露營設備。車體由甲方無償借予乙方使用。"
      : "第二份契約標的是藍色露營車廂與交車時點交的露營設備；不包含前方 K2500 車體。租金、訂金與押金均記載在本份契約。";
    drawContractParagraph(ctx, scopeText, 90, 1140, 1060, 40);
    ctx.fillStyle = "#eef5f1";
    ctx.fillRect(80, 1320, 1080, 120);
    ctx.fillStyle = "#29483e";
    ctx.font = "700 24px -apple-system, sans-serif";
    drawContractParagraph(ctx, "兩份契約在同一個電子流程填寫與簽署，但標的、費用及責任分開記載。", 110, 1370, 1020, 36);
    ctx.strokeStyle = "#b8c9c0";
    ctx.beginPath();
    ctx.moveTo(74, 1590);
    ctx.lineTo(1166, 1590);
    ctx.stroke();
    ctx.fillStyle = "#54615b";
    ctx.font = "18px -apple-system, sans-serif";
    ctx.fillText(`文件編號：${documentId}｜簽署時間：${signedAt}`, 74, 1630);
    if (signatureSrc) {
      const signature = await loadImage(signatureSrc);
      ctx.drawImage(signature, 820, 1588, 300, 105);
      ctx.fillText("承租人電子簽名", 820, 1710);
    }
    return canvas.toDataURL("image/png");
  }

  async function createContractPageImages(data, partId, signedAt, documentId, signatureSrc) {
    const models = contractPageModels(data).filter((model) => model.partId === partId);
    return Promise.all(models.map((model, index) => contractPagePng(model, index, models.length, signedAt, documentId, signatureSrc)));
  }

  function setupImageInput(inputId, previewId, setter) {
    const input = $(`#${inputId}`);
    const preview = $(`#${previewId}`);
    const card = input.closest(".upload-card");
    const status = $(`#${inputId}-status`);
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (status) status.textContent = "正在處理照片…";
      try {
        const dataUrl = await resizeImage(file, 1800, .86);
        setter(dataUrl);
        preview.src = dataUrl;
        preview.hidden = false;
        card?.classList.add("has-preview");
        if (status) status.textContent = `已選擇：${file.name || "相機照片"}`;
      } catch {
        setter("");
        preview.hidden = true;
        card?.classList.remove("has-preview");
        if (status) status.textContent = "這張照片無法讀取，請重新拍攝或選擇其他照片。";
      }
    });
  }

  function resizeImage(file, maxEdge, quality) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.naturalWidth * scale);
        canvas.height = Math.round(image.naturalHeight * scale);
        const context = canvas.getContext("2d");
        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(image.src);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      image.onerror = reject;
      image.src = URL.createObjectURL(file);
    });
  }

  function setupSignaturePad() {
    const canvas = $("#signature-pad");
    const context = canvas.getContext("2d");
    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const rect = canvas.getBoundingClientRect();
      const snapshot = signatureHasInk ? canvas.toDataURL() : "";
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = "#17211e";
      context.lineWidth = 2.6;
      if (snapshot) {
        const image = new Image();
        image.onload = () => context.drawImage(image, 0, 0, rect.width, rect.height);
        image.src = snapshot;
      }
    };
    requestAnimationFrame(resize);
    window.addEventListener("resize", resize, { passive: true });
    let drawing = false;
    const point = (event) => {
      const rect = canvas.getBoundingClientRect();
      const source = event.touches?.[0] || event;
      return { x: source.clientX - rect.left, y: source.clientY - rect.top };
    };
    const start = (event) => {
      drawing = true;
      canvas.setPointerCapture?.(event.pointerId);
      const p = point(event);
      context.beginPath();
      context.moveTo(p.x, p.y);
      event.preventDefault();
    };
    const move = (event) => {
      if (!drawing) return;
      const p = point(event);
      context.lineTo(p.x, p.y);
      context.stroke();
      signatureHasInk = true;
      $("#signature-placeholder").hidden = true;
      $("#signature-status").textContent = "已完成簽名";
      event.preventDefault();
    };
    const end = (event) => {
      drawing = false;
      if (event?.pointerId !== undefined && canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    canvas.addEventListener("pointerdown", start);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    window.addEventListener("pointerup", end);
    $("#clear-signature").addEventListener("click", () => {
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.restore();
      signatureHasInk = false;
      signatureDataUrl = "";
      $("#signature-placeholder").hidden = false;
      $("#signature-status").textContent = "尚未簽名";
    });
  }

  function currentSignerData() {
    const values = collectForm($("#signer-form"));
    const changed = [];
    criticalKeys.forEach((key) => {
      if (String(values[key] || "") !== String(originalDraft[key] || "")) changed.push(fieldLabels[key]);
    });
    return {
      ...draft,
      ...values,
      changedFields: changed,
      documentType: $("#document-type").value,
      rewardBundleSelected: $("#reward-bundle-selected").checked,
      vehicleContractRead: $("#vehicle-contract-read").checked,
      cabinContractRead: $("#cabin-contract-read").checked,
      electronicConsent: $("#electronic-consent").checked,
      privacyConsent: $("#privacy-consent").checked
    };
  }

  function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 2) {
    const characters = [...String(text || "—")];
    let line = "";
    let lineIndex = 0;
    for (const char of characters) {
      const trial = line + char;
      if (ctx.measureText(trial).width > maxWidth && line) {
        ctx.fillText(line, x, y + lineIndex * lineHeight);
        line = char;
        lineIndex += 1;
        if (lineIndex >= maxLines - 1) break;
      } else {
        line = trial;
      }
    }
    if (lineIndex < maxLines) ctx.fillText(line, x, y + lineIndex * lineHeight);
  }

  async function confirmationPagePng(data, signedAt, documentId, copyType = "owner") {
    const canvas = document.createElement("canvas");
    canvas.width = 1240;
    canvas.height = 1754;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fffdfa";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#173f34";
    ctx.fillRect(0, 0, canvas.width, 250);
    ctx.fillStyle = "white";
    ctx.font = "700 34px -apple-system, sans-serif";
    ctx.fillText("揪好森露營車出租", 80, 88);
    ctx.font = "800 58px -apple-system, sans-serif";
    const confirmationTitle = copyType === "vehicle" ? "借車合約｜資料確認" : copyType === "cabin" ? "露營車廂租賃｜資料確認" : "業者存證包｜資料確認";
    ctx.fillText(confirmationTitle, 80, 174);
    ctx.fillStyle = "#1d2925";
    ctx.font = "700 28px -apple-system, sans-serif";
    ctx.fillText(`文件編號：${documentId}`, 80, 310);
    ctx.font = "24px -apple-system, sans-serif";
    ctx.fillStyle = "#54615b";
    ctx.fillText(`簽署時間：${signedAt}`, 80, 354);

    const commonRows = [
      ["承租人姓名", data.customerName], ["聯絡電話", data.phone], ["出生年月日", data.birthDate], ["證件號碼", data.idNumber],
      ["聯絡地址", data.address], ["租借期間", `${data.rentalStartDate || ""} ${data.rentalStartTime || ""} 至 ${data.rentalEndDate || ""} ${data.rentalEndTime || ""}`],
      ["交車地點", data.deliveryLocation], ["還車地點", data.returnLocation]
    ];
    const vehicleRows = [["借用標的", "K2500 車體、底盤、動力與行駛系統"], ["車體借用費用", "無償（NT$0）"]];
    const cabinRows = [
      ["租賃標的", "藍色露營車廂與交車時點交設備"],
      ["車廂設備租金", data.rentalFee],
      ["訂金／押金", `${data.reservationDeposit || "—"}／${data.securityDeposit || "—"}`],
      ["回饋套組", data.rewardBundleSelected ? "已勾選參加五星評價回饋活動" : "未選擇參加"]
    ];
    const rows = [
      ...commonRows,
      ...(copyType === "vehicle" ? vehicleRows : copyType === "cabin" ? cabinRows : [...vehicleRows, ...cabinRows]),
      ["身分證明", `${documentTypeLabel(data.documentType)}正反面已提供（完整影像僅存於業者存證版）`]
    ];
    let y = 410;
    const rowGap = rows.length > 12 ? 60 : 70;
    rows.forEach(([label, value]) => {
      ctx.fillStyle = "#65716c";
      ctx.font = "700 24px -apple-system, sans-serif";
      ctx.fillText(label, 80, y);
      ctx.fillStyle = "#1d2925";
      ctx.font = "28px -apple-system, sans-serif";
      wrapCanvasText(ctx, value, 310, y, 830, 36, 2);
      ctx.strokeStyle = "#d9dfda";
      ctx.beginPath();
      ctx.moveTo(80, y + 24);
      ctx.lineTo(1160, y + 24);
      ctx.stroke();
      y += rowGap;
    });

    if (data.changedFields?.length) {
      ctx.fillStyle = "#fff4cf";
      ctx.fillRect(80, 1300, 1080, 95);
      ctx.fillStyle = "#755600";
      ctx.font = "700 22px -apple-system, sans-serif";
      ctx.fillText("客人曾更正的重要欄位：", 110, 1340);
      ctx.font = "22px -apple-system, sans-serif";
      wrapCanvasText(ctx, data.changedFields.join("、"), 110, 1375, 1000, 30, 1);
    }

    ctx.fillStyle = "#65716c";
    ctx.font = "22px -apple-system, sans-serif";
    const readStatus = copyType === "vehicle"
      ? `借車合約：${data.vehicleContractRead ? "已勾選" : "未勾選"}`
      : copyType === "cabin"
        ? `車廂租賃：${data.cabinContractRead ? "已勾選" : "未勾選"}`
        : `借車：${data.vehicleContractRead ? "已勾選" : "未勾選"}｜車廂：${data.cabinContractRead ? "已勾選" : "未勾選"}`;
    const consentText = `${readStatus}｜電子簽署：${data.electronicConsent ? "已勾選" : "未勾選"}｜個資：${data.privacyConsent ? "已勾選" : "未勾選"}`;
    ctx.fillText(consentText, 80, 1450);
    ctx.fillStyle = "#1d2925";
    ctx.font = "700 24px -apple-system, sans-serif";
    ctx.fillText("承租人電子簽名", 80, 1510);
    if (signatureDataUrl) {
      const signature = await loadImage(signatureDataUrl);
      ctx.drawImage(signature, 300, 1475, 720, 180);
    }
    ctx.strokeStyle = "#173f34";
    ctx.lineWidth = 2;
    ctx.strokeRect(280, 1460, 800, 210);
    ctx.fillStyle = "#65716c";
    ctx.font = "18px -apple-system, sans-serif";
    const bindingText = copyType === "vehicle" ? "本確認頁與第一份借車合約，以同一文件編號及簽署時間綁定。" : copyType === "cabin" ? "本確認頁與第二份露營車廂租賃合約，以同一文件編號及簽署時間綁定。" : "本存證包包含兩份分開製作的契約與證件附件。";
    ctx.fillText(bindingText, 80, 1710);
    return canvas.toDataURL("image/png");
  }

  function documentTypeLabel(type) {
    if (type === "national-id") return "身分證";
    if (type === "passport") return "護照／外國駕駛文件";
    return "駕駛執照";
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  async function evidencePagePng(data, signedAt, documentId) {
    const canvas = document.createElement("canvas");
    canvas.width = 1240;
    canvas.height = 1754;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#173f34";
    ctx.fillRect(0, 0, canvas.width, 210);
    ctx.fillStyle = "white";
    ctx.font = "800 52px -apple-system, sans-serif";
    ctx.fillText("業者存證附件｜證件影像", 70, 115);
    ctx.font = "22px -apple-system, sans-serif";
    ctx.fillText(`${documentTypeLabel(data.documentType)}｜${data.customerName || "承租人"}｜${documentId}`, 70, 162);
    const drawPhoto = async (src, label, top) => {
      ctx.fillStyle = "#1d2925";
      ctx.font = "700 28px -apple-system, sans-serif";
      ctx.fillText(label, 70, top);
      ctx.strokeStyle = "#cfd8d2";
      ctx.strokeRect(70, top + 30, 1100, 570);
      if (!src) return;
      const image = await loadImage(src);
      const scale = Math.min(1060 / image.naturalWidth, 530 / image.naturalHeight);
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      ctx.drawImage(image, 70 + (1100 - width) / 2, top + 50 + (530 - height) / 2, width, height);
    };
    await drawPhoto(documentFront, "證件正面", 270);
    await drawPhoto(documentBack, "證件反面", 940);
    ctx.fillStyle = "#65716c";
    ctx.font = "20px -apple-system, sans-serif";
    ctx.fillText(`簽署時間：${signedAt}`, 70, 1650);
    ctx.fillText("本頁含敏感個人資料，限履約、身分核對及爭議處理使用，請勿公開轉傳。", 70, 1695);
    return canvas.toDataURL("image/jpeg", .9);
  }

  async function buildPdf(data, signedAt, documentId, copyType, includeEvidence, contractImages) {
    const { PDFDocument } = window.PDFLib;
    const output = await PDFDocument.create();
    output.setTitle(`Joyforest Campervan Rental Agreement ${documentId}`);
    output.setAuthor("Joyforest CamperVan Rental");
    output.setSubject(copyType === "vehicle" ? "Vehicle loan agreement" : copyType === "cabin" ? "Camper cabin rental agreement" : "Owner evidence package");
    output.setKeywords(["Joyforest", "CamperVan", "Rental", "Agreement", documentId]);
    const confirmationPng = await confirmationPagePng(data, signedAt, documentId, copyType);
    const confirmationImage = await output.embedPng(confirmationPng);
    const cover = output.addPage([595.28, 841.89]);
    cover.drawImage(confirmationImage, { x: 0, y: 0, width: 595.28, height: 841.89 });

    for (const pagePng of contractImages) {
      const image = await output.embedPng(pagePng);
      const page = output.addPage([595.28, 841.89]);
      page.drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
    }

    if (includeEvidence) {
      const evidenceJpg = await evidencePagePng(data, signedAt, documentId);
      const evidenceImage = await output.embedJpg(evidenceJpg);
      const evidencePage = output.addPage([595.28, 841.89]);
      evidencePage.drawImage(evidenceImage, { x: 0, y: 0, width: 595.28, height: 841.89 });
    }
    return output.save();
  }

  async function completeSigning(event) {
    event.preventDefault();
    const form = $("#signer-form");
    const status = $("#completion-status");
    const button = $("#complete-signing");
    button.disabled = true;
    status.className = "status-line";
    status.textContent = "正在分別製作借車合約、露營車廂租賃合約與業者存證包…";
    try {
      signatureDataUrl = signatureHasInk ? $("#signature-pad").toDataURL("image/png") : "";
      const data = currentSignerData();
      const signedAt = new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Taipei" }).format(new Date());
      const documentId = `JF-${todayYmd().replaceAll("-", "")}-${draftToken.toUpperCase()}`;
      const vehicleDocumentId = `${documentId}-V`;
      const cabinDocumentId = `${documentId}-C`;
      const [vehicleScopeImage, cabinScopeImage, vehicleContractPages, cabinContractPages] = await Promise.all([
        contractScopePagePng("contract-vehicle", signedAt, vehicleDocumentId, signatureDataUrl),
        contractScopePagePng("contract-cabin", signedAt, cabinDocumentId, signatureDataUrl),
        createContractPageImages(data, "contract-vehicle", signedAt, vehicleDocumentId, signatureDataUrl),
        createContractPageImages(data, "contract-cabin", signedAt, cabinDocumentId, signatureDataUrl)
      ]);
      const vehicleContractImages = [vehicleScopeImage, ...vehicleContractPages];
      const cabinContractImages = [cabinScopeImage, ...cabinContractPages];
      const [vehicleBytes, cabinBytes, ownerBytes] = await Promise.all([
        buildPdf(data, signedAt, vehicleDocumentId, "vehicle", false, vehicleContractImages),
        buildPdf(data, signedAt, cabinDocumentId, "cabin", false, cabinContractImages),
        buildPdf(data, signedAt, documentId, "owner", true, [...vehicleContractImages, ...cabinContractImages])
      ]);
      vehiclePdfBlob = new Blob([vehicleBytes], { type: "application/pdf" });
      cabinPdfBlob = new Blob([cabinBytes], { type: "application/pdf" });
      ownerPdfBlob = new Blob([ownerBytes], { type: "application/pdf" });
      if (vehiclePdfUrl) URL.revokeObjectURL(vehiclePdfUrl);
      if (cabinPdfUrl) URL.revokeObjectURL(cabinPdfUrl);
      if (ownerPdfUrl) URL.revokeObjectURL(ownerPdfUrl);
      vehiclePdfUrl = URL.createObjectURL(vehiclePdfBlob);
      cabinPdfUrl = URL.createObjectURL(cabinPdfBlob);
      ownerPdfUrl = URL.createObjectURL(ownerPdfBlob);
      $("#download-vehicle").href = vehiclePdfUrl;
      $("#download-vehicle").download = `${vehicleDocumentId}-借車合約.pdf`;
      $("#download-cabin").href = cabinPdfUrl;
      $("#download-cabin").download = `${cabinDocumentId}-露營車廂租賃合約.pdf`;
      $("#download-owner").href = ownerPdfUrl;
      $("#download-owner").download = `${documentId}-業者存證包.pdf`;
      $("#result-document-id").textContent = documentId;
      $("#result-panel").hidden = false;
      $("#result-panel").scrollIntoView({ behavior: "smooth" });
      status.textContent = "兩份獨立契約與業者存證包都已產生。請保存兩份契約，並把業者存證包分享給揪好森。";
    } catch (error) {
      console.error(error);
      status.className = "status-line error";
      status.textContent = "PDF 產生失敗，請保留此頁並聯絡揪好森重新處理。";
    } finally {
      button.disabled = false;
    }
  }

  async function sharePdf(kind) {
    const pdfMap = {
      vehicle: { blob: vehiclePdfBlob, name: "借車合約", selector: "#download-vehicle" },
      cabin: { blob: cabinPdfBlob, name: "露營車廂租賃合約", selector: "#download-cabin" },
      owner: { blob: ownerPdfBlob, name: "業者存證包", selector: "#download-owner" }
    };
    const selected = pdfMap[kind];
    const blob = selected?.blob;
    if (!blob) return;
    const documentId = $("#result-document-id").textContent;
    const copyName = selected.name;
    const file = new File([blob], `${documentId}-${copyName}.pdf`, { type: "application/pdf" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ title: "揪好森露營車電子合約", text: `已完成簽署，附件為${copyName} PDF。`, files: [file] });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    $(selected.selector).click();
    alert(`這支手機未支援從網頁直接分享 PDF，已開啟／下載${copyName}；請在 LINE 中選擇檔案傳送。`);
  }

  function directPublicDraft() {
    return {
      customerName: "", phone: "", birthDate: "", idNumber: "", address: "",
      rentalStartDate: "", rentalStartTime: "15:00", rentalEndDate: "", rentalEndTime: "15:00",
      deliveryLocation: "", returnLocation: "", rentalFee: "", reservationDeposit: "", securityDeposit: "NT$5,000",
      calendarStatus: "direct", calendarSummary: "客人直接填寫", issuedAt: new Date().toISOString(), version: "direct-public-2",
      provider: {
        name: "陳在紳",
        role: "聯邦國際租賃股份有限公司桃園分公司租賃小貨車長租租用人"
      },
      vehicle: { plate: "RBU-8280", description: "KIA 卡旺 2497cc 雙廂式" }
    };
  }

  const queryContract = new URLSearchParams(location.search).get("contract");
  const hashMatch = location.hash.match(/^#contract=(.+)$/);
  if (queryContract) buildSigner(queryContract);
  else if (hashMatch) buildSigner(hashMatch[1]);
  else if (location.hostname.endsWith("joyforest.tw")) buildSigner(encodeDraft(directPublicDraft()));
  else buildAdmin();
})();
