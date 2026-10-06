(() => {
  "use strict";

  const LIVE_SIGNING_BASE = "https://van.joyforest.tw/pages/e-sign-contract.html";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const adminView = $("#admin-view");
  const signerView = $("#signer-view");
  const vehicleFieldDefinitions = [
    { key: "customerName", label: "車輛借用方（乙方）", autocomplete: "name", required: true },
    { key: "phone", label: "電話", inputmode: "tel", autocomplete: "off", required: true },
    { key: "birthDate", label: "乙方出生年月日", type: "date" },
    { key: "idNumber", label: "證件號碼", autocomplete: "off" },
    { key: "address", label: "乙方戶籍／聯絡地址", autocomplete: "street-address", full: true },
    { key: "vehiclePlate", label: "借用車輛車牌" },
    { key: "vehicleDescription", label: "借用車輛／車型" },
    { key: "rentalStartDate", label: "借用開始日期", type: "date", required: true },
    { key: "rentalStartTime", label: "開始時間", type: "time" },
    { key: "rentalEndDate", label: "借用結束日期", type: "date", required: true },
    { key: "rentalEndTime", label: "結束時間", type: "time" },
    { key: "deliveryLocation", label: "交車地點", full: true },
    { key: "returnLocation", label: "還車地點", full: true }
  ];
  const cabinFieldDefinitions = [
    { key: "cabinCustomerName", source: "customerName", label: "承租人（乙方）", autocomplete: "name", required: true },
    { key: "cabinPhone", source: "phone", label: "電話", inputmode: "tel", autocomplete: "off", required: true },
    { key: "cabinBirthDate", source: "birthDate", label: "乙方出生年月日", type: "date" },
    { key: "cabinIdNumber", source: "idNumber", label: "證件號碼", autocomplete: "off" },
    { key: "cabinAddress", source: "address", label: "乙方戶籍／聯絡地址", autocomplete: "street-address", full: true },
    { key: "cabinRentalStartDate", source: "rentalStartDate", label: "租賃開始日期", type: "date", required: true },
    { key: "cabinRentalStartTime", source: "rentalStartTime", label: "開始時間", type: "time" },
    { key: "cabinRentalEndDate", source: "rentalEndDate", label: "租賃結束日期", type: "date", required: true },
    { key: "cabinRentalEndTime", source: "rentalEndTime", label: "結束時間", type: "time" },
    { key: "cabinDeliveryLocation", source: "deliveryLocation", label: "交付地點", full: true },
    { key: "cabinReturnLocation", source: "returnLocation", label: "返還地點", full: true },
    { key: "rentalFee", label: "露營車廂與設備租金", placeholder: "例如 NT$13,800" },
    { key: "reservationDeposit", label: "預約訂金", placeholder: "依本次預約" },
    { key: "securityDeposit", label: "還車結算押金", placeholder: "例如 NT$5,000" },
    { key: "handoverAmount", label: "交車時應付金額（租金－已付訂金＋押金）", readOnly: true, full: true }
  ];
  const signerFieldDefinitions = new Map([...vehicleFieldDefinitions, ...cabinFieldDefinitions].map((field) => [field.key, field]));
  const fieldLabels = Object.fromEntries([...vehicleFieldDefinitions, ...cabinFieldDefinitions].map((field) => [field.key, field.label]));
  const criticalKeys = new Set(["rentalStartDate", "rentalStartTime", "rentalEndDate", "rentalEndTime", "deliveryLocation", "returnLocation", "rentalFee", "reservationDeposit", "securityDeposit"]);
  let draft = null;
  let originalDraft = null;
  let draftToken = "";
  let signatureHasInk = false;
  let signatureDataUrl = "";
  let documentFront = "";
  let documentBack = "";
  let completePdfBlob = null;
  let completePdfUrl = "";
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

  function makeSignerField(definition, value) {
    const { key, label: labelText, type = "text", inputmode, autocomplete, placeholder, required, full, readOnly } = definition;
    const label = document.createElement("label");
    if (full) label.className = "full";
    label.innerHTML = `<span>${labelText}</span><input name="${key}" type="${type}" />`;
    const input = $("input", label);
    if (inputmode) input.inputMode = inputmode;
    if (autocomplete) input.autocomplete = autocomplete;
    if (placeholder) input.placeholder = placeholder;
    if (required) input.required = true;
    if (readOnly) {
      input.readOnly = true;
      input.classList.add("calculated-field");
    }
    // iOS／內嵌瀏覽器設定 autocomplete 時可能重設電話欄位，值最後再寫入。
    input.defaultValue = value || "";
    input.value = value || "";
    return label;
  }

  function signerFieldValue(data, definition) {
    if (definition.key === "vehiclePlate") return data.vehicle?.plate || "";
    if (definition.key === "vehicleDescription") return data.vehicle?.description || "";
    if (definition.source) return data.cabin?.[definition.source] || data[definition.key] || "";
    return data[definition.key] || "";
  }

  function editableSignerData() {
    const values = collectForm($("#signer-form"));
    const cabin = Object.fromEntries(cabinFieldDefinitions
      .filter((field) => field.source)
      .map((field) => [field.source, values[field.key] || ""]));
    return {
      ...draft,
      ...values,
      vehicle: {
        ...(draft?.vehicle || {}),
        plate: values.vehiclePlate || "",
        description: values.vehicleDescription || ""
      },
      cabin,
      rewardBundleSelected: $("#reward-bundle-selected")?.checked || false
    };
  }

  function originalDraftValue(key) {
    if (key === "vehiclePlate") return originalDraft?.vehicle?.plate || "";
    if (key === "vehicleDescription") return originalDraft?.vehicle?.description || "";
    return originalDraft?.[key] || "";
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
    renderContractText({
      ...draft,
      vehicle: { ...(draft.vehicle || {}) },
      cabin: { ...(draft.cabin || {}) },
      rewardBundleSelected: Boolean(draft.rewardBundleSelected)
    });
    // 部分手機瀏覽器會在動態表單插入後，用先前的空白值覆蓋電話等欄位。
    // 只補回仍為空白的預載資料，避免改動客人已經輸入的內容。
    const restorePrefilledFields = () => {
      [...vehicleFieldDefinitions, ...cabinFieldDefinitions].forEach((definition) => {
        const input = $("#signer-form")?.elements.namedItem(definition.key);
        const value = signerFieldValue(draft, definition);
        if (input && !input.value && value) input.value = value;
      });
    };
    restorePrefilledFields();
    requestAnimationFrame(restorePrefilledFields);
    setTimeout(restorePrefilledFields, 250);
    $("#copy-first-contract").addEventListener("click", () => {
      cabinFieldDefinitions.filter((field) => field.source).forEach((field) => {
        const source = $("#signer-form").elements.namedItem(field.source);
        const target = $("#signer-form").elements.namedItem(field.key);
        if (source && target) target.value = source.value;
      });
      $("#copy-first-contract-status").textContent = "已帶入第一份契約資料，請確認內容與費用。";
    });
    setupHandoverAmountCalculator();
    setupImageInputs(["document-front-camera", "document-front-library"], "document-front-preview", "document-front-status", (value) => { documentFront = value; });
    setupImageInputs(["document-back-camera", "document-back-library"], "document-back-preview", "document-back-status", (value) => { documentBack = value; });
    setupSignaturePad();
    $("#signer-form").addEventListener("submit", completeSigning);
    $("#share-complete-contract").addEventListener("click", shareCompletePdf);
  }

  function renderContractText(data) {
    const grouped = [];
    contractPageModels(data).forEach((model) => {
      let group = grouped.find((item) => item.partId === model.partId);
      if (!group) {
        group = {
          partId: model.partId,
          partNumber: model.partNumber,
          partTitle: model.partTitle,
          partSummary: model.partSummary,
          sections: []
        };
        grouped.push(group);
      }
      group.sections.push(...model.sections);
    });
    grouped.forEach((group) => {
      const root = group.partId === "contract-vehicle" ? $("#vehicle-contract-text") : $("#cabin-contract-text");
      if (!root) return;
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

      const body = document.createElement("div");
      body.className = "contract-document__body";
      group.sections.forEach((section) => {
        const clause = document.createElement("section");
        clause.className = "contract-clause";
        const heading = document.createElement("h4");
        heading.textContent = section.heading;
        clause.append(heading);
        (section.screenParagraphs || section.paragraphs).forEach((paragraph) => {
          const text = document.createElement("p");
          text.textContent = paragraph;
          if (String(paragraph).trim().startsWith("•")) text.dataset.listItem = "true";
          clause.append(text);
        });
        if (section.copyFromPrevious) {
          const copyRow = document.createElement("div");
          copyRow.className = "copy-contract-row";
          const copyButton = document.createElement("button");
          copyButton.id = "copy-first-contract";
          copyButton.className = "button primary";
          copyButton.type = "button";
          copyButton.textContent = "帶入第一份契約資料";
          const copyStatus = document.createElement("span");
          copyStatus.id = "copy-first-contract-status";
          copyStatus.className = "status-line";
          copyStatus.role = "status";
          copyStatus.textContent = "姓名、電話、證件、租期與地點可一次帶入。";
          copyRow.append(copyButton, copyStatus);
          clause.append(copyRow);
        }
        if (section.fieldKeys?.length) {
          const fieldGrid = document.createElement("div");
          fieldGrid.className = "form-grid contract-inline-fields";
          section.fieldKeys.forEach((key) => {
            const definition = signerFieldDefinitions.get(key);
            if (definition) fieldGrid.append(makeSignerField(definition, signerFieldValue(data, definition)));
          });
          clause.append(fieldGrid);
        }
        if (section.rewardOption) {
          const reward = document.createElement("label");
          reward.className = "reward-option";
          const rewardInput = document.createElement("input");
          rewardInput.id = "reward-bundle-selected";
          rewardInput.type = "checkbox";
          rewardInput.checked = Boolean(data.rewardBundleSelected);
          const rewardText = document.createElement("span");
          const rewardTitle = document.createElement("strong");
          rewardTitle.textContent = "參加五星評價回饋活動";
          const rewardHelp = document.createElement("small");
          rewardHelp.textContent = "免費體驗網美露營套組／影音娛樂套組（原租賃費 NT$3,800）；交車時依活動說明完成附圖評論或社群打卡。";
          rewardText.append(rewardTitle, rewardHelp);
          reward.append(rewardInput, rewardText);
          clause.append(reward);
        }
        body.append(clause);
      });
      article.append(header, body);
      root.replaceChildren(article);
    });
  }

  function contractPageModels(data) {
    const provider = data.provider || {};
    const vehicle = data.vehicle || {};
    const cabin = data.cabin || {};
    const rentalPeriod = `${data.rentalStartDate || "____-__-__"} ${data.rentalStartTime || "__:__"} 至 ${data.rentalEndDate || "____-__-__"} ${data.rentalEndTime || "__:__"}`;
    const cabinRentalPeriod = `${cabin.rentalStartDate || "____-__-__"} ${cabin.rentalStartTime || "__:__"} 至 ${cabin.rentalEndDate || "____-__-__"} ${cabin.rentalEndTime || "__:__"}`;
    const customer = `${data.customerName || "____________"}｜證件號碼：${data.idNumber || "____________"}｜電話：${data.phone || "____________"}`;
    const cabinCustomer = `${cabin.customerName || "____________"}｜證件號碼：${cabin.idNumber || "____________"}｜電話：${cabin.phone || "____________"}`;
    const providerLine = `${provider.name || "揪好森露營車出租"}${provider.role ? `（${provider.role}）` : ""}`;
    const specialAgreementParagraphs = [];
    if (data.customerSpecialNote) specialAgreementParagraphs.push(data.customerSpecialNote);
    if (data.cabinProtectionStatus === "included") {
      specialAgreementParagraphs.push("• 露營車廂碰撞損害保障方案：本次已包含，不另收費。正常駕駛、倒車或轉彎時發生意外自撞或碰撞，造成露營車廂外殼、角落、車頂、天窗、玻璃、防水結構或外部附掛設備損壞，先依實際保單與保險公司核定結果處理；符合本方案範圍的未獲理賠維修餘額，每次租期累計保障上限為 NT$200,000。一般樹枝或草木造成、不影響結構、防水、玻璃、外觀完整或設備功能的輕微表面痕跡不收費。");
    }
    if (data.businessLossWaiverStatus === "included") {
      specialAgreementParagraphs.push("• 營業損失責任減免方案：本次已包含，不另收費。符合前述碰撞保障範圍且確有合理必要修理期間時，事故發生前已確認、因本次修理而實際取消的後續預約，以該筆租金 70% 計算營業損失；最長計 20 日，每次租期累計減免上限為 NT$50,000。已改期、未取消或由保險及第三人補償的金額不得重複計算。未付訂金、行事曆標示「？」或僅詢問中的案件不列入計算。");
    }
    if (data.cabinProtectionStatus === "included" || data.businessLossWaiverStatus === "included") {
      specialAgreementParagraphs.push("• 上述方案均不包含故意、違法、酒駕、毒駕、無照或未經授權駕駛、未依規定通知與保留證據、擅自拆修，以及操作錯誤造成的機械損壞（例如曾經發生過將水誤加進 AdBlue 尿素槽，造成整套尿素系統故障及損壞）。");
      specialAgreementParagraphs.push(`• 交車時應付金額：${data.handoverAmount || "NT$15,000"}（租金 ${data.rentalFee || "____________"}－已付訂金 ${data.reservationDeposit || "____________"}＋押金 ${data.securityDeposit || "____________"}；上述兩項方案本次不加收費用）。`);
    }
    return [
      {
        partId: "contract-vehicle",
        partNumber: "合約一",
        partTitle: "借車合約",
        partSummary: "KIA 卡旺 K2500 車體無償借用，規範合法駕駛、行車費用、車況、故障與交通事故處理。",
        illustrationSrc: "/assets/images/contract/kia-kawang-k2500-vehicle-scope-diagram-v2.webp",
        illustrationAlt: "深灰色標示 KIA 卡旺 K2500 車體、底盤與行駛系統，後方露營車廂以淺色呈現",
        scopeType: "vehicle",
        scopeCaption: "第一份契約標的是前方 KIA 卡旺 K2500 車體、底盤、動力與行駛系統；不包含後方露營車廂與露營設備。",
        title: "借車合約",
        subtitle: "借用車輛與行車責任",
        sections: [
          {
            heading: "合約雙方",
            paragraphs: [`車輛提供方（甲方）：${providerLine}`, `車輛借用方（乙方）：${customer}`, `乙方出生年月日：${data.birthDate || "____________"}｜戶籍／聯絡地址：${data.address || "____________"}`],
            screenParagraphs: [`車輛提供方（甲方）：${providerLine}`],
            fieldKeys: ["customerName", "phone", "birthDate", "idNumber", "address"]
          },
          {
            heading: "借用車輛",
            paragraphs: [`車牌：${vehicle.plate || "____________"}｜車型：${vehicle.description || "____________"}`, `借用期間：${rentalPeriod}`, `交車地點：${data.deliveryLocation || "____________"}`, `還車地點：${data.returnLocation || "____________"}`],
            screenParagraphs: [],
            fieldKeys: ["vehiclePlate", "vehicleDescription", "rentalStartDate", "rentalStartTime", "rentalEndDate", "rentalEndTime", "deliveryLocation", "returnLocation"]
          },
          { heading: "借用內容", paragraphs: [
            "• 借用標的：KIA 卡旺 K2500 車體、底盤、動力與行駛系統；不包含第二份契約的露營車廂與露營設備。",
            "• 借用費用：甲方將前述 KIA 卡旺 K2500 車體無償借予乙方使用，本份契約不收取車輛租金。",
            "• 乙方使用本車輛期間，須承擔使用本車輛產生的所有燃油費（滿油出車、滿油還車）、高速公路 ETC 費用、停車費等相關費用。",
            "• 乙方須具備合法小型車駕駛執照，並隨身攜帶。無照駕駛、酒駕、毒駕或交由他人駕駛（有駕照或無照）發生事故，導致保險公司拒絕理賠時，乙方須負擔所有相關責任與費用。",
            "• 簽訂本合約後，甲方須將本車輛的行照、車輛保險證等文件隨車提供給乙方，乙方應妥善保管。如有遺失，乙方應賠償相應損失。",
            "• 在乙方使用本車輛期間，乙方不得將該車買賣、抵押、質押或贈與，亦不得使用該車輛從事營業性活動。"
          ] }
        ]
      },
      {
        partId: "contract-vehicle",
        partNumber: "合約一",
        partTitle: "借車合約",
        partSummary: "KIA 卡旺 K2500 車體無償借用，規範合法駕駛、行車費用、車況、故障與交通事故處理。",
        illustrationSrc: "/assets/images/contract/kia-kawang-k2500-vehicle-scope-diagram-v2.webp",
        illustrationAlt: "深灰色標示 KIA 卡旺 K2500 車體、底盤與行駛系統，後方露營車廂以淺色呈現",
        scopeType: "vehicle",
        scopeCaption: "第一份契約標的是前方 KIA 卡旺 K2500 車體、底盤、動力與行駛系統；不包含後方露營車廂與露營設備。",
        title: "借車合約",
        subtitle: "故障與事故處理",
        sections: [
          { heading: "車況與故障", paragraphs: [
            "• 車輛發生故障、警示燈或異常時，乙方應停靠於安全地點並立即通知甲方，依甲方指示安排檢修；未經甲方同意，不得擅自拆修、更換原車裝置或零件。",
            "• 非因乙方操作、使用或保管不當造成的車輛本體機械故障，由甲方協助處理；可歸責於乙方或實際駕駛人的損害與必要費用，由乙方負擔。"
          ] },
          { heading: "事故與保險", paragraphs: [
            "• 車輛發生擦撞、毀損、失竊或交通事故時，乙方應立即報警、保留現場與相關證據，並立即通知甲方；乙方應配合警方、甲方及保險公司處理，未經甲方與保險公司同意，不得自行承諾責任、私下和解或擅自修理。",
            "• 屬保單承保範圍並經保險公司核定理賠者，依實際保單條款、承保範圍、保額及保險公司的核定結果處理；本契約不另行承諾固定理賠金額或責任上限。",
            "• 超出保額、屬保單除外責任，或因無有效駕照、未經授權駕駛、酒駕或毒駕、肇事逃逸、違法或故意行為、未依規定報警通知、私下和解或拒絕配合理賠，致保險公司不受理、拒賠或追償者，乙方及實際駕駛人應依法負擔未獲理賠的實際損失與必要費用。"
          ] }
        ]
      },
      {
        partId: "contract-cabin",
        partNumber: "合約二",
        partTitle: "露營車廂租賃合約",
        partSummary: "藍色露營車廂與露營設備有償租賃，規範租金、使用方式、返還與損害責任。",
        illustrationSrc: "/assets/images/contract/blue-camper-cabin-rental-scope-diagram.webp",
        illustrationAlt: "JoyForest CamperVan 插圖中以藍色標示有償租賃的露營車廂範圍",
        scopeType: "cabin",
        scopeCaption: "第二份契約標的是圖中藍色露營車廂與交車時點交的露營設備；不包含前方 KIA 卡旺 K2500 車體。",
        title: "露營車廂租賃合約",
        subtitle: "租賃標的、期間與費用",
        sections: [
          {
            heading: "合約雙方",
            paragraphs: [`出租人（甲方）：${providerLine}`, `承租人（乙方）：${cabinCustomer}`, `乙方出生年月日：${cabin.birthDate || "____________"}｜戶籍／聯絡地址：${cabin.address || "____________"}`],
            screenParagraphs: [`出租人（甲方）：${providerLine}`],
            copyFromPrevious: true,
            fieldKeys: ["cabinCustomerName", "cabinPhone", "cabinBirthDate", "cabinIdNumber", "cabinAddress"]
          },
          {
            heading: "租賃規定",
            paragraphs: [
              "租賃物：圖中藍色露營車廂及交車時點交的露營設備；不包含第一份契約無償借用的 KIA 卡旺 K2500 車體。",
              `租賃期間：${cabinRentalPeriod}`,
              `交付地點：${cabin.deliveryLocation || "____________"}｜返還地點：${cabin.returnLocation || "____________"}`,
              `露營車廂與設備租賃費用：${data.rentalFee || "____________"}｜已付預約訂金：${data.reservationDeposit || "____________"}｜還車結算押金：${data.securityDeposit || "____________"}`,
              `交車時應付金額（租金－已付訂金＋押金）：${data.handoverAmount || "____________"}`,
              "押金：新臺幣伍仟元整（還車檢查後，扣除 ETC、未結清費用或有證明的車廂與設備損害後，退還餘額）。",
              "本票：無需本票。"
            ],
            screenParagraphs: [
              "租賃物：圖中藍色露營車廂及交車時點交的露營設備；不包含第一份契約無償借用的 KIA 卡旺 K2500 車體。",
              "押金：新臺幣伍仟元整（還車檢查後，扣除 ETC、未結清費用或有證明的車廂與設備損害後，退還餘額）。",
              "本票：無需本票。"
            ],
            fieldKeys: ["cabinRentalStartDate", "cabinRentalStartTime", "cabinRentalEndDate", "cabinRentalEndTime", "cabinDeliveryLocation", "cabinReturnLocation", "rentalFee", "reservationDeposit", "securityDeposit", "handoverAmount"]
          },
          {
            heading: "五星評價回饋活動",
            paragraphs: [
              "網美露營套組／影音娛樂套組優惠免費體驗免租金（原租賃費用 NT$3,800）。交車時完成評論附圖：Google 地圖商家兩則五星評論，或 Google 地圖商家五星評論及 Instagram 追蹤、發文標註各一則。",
              `本次選擇：${data.rewardBundleSelected ? "☑ 參加五星評價回饋活動並體驗套組" : "☐ 未選擇參加五星評價回饋活動"}`
            ],
            screenParagraphs: ["網美露營套組／影音娛樂套組優惠免費體驗免租金（原租賃費用 NT$3,800）。交車時完成評論附圖：Google 地圖商家兩則五星評論，或 Google 地圖商家五星評論及 Instagram 追蹤、發文標註各一則。"],
            rewardOption: true
          }
        ]
      },
      {
        partId: "contract-cabin",
        partNumber: "合約二",
        partTitle: "露營車廂租賃合約",
        partSummary: "藍色露營車廂與露營設備有償租賃，規範租金、使用方式、返還與損害責任。",
        illustrationSrc: "/assets/images/contract/blue-camper-cabin-rental-scope-diagram.webp",
        illustrationAlt: "JoyForest CamperVan 插圖中以藍色標示有償租賃的露營車廂範圍",
        scopeType: "cabin",
        scopeCaption: "第二份契約標的是圖中藍色露營車廂與交車時點交的露營設備；不包含前方 KIA 卡旺 K2500 車體。",
        title: "露營車廂租賃合約",
        subtitle: "使用、返還與損害責任",
        sections: [
          { heading: "租賃內容", paragraphs: [
            "• 租賃時間超出預定期間，加收費用每小時 NT$300，並請預先與甲方確認。",
            "• 乙方租用露營車廂期間，不得將其買賣、抵押、質押、贈與或用於從事營業性活動。",
            "• 交還時應保證露營車廂物品完整、功能正常，並以租賃時錄影憑證為準。",
            "• 露營車廂、車頂、固定設備與隨車露營設備如有破損、變形、滲漏、遺失或功能異常，以交車點交記錄及維修或更換憑證計算實際損失；一般正常使用所生的輕微表面痕跡不收費。",
            "• 露營車廂使用中出現故障或異常時，乙方應及時通知甲方；未經甲方同意，不得擅自拆卸、修理或更換車廂裝置與零件。"
          ] }
        ]
      },
      ...(specialAgreementParagraphs.length ? [{
        partId: "contract-cabin",
        partNumber: "合約二",
        partTitle: "露營車廂租賃合約",
        partSummary: "本次已包含的保障方案與交車應付金額。",
        title: "露營車廂租賃合約",
        subtitle: "本次特殊約定與保障方案",
        sections: [{
          heading: "本次特殊約定",
          paragraphs: specialAgreementParagraphs
        }]
      }] : [])
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
    ctx.fillText(`${model.partNumber}｜${model.title}`, 74, 96);
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

  async function contractOverviewPagePng(signedAt, documentId, signatureSrc) {
    const canvas = document.createElement("canvas");
    canvas.width = 1240;
    canvas.height = 1754;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fffdfa";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#173f34";
    ctx.fillRect(0, 0, canvas.width, 240);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 49px -apple-system, sans-serif";
    ctx.fillText("本次簽署包含兩份合約", 70, 105);
    ctx.font = "25px -apple-system, sans-serif";
    ctx.fillText("白色車體為合約一，藍色露營車廂為合約二", 70, 160);

    const illustration = await loadImage("/assets/images/contract/campervan-contract-white-vehicle-blue-cabin.webp");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(70, 300, 1100, 700);
    drawImageContain(ctx, illustration, 90, 320, 1060, 660);
    ctx.fillStyle = "#7c4f26";
    ctx.font = "800 32px -apple-system, sans-serif";
    ctx.fillText("合約一｜借車合約", 90, 1080);
    ctx.fillStyle = "#34423c";
    ctx.font = "25px -apple-system, sans-serif";
    drawContractParagraph(ctx, "圖中白色的 KIA 卡旺 K2500 車體、底盤、動力與行駛系統。", 90, 1130, 1060, 40);
    ctx.fillStyle = "#173f34";
    ctx.font = "800 32px -apple-system, sans-serif";
    ctx.fillText("合約二｜露營車廂租賃合約", 90, 1240);
    ctx.fillStyle = "#34423c";
    ctx.font = "25px -apple-system, sans-serif";
    drawContractParagraph(ctx, "圖中藍色的露營車廂與交車時點交的露營設備。", 90, 1290, 1060, 40);
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

  function moneyNumber(value) {
    const digits = String(value || "").replace(/[^\d]/g, "");
    return digits ? Number(digits) : 0;
  }

  function setupHandoverAmountCalculator() {
    const form = $("#signer-form");
    const rent = form.elements.namedItem("rentalFee");
    const paidDeposit = form.elements.namedItem("reservationDeposit");
    const security = form.elements.namedItem("securityDeposit");
    const total = form.elements.namedItem("handoverAmount");
    if (!rent || !paidDeposit || !security || !total) return;
    const update = () => {
      if (!moneyNumber(rent.value)) {
        total.value = "";
        return;
      }
      total.value = formatMoneyLike(Math.max(0, moneyNumber(rent.value) - moneyNumber(paidDeposit.value) + moneyNumber(security.value)));
    };
    [rent, paidDeposit, security].forEach((input) => input.addEventListener("input", update));
    update();
  }

  function setupImageInputs(inputIds, previewId, statusId, setter) {
    const preview = $(`#${previewId}`);
    const card = preview.closest(".upload-card");
    const status = $(`#${statusId}`);
    const handleChange = async (input) => {
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
    };
    inputIds.forEach((inputId) => {
      const input = $(`#${inputId}`);
      input?.addEventListener("change", () => handleChange(input));
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
      if (String(values[key] || "") !== String(originalDraftValue(key))) changed.push(fieldLabels[key]);
    });
    return {
      ...editableSignerData(),
      changedFields: changed,
      documentType: $("#document-type").value,
      rewardBundleSelected: $("#reward-bundle-selected").checked,
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
    const confirmationTitle = copyType === "vehicle" ? "借車合約｜資料確認" : copyType === "cabin" ? "露營車廂租賃｜資料確認" : "完整電子合約｜資料確認";
    ctx.fillText(confirmationTitle, 80, 174);
    ctx.fillStyle = "#1d2925";
    ctx.font = "700 28px -apple-system, sans-serif";
    ctx.fillText(`文件編號：${documentId}`, 80, 310);
    ctx.font = "24px -apple-system, sans-serif";
    ctx.fillStyle = "#54615b";
    ctx.fillText(`簽署時間：${signedAt}`, 80, 354);

    const commonSource = copyType === "cabin" ? (data.cabin || {}) : data;
    const commonRows = [
      [copyType === "vehicle" ? "借用人姓名" : "承租人姓名", commonSource.customerName], ["聯絡電話", commonSource.phone], ["出生年月日", commonSource.birthDate], ["證件號碼", commonSource.idNumber],
      ["聯絡地址", commonSource.address], [copyType === "vehicle" ? "借用期間" : "租賃期間", `${commonSource.rentalStartDate || ""} ${commonSource.rentalStartTime || ""} 至 ${commonSource.rentalEndDate || ""} ${commonSource.rentalEndTime || ""}`],
      [copyType === "vehicle" ? "交車地點" : "交付地點", commonSource.deliveryLocation], [copyType === "vehicle" ? "還車地點" : "返還地點", commonSource.returnLocation]
    ];
    const vehicleRows = [["借用車輛", `${data.vehicle?.plate || "—"}｜${data.vehicle?.description || "—"}`], ["車體借用費用", "無償（NT$0）"]];
    const cabinRows = [
      ["租賃標的", "藍色露營車廂與交車時點交設備"],
      ["車廂設備租金", data.rentalFee],
      ["訂金／押金", `${data.reservationDeposit || "—"}／${data.securityDeposit || "—"}`],
      ["交車時應付", data.handoverAmount || "—"],
      ["回饋套組", data.rewardBundleSelected ? "已勾選參加五星評價回饋活動" : "未選擇參加"],
      ["車廂碰撞保障", data.cabinProtectionStatus === "included" ? "本次已包含，不另收費" : "未包含"],
      ["營業損失減免", data.businessLossWaiverStatus === "included" ? "本次已包含，不另收費" : "未包含"],
      ["管理者備註", data.customerSpecialNote || "—"]
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
    const consentText = `電子簽署：${data.electronicConsent ? "已勾選" : "未勾選"}｜個資：${data.privacyConsent ? "已勾選" : "未勾選"}`;
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
    const bindingText = copyType === "vehicle" ? "本確認頁與第一份借車合約，以同一文件編號及簽署時間綁定。" : copyType === "cabin" ? "本確認頁與第二份露營車廂租賃合約，以同一文件編號及簽署時間綁定。" : "本 PDF 包含兩份契約、電子簽名與證件附件。";
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
    output.setSubject(copyType === "vehicle" ? "Vehicle loan agreement" : copyType === "cabin" ? "Camper cabin rental agreement" : "Complete electronic agreement");
    output.setKeywords(["Joyforest", "CamperVan", "Rental", "Agreement", documentId]);
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
    status.textContent = "正在製作完整電子合約 PDF…";
    try {
      signatureDataUrl = signatureHasInk ? $("#signature-pad").toDataURL("image/png") : "";
      const data = currentSignerData();
      const signedAt = new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Taipei" }).format(new Date());
      const documentId = `JF-${todayYmd().replaceAll("-", "")}-${draftToken.toUpperCase()}`;
      const vehicleDocumentId = `${documentId}-V`;
      const cabinDocumentId = `${documentId}-C`;
      const [overviewImage, vehicleContractPages, cabinContractPages] = await Promise.all([
        contractOverviewPagePng(signedAt, documentId, signatureDataUrl),
        createContractPageImages(data, "contract-vehicle", signedAt, vehicleDocumentId, signatureDataUrl),
        createContractPageImages(data, "contract-cabin", signedAt, cabinDocumentId, signatureDataUrl)
      ]);
      const completeBytes = await buildPdf(data, signedAt, documentId, "complete", true, [overviewImage, ...vehicleContractPages, ...cabinContractPages]);
      completePdfBlob = new Blob([completeBytes], { type: "application/pdf" });
      if (completePdfUrl) URL.revokeObjectURL(completePdfUrl);
      completePdfUrl = URL.createObjectURL(completePdfBlob);
      $("#open-complete-contract").href = completePdfUrl;
      $("#open-complete-contract").download = `${documentId}-完整電子合約.pdf`;
      $("#result-document-id").textContent = documentId;
      $("#result-panel").hidden = false;
      $("#result-panel").scrollIntoView({ behavior: "smooth" });
      status.textContent = "完整電子合約 PDF 已產生，請用下方按鈕分享給揪好森或儲存。";
    } catch (error) {
      console.error(error);
      status.className = "status-line error";
      status.textContent = "PDF 產生失敗，請保留此頁並聯絡揪好森重新處理。";
    } finally {
      button.disabled = false;
    }
  }

  async function shareCompletePdf() {
    if (!completePdfBlob) return;
    const documentId = $("#result-document-id").textContent;
    const file = new File([completePdfBlob], `${documentId}-完整電子合約.pdf`, { type: "application/pdf" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ title: "揪好森露營車電子合約", text: "已完成簽署，附件為完整電子合約 PDF。", files: [file] });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    $("#open-complete-contract").click();
    alert("這支手機未支援從網頁直接分享 PDF，已開啟完整合約；請用手機的「分享」功能傳到 LINE 或儲存。");
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

  async function buildTodaySigner() {
    const loading = document.createElement("section");
    loading.className = "page-shell";
    loading.innerHTML = '<section class="card"><h1>正在帶入最近一位客人資料</h1><p class="status-line">正在重新讀取露營車行事曆，請稍候。</p></section>';
    document.querySelector("main")?.prepend(loading);
    try {
      const [sourceResponse, calendarModule] = await Promise.all([
        fetch(`https://camp.8-ways.com/data/calendar-basic.ics?contract_today=${Date.now()}`, { cache: "no-store" }),
        import("/assets/js/campervan-calendar-data.js?v=20261007-4"),
      ]);
      if (!sourceResponse.ok) throw new Error("目前無法讀取露營車行事曆，請稍後重新整理。");
      const payload = calendarModule.buildTodayContractPayload(await sourceResponse.text());
      if (!payload) throw new Error("目前行事曆沒有找到今天或接下來的正式露營車預約。");
      loading.remove();
      buildSigner(encodeDraft(payload.draft));
    } catch (error) {
      const status = $(".status-line", loading);
      status.className = "status-line error";
      status.textContent = error.message;
      const link = document.createElement("a");
      link.className = "button outline";
      link.href = "/pages/e-sign-contract";
      link.textContent = "改開空白合約";
      $(".card", loading)?.append(link);
    }
  }

  async function buildDatedContractSigner(slug) {
    const loading = document.createElement("section");
    loading.className = "page-shell";
    loading.innerHTML = '<section class="card"><h1>正在帶入本次合約資料</h1><p class="status-line">請稍候，正在載入預約內容。</p></section>';
    document.querySelector("main")?.prepend(loading);
    try {
      const response = await fetch(`/assets/data/contracts/${slug}.json?contract=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("目前找不到這份專屬合約，請聯絡揪好森重新取得連結。");
      const bookingDraft = await response.json();
      const baseDraft = directPublicDraft();
      const payload = {
        ...baseDraft,
        ...bookingDraft,
        provider: { ...baseDraft.provider, ...(bookingDraft.provider || {}) },
        vehicle: { ...baseDraft.vehicle, ...(bookingDraft.vehicle || {}) },
        cabin: { ...(bookingDraft.cabin || {}) },
      };
      loading.remove();
      buildSigner(encodeDraft(payload));
    } catch (error) {
      const status = $(".status-line", loading);
      status.className = "status-line error";
      status.textContent = error.message;
    }
  }

  const queryContract = new URLSearchParams(location.search).get("contract");
  const hashMatch = location.hash.match(/^#contract=(.+)$/);
  const todayContractPage = /\/pages\/e-sign-contract-today(?:\.html)?\/?$/.test(location.pathname);
  const datedContractMatch = location.pathname.match(/^\/pages\/(e-sign-contract-\d{4}-\d{2}-\d{2})(?:\.html)?\/?$/);
  if (todayContractPage) buildTodaySigner();
  else if (datedContractMatch) buildDatedContractSigner(datedContractMatch[1]);
  else if (queryContract) buildSigner(queryContract);
  else if (hashMatch) buildSigner(hashMatch[1]);
  else if (location.hostname.endsWith("joyforest.tw")) buildSigner(encodeDraft(directPublicDraft()));
  else buildAdmin();
})();
