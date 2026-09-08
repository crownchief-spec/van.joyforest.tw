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

function getTextProperty(lines, propertyName) {
  const pattern = new RegExp(`^${propertyName}(?:;|:)`, "i");
  const line = lines.find((candidate) => pattern.test(candidate));
  if (!line) return "";
  const separatorIndex = line.indexOf(":");
  return separatorIndex >= 0 ? decodeIcsText(line.slice(separatorIndex + 1)) : "";
}

function classifyEvent(summary, description, dates) {
  const title = summary.trim();
  const text = `${title}\n${description}`;
  const hasCampervanWord = /露營車|camper\s*van|campervan|\brv\b/i.test(text);
  const isPending = /^[？?]/.test(title);
  const isExplicitBlackout = /不可預訂|不可预约|停租|暫停出租|暂停出租|停止出租|自用不外租/i.test(text);
  const isRoutineReminder = /驗車|验车|車檢|车检|檢查|检查|整理|清潔|清洁|洗車|洗车|維修|维修|保養|保养|整備|整备|收納|收纳|補給|补给|加油|換油|换油|設備檢查|设备检查/i.test(text);
  const isUnrelatedTravel = !hasCampervanWord && /酒店|飯店|饭店|旅館|旅馆|住宿|機票|机票|航班|出國|出国|石垣島|石垣岛|日本旅遊|日本旅游/i.test(text);

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
