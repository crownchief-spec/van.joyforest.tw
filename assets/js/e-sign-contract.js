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
    deliveryLocation: "交車地點", returnLocation: "還車地點", rentalFee: "租金", reservationDeposit: "預約訂金", securityDeposit: "還車結算押金"
  };
  let draft = null;
  let originalDraft = null;
  let draftToken = "";
  let signatureHasInk = false;
  let signatureDataUrl = "";
  let documentFront = "";
  let documentBack = "";
  let customerPdfBlob = null;
  let ownerPdfBlob = null;
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
    setupContractAssets();
    const fieldRoot = $("#signer-fields");
    Object.keys(fieldLabels).forEach((key) => fieldRoot.append(makeSignerField(key, draft[key])));
    fieldRoot.addEventListener("input", (event) => {
      if (criticalKeys.has(event.target.name) && event.target.value !== String(originalDraft[event.target.name] || "")) {
        $("#critical-change-warning").hidden = false;
      }
    });
    setupImageInput("document-front", "document-front-preview", (value) => { documentFront = value; });
    setupImageInput("document-back", "document-back-preview", (value) => { documentBack = value; });
    setupSignaturePad();
    $("#signer-form").addEventListener("submit", completeSigning);
    $("#share-customer").addEventListener("click", shareOwnerEvidence);
  }

  async function setupContractAssets() {
    const images = await createContractPageImages(draft, "尚未簽署", "預覽", "");
    $$('[data-contract-asset]').forEach((image, index) => { image.src = images[index]; });
    $$('[data-contract-link]').forEach((link, index) => { link.href = images[index]; });
  }

  function contractPageModels(data) {
    const provider = data.provider || {};
    const vehicle = data.vehicle || {};
    const rentalPeriod = `${data.rentalStartDate || "____-__-__"} ${data.rentalStartTime || "__:__"} 至 ${data.rentalEndDate || "____-__-__"} ${data.rentalEndTime || "__:__"}`;
    const customer = `${data.customerName || "____________"}｜證件號碼：${data.idNumber || "____________"}｜電話：${data.phone || "____________"}`;
    const providerLine = `${provider.name || "揪好森露營車出租"}${provider.role ? `（${provider.role}）` : ""}`;
    return [
      {
        title: "借車合約書",
        subtitle: "借用車輛與行車責任",
        sections: [
          { heading: "合約雙方", paragraphs: [`車輛提供方（甲方）：${providerLine}`, `車輛借用方（乙方）：${customer}`] },
          { heading: "借用車輛", paragraphs: [`車牌：${vehicle.plate || "RBU-8280"}｜車型：${vehicle.description || "KIA 卡旺 2497cc 雙廂式"}`, `借用期間：${rentalPeriod}`] },
          { heading: "借用內容", paragraphs: [
            "• 甲方將車輛無償借給乙方使用。乙方使用期間須負擔燃油費（滿油出車、滿油還車）、高速公路 ETC、停車費等相關費用。",
            "• 乙方須具備合法小型車駕駛執照並隨身攜帶。無照、酒駕、毒駕或交由未經甲方同意的人駕駛，致保險拒賠時，相關責任及費用由乙方負擔。",
            "• 甲方隨車提供行照、車輛保險證等文件，乙方應妥善保管；如有遺失，應賠償相應損失。",
            "• 乙方不得買賣、抵押、質押、贈與車輛，亦不得使用車輛從事營業性活動。"
          ] }
        ]
      },
      {
        title: "借車合約書",
        subtitle: "故障、事故與雙方資料",
        sections: [
          { heading: "車況與故障", paragraphs: [
            "• 交還時應保持車輛運作良好。使用期間如出現故障或異常，乙方應立即通知甲方，並依甲方指示送至指定維修廠檢查；不得自行拆卸、更換原車裝置或零件。",
            "• 因非正常使用造成的事故、損失及費用，由乙方負擔。"
          ] },
          { heading: "事故與保險", paragraphs: [
            "• 借用期間發生事故，乙方應立即通知甲方並報案，甲方協助向保險公司申請理賠。屬保險賠付範圍者由保險公司負擔；免賠、拒賠或保險不受理的損失，由乙方負擔。",
            "• 乙方並應負擔依法或依實際情形應由其負擔的修理費、修理期間經濟損失及本案相關費用。"
          ] },
          { heading: "甲方資料", paragraphs: [`姓名：${provider.name || ""}`, `出生年月日：${provider.birthDate || ""}｜身分證字號：${provider.idNumber || ""}`, `聯絡電話：${provider.phone || ""}｜戶籍地址：${provider.address || ""}`] },
          { heading: "乙方資料", paragraphs: [`${customer}`, `地址：${data.address || "____________"}`] }
        ]
      },
      {
        title: "露營車廂租賃合約",
        subtitle: "租賃標的、期間與費用",
        sections: [
          { heading: "合約雙方", paragraphs: [`出租人（甲方）：${providerLine}`, `承租人（乙方）：${customer}`] },
          { heading: "租賃規定", paragraphs: [
            "租賃物：露營車廂及交車時點交的隨車設備。",
            `租賃期間：${rentalPeriod}`,
            `租賃費用：${data.rentalFee || "____________"}｜預約訂金：${data.reservationDeposit || "____________"}｜還車結算押金：${data.securityDeposit || "____________"}`,
            "本票：無需本票。押金於還車檢查後退還，並得扣除 ETC、未補足費用或車體／設備損傷。"
          ] },
          { heading: "五星評價回饋活動", paragraphs: [
            "網美露營套組／影音娛樂套組得依當期活動優惠免費體驗（原租賃費用 NT$3,800）。活動條件為交車時完成指定打卡與評論，例如 Google 兩則五星附圖評論，或 Google、Instagram 各一則；實際內容以交車時說明為準。"
          ] }
        ]
      },
      {
        title: "露營車廂租賃合約",
        subtitle: "使用、事故與賠償責任",
        sections: [
          { heading: "租賃內容", paragraphs: [
            "• 超出預定租賃期間，每小時加收 NT$300，並應事先取得甲方同意。",
            "• 發生交通事故致露營車廂損壞時，乙方應立即通知甲方並報案。屬保險賠付範圍者由保險公司負擔；免賠、拒賠或其他不受理損失，由乙方負擔修理費、修理期間經濟損失及相關費用。",
            "• 露營車廂並非車體；事故理賠時可能按財物損失處理，一般強制險無法賠償財損。",
            "• 維修費用依指定維修廠報價。指定維修廠：家吼勝 HOME FUN／露營車俱樂部，桃園市八德區廣興路 1320 號。",
            "• 租用期間不得買賣、抵押、質押、贈與露營車廂，或用於營業性活動。",
            "• 交還時應維持物品完整與功能正常，並以交車時錄影、照片及點交內容為憑。",
            "• 使用中出現故障或異常應立即通知甲方，不得自行拆卸或更換裝置與零件；非正常使用造成的責任與損失由乙方負擔。"
          ] }
        ]
      },
      {
        title: "露營車廂租賃合約",
        subtitle: "雙方資料與車廂點交",
        sections: [
          { heading: "甲方資料", paragraphs: [`姓名：${provider.name || ""}`, `出生年月日：${provider.birthDate || ""}｜身分證字號：${provider.idNumber || ""}`, `聯絡電話：${provider.phone || ""}`, `戶籍地址：${provider.address || ""}`] },
          { heading: "乙方資料", paragraphs: [`${customer}`, `地址：${data.address || "____________"}`] },
          { heading: "車廂結構與內外觀", paragraphs: [
            "露營車廂的床鋪、桌椅、櫃體、廚房、冰箱、冷暖氣、供電、供水、熱水與浴廁等設備，以交車現場說明、點交照片及錄影為準。",
            "承租人已於交車時確認外觀、車廂結構、隨車物品及各項設備狀態；如現場發現異常，應立即提出並留存照片或錄影。",
            `交車地點：${data.deliveryLocation || "____________"}`,
            `還車地點：${data.returnLocation || "____________"}`
          ] },
          { heading: "電子簽署", paragraphs: ["乙方於本系統完成手寫簽名後，本頁與前述合約頁、資料確認頁、簽署時間及同一文件編號共同構成完整電子文件。"] }
        ]
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

  async function createContractPageImages(data, signedAt, documentId, signatureSrc) {
    const models = contractPageModels(data);
    return Promise.all(models.map((model, index) => contractPagePng(model, index, models.length, signedAt, documentId, signatureSrc)));
  }

  function setupImageInput(inputId, previewId, setter) {
    const input = $(`#${inputId}`);
    const preview = $(`#${previewId}`);
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await resizeImage(file, 1800, .86);
        setter(dataUrl);
        preview.src = dataUrl;
        preview.hidden = false;
      } catch {
        setter("");
        preview.hidden = true;
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
    const end = () => { drawing = false; };
    canvas.addEventListener("pointerdown", start);
    canvas.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    $("#clear-signature").addEventListener("click", () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
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
      contractsRead: $("#contracts-read").checked,
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

  async function confirmationPagePng(data, signedAt, documentId) {
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
    ctx.fillText("電子簽署暨資料確認頁", 80, 174);
    ctx.fillStyle = "#1d2925";
    ctx.font = "700 28px -apple-system, sans-serif";
    ctx.fillText(`文件編號：${documentId}`, 80, 310);
    ctx.font = "24px -apple-system, sans-serif";
    ctx.fillStyle = "#54615b";
    ctx.fillText(`簽署時間：${signedAt}`, 80, 354);

    const rows = [
      ["承租人姓名", data.customerName], ["聯絡電話", data.phone], ["出生年月日", data.birthDate], ["證件號碼", data.idNumber],
      ["聯絡地址", data.address], ["租借期間", `${data.rentalStartDate || ""} ${data.rentalStartTime || ""} 至 ${data.rentalEndDate || ""} ${data.rentalEndTime || ""}`],
      ["交車地點", data.deliveryLocation], ["還車地點", data.returnLocation], ["租金", data.rentalFee],
      ["預約訂金", data.reservationDeposit], ["還車結算押金", data.securityDeposit], ["身分證明", `${documentTypeLabel(data.documentType)}正反面已提供（完整影像僅存於業者存證版）`]
    ];
    let y = 430;
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
      y += label === "聯絡地址" || label.includes("地點") ? 92 : 72;
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
    const consentText = `合約閱讀：${data.contractsRead ? "已勾選" : "未勾選"}｜電子簽署：${data.electronicConsent ? "已勾選" : "未勾選"}｜個資告知：${data.privacyConsent ? "已勾選" : "未勾選"}`;
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
    ctx.fillText("本確認頁與後續 5 頁合約以同一文件編號及簽署時間綁定。", 80, 1710);
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

  async function buildPdf(data, signedAt, documentId, includeEvidence, contractImages) {
    const { PDFDocument } = window.PDFLib;
    const output = await PDFDocument.create();
    output.setTitle(`Joyforest Campervan Rental Agreement ${documentId}`);
    output.setAuthor("Joyforest CamperVan Rental");
    output.setSubject(includeEvidence ? "Owner evidence copy" : "Customer signed copy");
    output.setKeywords(["Joyforest", "CamperVan", "Rental", "Agreement", documentId]);
    const confirmationPng = await confirmationPagePng(data, signedAt, documentId);
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
    status.textContent = "正在整理 5 頁合約、簽名與證件，產生兩份 PDF…";
    try {
      signatureDataUrl = signatureHasInk ? $("#signature-pad").toDataURL("image/png") : "";
      const data = currentSignerData();
      const signedAt = new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Taipei" }).format(new Date());
      const documentId = `JF-${todayYmd().replaceAll("-", "")}-${draftToken.toUpperCase()}`;
      const contractImages = await createContractPageImages(data, signedAt, documentId, signatureDataUrl);
      const [customerBytes, ownerBytes] = await Promise.all([
        buildPdf(data, signedAt, documentId, false, contractImages),
        buildPdf(data, signedAt, documentId, true, contractImages)
      ]);
      customerPdfBlob = new Blob([customerBytes], { type: "application/pdf" });
      ownerPdfBlob = new Blob([ownerBytes], { type: "application/pdf" });
      const customerUrl = URL.createObjectURL(customerPdfBlob);
      const ownerUrl = URL.createObjectURL(ownerPdfBlob);
      $("#download-customer").href = customerUrl;
      $("#download-customer").download = `${documentId}-客戶版.pdf`;
      $("#download-owner").href = ownerUrl;
      $("#download-owner").download = `${documentId}-業者存證版.pdf`;
      $("#result-document-id").textContent = documentId;
      $("#result-panel").hidden = false;
      $("#result-panel").scrollIntoView({ behavior: "smooth" });
      status.textContent = "兩份 PDF 已產生完成。請下載客戶版，並把業者存證版分享給揪好森保存。";
    } catch (error) {
      console.error(error);
      status.className = "status-line error";
      status.textContent = "PDF 產生失敗，請保留此頁並聯絡揪好森重新處理。";
      button.disabled = false;
    }
  }

  async function shareOwnerEvidence() {
    if (!ownerPdfBlob) return;
    const documentId = $("#result-document-id").textContent;
    const file = new File([ownerPdfBlob], `${documentId}-業者存證版.pdf`, { type: "application/pdf" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ title: "揪好森露營車電子合約", text: "已完成簽署，附件為業者存證版 PDF。", files: [file] });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    $("#download-owner").click();
    alert("手機未支援直接分享 PDF，已下載業者存證版；請從 LINE 選擇檔案傳送給揪好森。 ");
  }

  const hashMatch = location.hash.match(/^#contract=(.+)$/);
  if (hashMatch) buildSigner(hashMatch[1]);
  else buildAdmin();
})();
