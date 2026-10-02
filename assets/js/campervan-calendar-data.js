const taipeiDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatTaipeiDate(date) {
  return taipeiDateFormatter.format(date);
}

function parseIcsDate(line) {
  if (!line) return null;
  const separatorIndex = line.indexOf(":");
  if (separatorIndex < 0) return null;
  const head = line.slice(0, separatorIndex).toUpperCase();
  const value = line.slice(separatorIndex + 1).trim();
  const allDay = head.includes("VALUE=DATE") || /^\d{8}$/.test(value);
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?(Z)?$/);
  if (!match) return null;

  const [, year, month, day, hour = "00", minute = "00", second = "00", utcMarker] = match;
  if (allDay) return { allDay: true, date: `${year}-${month}-${day}` };

  const utcTimestamp = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  // Google Calendar 中沒有 Z 的時間是台灣當地時間。
  const date = new Date(utcMarker ? utcTimestamp : utcTimestamp - 8 * 60 * 60 * 1000);
  return { allDay: false, date };
}

function addDays(dateString, amount) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount, 12)).toISOString().slice(0, 10);
}

function expandEventDates(start, end) {
  if (!start) return [];
  let firstDate;
  let lastDate;

  if (start.allDay) {
    firstDate = start.date;
    lastDate = end?.allDay ? addDays(end.date, -1) : start.date;
  } else {
    const endDate = end?.date instanceof Date ? end.date : new Date(start.date.getTime() + 60 * 60 * 1000);
    firstDate = formatTaipeiDate(start.date);
    lastDate = formatTaipeiDate(new Date(Math.max(start.date.getTime(), endDate.getTime() - 1)));
  }

  const dates = [];
  for (let cursor = firstDate; cursor <= lastDate; cursor = addDays(cursor, 1)) dates.push(cursor);
  return dates;
}

