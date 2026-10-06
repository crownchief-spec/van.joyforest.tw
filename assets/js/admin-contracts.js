import { buildContractBookingList } from "/assets/js/campervan-calendar-data.js?v=20261007-4";

const Gate = window.JoyforestVanAdminGate;
const CALENDAR_SOURCE = /^(127\.0\.0\.1|localhost)$/.test(location.hostname)
  ? "https://camp.8-ways.com/data/calendar-basic.ics"
  : "/api/campervan-contract-calendar";
const CONTRACT_BASE = "https://van.joyforest.tw/pages/e-sign-contract";
const STORAGE_PREFIX = "joyforest_van_contract_admin_v1:";
const statusElement = document.getElementById("booking-status");
const listElement = document.getElementById("booking-list");
const refreshButton = document.getElementById("refresh-bookings");
const logoutButton = document.getElementById("admin-logout-btn");

const localPreview = /^(127\.0\.0\.1|localhost)$/.test(location.hostname) && new URLSearchParams(location.search).get("preview") === "1";
if (!localPreview && !Gate?.requireAuth("/pages/admin")) throw new Error("admin_auth_required");

function encodeDraft(data) {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function safeStorageKey(id) {
  return `${STORAGE_PREFIX}${encodeURIComponent(id)}`;
}

function readSaved(id) {
  try {
    return JSON.parse(localStorage.getItem(safeStorageKey(id)) || "{}") || {};
  } catch (_error) {
    return {};
  }
}

function writeSaved(id, data) {
  localStorage.setItem(safeStorageKey(id), JSON.stringify({ ...data, savedAt: new Date().toISOString() }));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function moneyNumber(value) {
  const digits = String(value || "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function formatMoney(value) {
  return value ? `NT$${Number(value).toLocaleString("zh-TW")}` : "";
}

function calculateHandover(draft) {
  return formatMoney(moneyNumber(draft.rentalFee) - moneyNumber(draft.reservationDeposit) + moneyNumber(draft.securityDeposit));
}

function display(value, fallback = "待補") {
  return value ? escapeHtml(value) : fallback;
}

function bookingLabel(booking) {
  const draft = booking.draft;
  const start = `${draft.rentalStartDate || ""} ${draft.rentalStartTime || ""}`.trim();
  const end = `${draft.rentalEndDate || ""} ${draft.rentalEndTime || ""}`.trim();
  return `${start} ～ ${end}`;
}

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (_error) {
    const input = button.closest(".contract-link-row")?.querySelector("input");
    input?.select();
    document.execCommand("copy");
  }
  const original = button.textContent;
  button.textContent = "已複製，可傳給客人";
  setTimeout(() => { button.textContent = original; }, 1800);
}

function collectSettings(card) {
  return {
    customerSpecialNote: card.querySelector("[name=customerSpecialNote]").value.trim(),
    cabinProtectionStatus: card.querySelector("[name=cabinProtectionStatus]").value,
    businessLossWaiverStatus: card.querySelector("[name=businessLossWaiverStatus]").value,
    contractUrl: card.querySelector("[data-contract-link]")?.value || "",
  };
}

function mergedDraft(booking, settings) {
  const base = booking.draft;
  return {
    ...base,
    customerSpecialNote: settings.customerSpecialNote,
    cabinProtectionStatus: settings.cabinProtectionStatus,
    businessLossWaiverStatus: settings.businessLossWaiverStatus,
    handoverAmount: calculateHandover(base),
    calendarEventId: booking.id,
    calendarSummary: booking.summary,
    issuedAt: new Date().toISOString(),
    version: "admin-contract-link-1",
    provider: {
      name: "陳在紳",
      role: "聯邦國際租賃股份有限公司桃園分公司租賃小貨車長租租用人",
      ...(base.provider || {}),
    },
    vehicle: { plate: "RBU-8280", description: "KIA 卡旺 2497cc 雙廂式", ...(base.vehicle || {}) },
  };
}

function renderBooking(booking, index) {
  const saved = readSaved(booking.id);
  const draft = booking.draft;
  const card = document.createElement("article");
  card.className = "booking-card";
  card.dataset.bookingId = booking.id;
  const defaultCabinStatus = saved.cabinProtectionStatus || (/車廂碰撞損害保障.*(?:包含|不另收費)/.test(booking.description) ? "included" : "none");
  const defaultLossStatus = saved.businessLossWaiverStatus || (/營業損失責任減免.*(?:包含|不另收費)/.test(booking.description) ? "included" : "none");
  card.innerHTML = `
    <div class="booking-card__head">
      <div><h2>${display(draft.customerName, display(booking.summary, `露營車案子 ${index + 1}`))}</h2><p class="booking-date">${escapeHtml(bookingLabel(booking))}</p></div>
      <span class="booking-pill">${booking.isActive ? "目前租期" : "即將交車"}</span>
    </div>
    <div class="booking-body booking-workspace">
      <section class="booking-summary" aria-label="行事曆案件摘要">
        <h3>行事曆摘要</h3>
        <p class="booking-calendar-title">${display(booking.summary)}</p>
        <dl class="booking-data">
          <div><dt>聯絡電話</dt><dd>${display(draft.phone)}</dd></div>
          <div><dt>交車／還車</dt><dd>${display(draft.deliveryLocation || draft.returnLocation)}</dd></div>
          <div><dt>租金／訂金／押金</dt><dd>${display(draft.rentalFee, "—")}／${display(draft.reservationDeposit, "—")}／${display(draft.securityDeposit, "—")}</dd></div>
        </dl>
        <details class="booking-calendar-detail"><summary>查看行事曆完整內容</summary><pre>${escapeHtml(booking.description || "行事曆沒有其他說明")}</pre></details>
      </section>
      <section class="booking-controls" aria-label="合約備註與產生連結">
        <div class="admin-form-grid">
          <label class="admin-field full"><span class="field-label">管理者備註（客人會在合約中看到）</span><textarea class="admin-textarea" name="customerSpecialNote" placeholder="例如：本次已包含車廂碰撞損害保障及營業損失責任減免，不另收費。">${escapeHtml(saved.customerSpecialNote || "")}</textarea><span class="field-help">輸入後會自動保存在目前裝置；產生連結時會一起封裝進客人的合約。</span></label>
          <label class="admin-field"><span class="field-label">露營車廂碰撞損害保障方案</span><select class="admin-select" name="cabinProtectionStatus"><option value="none"${defaultCabinStatus === "none" ? " selected" : ""}>本次未包含</option><option value="included"${defaultCabinStatus === "included" ? " selected" : ""}>本次已包含，不另收費</option></select></label>
          <label class="admin-field"><span class="field-label">營業損失責任減免方案</span><select class="admin-select" name="businessLossWaiverStatus"><option value="none"${defaultLossStatus === "none" ? " selected" : ""}>本次未包含</option><option value="included"${defaultLossStatus === "included" ? " selected" : ""}>本次已包含，不另收費</option></select></label>
        </div>
        <div class="booking-actions">
          <button class="admin-button" type="button" data-save>儲存備註</button>
          <button class="admin-button blue" type="button" data-generate>產生合約及連結</button>
          <span class="save-state" data-save-state>${saved.savedAt ? "已載入上次儲存內容" : "尚未儲存"}</span>
        </div>
        <div class="contract-result" data-contract-result${saved.contractUrl ? "" : " hidden"}>
          <p>客人專屬合約連結</p>
          <div class="contract-link-row"><input class="contract-link" data-contract-link value="${escapeHtml(saved.contractUrl || "")}" readonly /><div class="contract-link-actions"><button class="admin-button primary" type="button" data-copy>複製連結</button><a class="admin-button" data-open href="${escapeHtml(saved.contractUrl || "#")}" target="_blank" rel="noopener">開啟合約</a></div></div>
        </div>
      </section>
    </div>`;

  const save = () => {
    const settings = collectSettings(card);
    writeSaved(booking.id, settings);
    const state = card.querySelector("[data-save-state]");
    state.textContent = `已儲存 ${new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit" }).format(new Date())}`;
    return settings;
  };

  card.querySelector("[data-save]").addEventListener("click", save);
  let autosaveTimer;
  card.querySelectorAll("textarea, select").forEach((field) => {
    field.addEventListener("input", () => {
      const state = card.querySelector("[data-save-state]");
      state.textContent = "正在自動儲存…";
      card.querySelector("[data-contract-result]").hidden = true;
      card.querySelector("[data-contract-link]").value = "";
      clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(() => {
        writeSaved(booking.id, { ...collectSettings(card), contractUrl: "" });
        state.textContent = "備註已自動儲存；請重新產生合約連結";
      }, 450);
    });
  });
  card.querySelector("[data-generate]").addEventListener("click", () => {
    const settings = collectSettings(card);
    const contractUrl = `${CONTRACT_BASE}#contract=${encodeDraft(mergedDraft(booking, settings))}`;
    const input = card.querySelector("[data-contract-link]");
    input.value = contractUrl;
    card.querySelector("[data-open]").href = contractUrl;
    card.querySelector("[data-contract-result]").hidden = false;
    writeSaved(booking.id, { ...settings, contractUrl });
    card.querySelector("[data-save-state]").textContent = "合約連結已產生並儲存";
    input.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  card.querySelector("[data-copy]").addEventListener("click", (event) => copyText(card.querySelector("[data-contract-link]").value, event.currentTarget));
  return card;
}

async function loadBookings() {
  statusElement.className = "admin-status";
  statusElement.textContent = "正在重新讀取露營車行事曆…";
  listElement.replaceChildren();
  refreshButton.disabled = true;
  try {
    const response = await fetch(`${CALENDAR_SOURCE}?van_admin=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`行事曆回應錯誤（${response.status}）`);
    const bookings = buildContractBookingList(await response.text());
    if (!bookings.length) {
      statusElement.textContent = "目前沒有找到今天以後的正式露營車案子。";
      listElement.innerHTML = '<div class="admin-empty">行事曆目前沒有可建立合約的露營車訂單。</div>';
      return;
    }
    statusElement.textContent = `已重新讀取，共找到 ${bookings.length} 筆今天起的露營車案子。`;
    bookings.forEach((booking, index) => listElement.append(renderBooking(booking, index)));
  } catch (error) {
    statusElement.className = "admin-status error";
    statusElement.textContent = `讀取失敗：${error.message} 請稍後按「重新讀取行事曆」。`;
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener("click", loadBookings);
logoutButton.addEventListener("click", () => { Gate.logout(); window.location.replace("/pages/admin"); });
loadBookings();