function decodeIcsText(value = "") {
  return value
    .replace(/\\[nN]/g, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function decodeIcsMultilineText(value = "") {
  return value
    .replace(/\\[nN]/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function getTextProperty(lines, propertyName) {
  const pattern = new RegExp(`^${propertyName}(?:;|:)`, "i");
  const line = lines.find((candidate) => pattern.test(candidate));
  if (!line) return "";
  const separatorIndex = line.indexOf(":");
  return separatorIndex >= 0 ? decodeIcsText(line.slice(separatorIndex + 1)) : "";
}

function getMultilineTextProperty(lines, propertyName) {
  const pattern = new RegExp(`^${propertyName}(?:;|:)`, "i");
  const line = lines.find((candidate) => pattern.test(candidate));
  if (!line) return "";
  const separatorIndex = line.indexOf(":");
  return separatorIndex >= 0 ? decodeIcsMultilineText(line.slice(separatorIndex + 1)) : "";
}

function firstCaptured(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim().replace(/[，,；;。]+$/, "");
  }
  return "";
}

function extractMoney(text, patterns) {
  const value = firstCaptured(text, patterns);
  if (!value) return "";
  const match = value.match(/(?:NT\$|NTD|\$)?\s*([\d,]{3,})/i);
  if (!match) return "";
  return `NT$${Number(match[1].replace(/,/g, "")).toLocaleString("zh-TW")}`;
}

function normalizeClock(hourValue, minuteValue = "00", period = "") {
  let hour = Number(hourValue);
  const marker = period.toLowerCase();
  if (/下午|晚上|pm/.test(marker) && hour < 12) hour += 12;
  if (/早上|上午|am/.test(marker) && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${String(Number(minuteValue || 0)).padStart(2, "0")}`;
}

function extractRentalTimes(text) {
  const explicitTimes = [...text.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g)]
    .map((match) => normalizeClock(match[1], match[2]));
  if (explicitTimes.length >= 2) return { startTime: explicitTimes[0], endTime: explicitTimes[1] };

  const englishTimes = [...text.matchAll(/\b(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/gi)]
    .map((match) => normalizeClock(match[1], match[2] || "00", match[3]));
  if (englishTimes.length >= 2) return { startTime: englishTimes[0], endTime: englishTimes[1] };

  const chineseTimes = [...text.matchAll(/(早上|上午|中午|下午|晚上)?\s*(\d{1,2})\s*[點时](?:\s*(半|\d{1,2}\s*分))?/g)]
    .map((match) => normalizeClock(match[2], match[3]?.includes("半") ? "30" : match[3]?.replace(/\D/g, "") || "00", match[1] || ""));
  if (chineseTimes.length >= 2) return { startTime: chineseTimes[0], endTime: chineseTimes[1] };
  return { startTime: explicitTimes[0] || englishTimes[0] || chineseTimes[0] || "15:00", endTime: "15:00" };
}

function summaryCustomerName(summary) {
  return summary
    .replace(/^[？?]\s*/, "")
    .replace(/^露營車\s*/i, "")
    .replace(/\s+(?:am|pm)\s*\d.*$/i, "")
    .trim();
}

function buildContractDraftFromEvent({ summary, description, dates }, now) {
  const name = firstCaptured(description, [
    /(?:^|\n)\s*預約人姓名\s*[：:/]?\s*([^\n]+?)(?=\s*(?:聯絡電話|電話|手機|身分證|證件|$))/i,
    /(?:^|\n)\s*預約人\s*[：:/]?\s*([^\n]+?)(?=\s*(?:聯絡電話|電話|手機|身分證|證件|$))/i,
    /(?:^|\n)\s*姓名\s*[：:/]?\s*([^\n]+?)(?=\s*(?:聯絡電話|電話|手機|身分證|證件|$))/i,
  ]) || summaryCustomerName(summary);
  const phone = firstCaptured(description, [
    /(?:聯絡電話|電話|手機)\s*[：:/]?\s*(\+?[\d][\d\s()-]{7,})/i,
    /WhatsApp[^+\d]*(\+?[\d][\d\s()-]{7,})/i,
  ]).replace(/[，,；;。]+$/, "");
  const idNumber = firstCaptured(description, [
    /(?:身分證(?:字號)?|證件號碼)\s*[：:/]?\s*([A-Z][A-Z0-9]{7,11})/i,
    /護照號碼\s*[：:/]?\s*([A-Z0-9]{6,14})/i,
  ]);
  const address = firstCaptured(description, [
    /(?:戶籍地址|聯絡地址|戶籍／聯絡地址)\s*[：:]\s*([^\n]+)/i,
  ]);
  const sharedLocation = firstCaptured(description, [
    /(?:到府)?(?:取車\s*[／/]\s*還車|取\s*[／/]\s*還車|交車\s*[／/]\s*還車|交付\s*[／/]\s*返還)(?:地點)?\s*[：:]\s*([^\n]+)/i,
  ]);
  const deliveryLocation = sharedLocation || firstCaptured(description, [
    /(?:到府送車地點|預計送車地點|到府交車|交車地點|交付地點)\s*[：:]\s*([^\n]+)/i,
    /(?:^|\n)\s*地點\s*[：:]?\s*([^\n]+)/i,
  ]);
  const returnLocation = sharedLocation || firstCaptured(description, [
    /(?:到府還車|還車地點|返還地點)\s*[：:]\s*([^\n]+)/i,
  ]) || deliveryLocation;
  const rentalFee = extractMoney(description, [
    /(?:總租金|更新後報價|露營車廂與設備租賃費用)\s*[：:]?\s*([^\n]+)/i,
    /[^\n]{0,36}租金\s*[：:]\s*([^\n]+)/i,
    /(?:^|\n)\s*費用\s*[：:]?\s*([^\n]+)/i,
  ]);
  const reservationDeposit = extractMoney(description, [
    /(?:Reservation Deposit|預約訂金|已收訂金|訂金)\s*[：:]?\s*([^\n]+)/i,
  ]);
  const securityDeposit = extractMoney(description, [
    /(?:Refundable Handover Security Deposit|交車收可退押金|交車押金|可退押金|還車結算押金)\s*[：:]?\s*([^\n]+)/i,
  ]) || "NT$5,000";
  const { startTime, endTime } = extractRentalTimes(description);
  const rewardBundleSelected = /打卡分享優惠|五星評價回饋|網美露營套組\s*[：:]?\s*(?:需要|yes)|影音娛樂套組\s*[：:]?\s*(?:需要|yes)/i.test(description);

  return {
    customerName: name,
    phone,
    birthDate: "",
    idNumber,
    address,
    rentalStartDate: dates[0],
    rentalStartTime: startTime,
    rentalEndDate: dates.at(-1),
    rentalEndTime: endTime,
    deliveryLocation,
    returnLocation,
    rentalFee,
    reservationDeposit,
    securityDeposit,
    rewardBundleSelected,
    calendarStatus: "booked",
    calendarSummary: summary,
    issuedAt: now.toISOString(),
    version: "today-live-calendar-1",
    provider: {
      name: "陳在紳",
      role: "聯邦國際租賃股份有限公司桃園分公司租賃小貨車長租租用人",
    },
    vehicle: { plate: "RBU-8280", description: "KIA 卡旺 2497cc 雙廂式" },
  };
}

export function buildTodayContractPayload(icsText, now = new Date()) {
  const ics = icsText.replace(/\r?\n[ \t]/g, "").replace(/\r\n/g, "\n");
  const eventBlocks = ics.match(/BEGIN:VEVENT\n[\s\S]*?\nEND:VEVENT/g) ?? [];
  const today = formatTaipeiDate(now);
  const candidates = [];

  for (const block of eventBlocks) {
    const lines = block.split("\n");
    if (!lines.some((line) => /^X-JOYFOREST-TAG:rv\s*$/i.test(line.trim()))) continue;
    const start = parseIcsDate(lines.find((line) => /^DTSTART(?:;|:)/i.test(line)));
    const end = parseIcsDate(lines.find((line) => /^DTEND(?:;|:)/i.test(line)));
    const dates = expandEventDates(start, end);
    if (!dates.length || dates.at(-1) < today) continue;
    const summary = getTextProperty(lines, "SUMMARY");
    const description = getMultilineTextProperty(lines, "DESCRIPTION");
    if (classifyEvent(summary, description, dates) !== "booked") continue;
    candidates.push({ summary, description, dates, isActive: dates[0] <= today && dates.at(-1) >= today });
  }

  candidates.sort((left, right) => {
    if (left.isActive !== right.isActive) return left.isActive ? -1 : 1;
    return left.dates[0].localeCompare(right.dates[0]);
  });
  const selected = candidates[0];
  if (!selected) return null;
  return {
    selection: selected.isActive ? "today" : "next",
    rentalStartDate: selected.dates[0],
    rentalEndDate: selected.dates.at(-1),
    draft: buildContractDraftFromEvent(selected, now),
  };
}

export function buildContractBookingList(icsText, now = new Date()) {
  const ics = icsText.replace(/\r?\n[ \t]/g, "").replace(/\r\n/g, "\n");
  const eventBlocks = ics.match(/BEGIN:VEVENT\n[\s\S]*?\nEND:VEVENT/g) ?? [];
  const today = formatTaipeiDate(now);
  const bookings = [];

  for (const block of eventBlocks) {
    const lines = block.split("\n");
    if (!lines.some((line) => /^X-JOYFOREST-TAG:rv\s*$/i.test(line.trim()))) continue;
    const start = parseIcsDate(lines.find((line) => /^DTSTART(?:;|:)/i.test(line)));
    const end = parseIcsDate(lines.find((line) => /^DTEND(?:;|:)/i.test(line)));
    const dates = expandEventDates(start, end);
    if (!dates.length || dates.at(-1) < today) continue;

    const summary = getTextProperty(lines, "SUMMARY");
    const description = getMultilineTextProperty(lines, "DESCRIPTION");
    const searchable = `${summary}\n${description}`;
    // 行事曆中的 rv 標籤也可能被旅行提醒共用；管理後台只留下真正的露營車租借案件。
    if (!/露營車|camper\s*van|campervan|租車|借車|取車|還車|交車/i.test(searchable)) continue;
    if (classifyEvent(summary, description, dates) !== "booked") continue;

    const uid = getTextProperty(lines, "UID") || `${dates[0]}-${summary}`;
    bookings.push({
      id: uid,
      summary,
      description,
      dates,
      isActive: dates[0] <= today && dates.at(-1) >= today,
      draft: buildContractDraftFromEvent({ summary, description, dates }, now),
    });
  }

  bookings.sort((left, right) => {
    if (left.isActive !== right.isActive) return left.isActive ? -1 : 1;
    return left.dates[0].localeCompare(right.dates[0]);
  });
  return bookings;
}

function classifyEvent(summary, description, dates) {
  const title = summary.trim();
  const text = `${title}\n${description}`;
  const hasCampervanWord = /露營車|camper\s*van|campervan|\brv\b/i.test(text);
  const isPending = /^[？?]/.test(title);
  const isExplicitBlackout = /不可預訂|不可预约|停租|暫停出租|暂停出租|停止出租|自用不外租/i.test(text);
  // 只有「標題本身」是整理、清潔、驗車等才視為不佔檔提醒。
  // 客人預訂的備註常會包含清潔或整備交付內容，不可因此忽略整筆行程。
  const isRoutineReminder = /驗車|验车|車檢|车检|檢查|检查|整理|清潔|清洁|洗車|洗车|維修|维修|保養|保养|整備|整备|收納|收纳|補給|补给|加油|換油|换油|設備檢查|设备检查/i.test(title);
  const isUnrelatedTravel = !hasCampervanWord && /酒店|飯店|饭店|旅館|旅馆|住宿|機票|机票|航班|出國|出国|石垣島|石垣岛|日本旅遊|日本旅游/i.test(title);

  if (isExplicitBlackout) return "unavailable";
  if (isRoutineReminder || isUnrelatedTravel) return "ignore";
  if (isPending) return "waitlist";
  if (hasCampervanWord || dates.length >= 2) return "booked";
  return "ignore";
}

export function buildAvailabilityPayload(icsText, now = new Date()) {
  const ics = icsText.replace(/\r?\n[ \t]/g, "").replace(/\r\n/g, "\n");
  const eventBlocks = ics.match(/BEGIN:VEVENT\n[\s\S]*?\nEND:VEVENT/g) ?? [];
  const today = formatTaipeiDate(now);
  const bookedDates = new Set();
  const waitlistDates = new Set();
  const unavailableDates = new Set();

  for (const block of eventBlocks) {
    const lines = block.split("\n");
    const isCampervanEvent = lines.some((line) => /^X-JOYFOREST-TAG:rv\s*$/i.test(line.trim()));
    if (!isCampervanEvent) continue;
    const start = parseIcsDate(lines.find((line) => /^DTSTART(?:;|:)/i.test(line)));
    const end = parseIcsDate(lines.find((line) => /^DTEND(?:;|:)/i.test(line)));
    const dates = expandEventDates(start, end).filter((date) => date >= today);
    if (!dates.length) continue;
    const summary = getTextProperty(lines, "SUMMARY");
    const description = getTextProperty(lines, "DESCRIPTION");
    const eventStatus = classifyEvent(summary, description, dates);
    const target = eventStatus === "booked"
      ? bookedDates
      : eventStatus === "waitlist"
        ? waitlistDates
        : eventStatus === "unavailable"
          ? unavailableDates
          : null;
    if (!target) continue;
    for (const date of dates) target.add(date);
  }

  // 同一天有多筆事件時，以不可預訂 > 已預訂 > 可候補為優先顯示。
  for (const date of unavailableDates) {
    bookedDates.delete(date);
    waitlistDates.delete(date);
  }
  for (const date of bookedDates) waitlistDates.delete(date);

  return {
    calendar: "露營車",
    timeZone: "Asia/Taipei",
    bookedDates: [...bookedDates].sort(),
    waitlistDates: [...waitlistDates].sort(),
    unavailableDates: [...unavailableDates].sort(),
  };
}
