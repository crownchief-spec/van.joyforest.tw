import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_SOURCE = "https://camp.8-ways.com/data/calendar-basic.ics";
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(projectRoot, "assets/data/campervan-unavailable-dates.json");
const sourceFlagIndex = process.argv.indexOf("--source");
const source = sourceFlagIndex >= 0 ? process.argv[sourceFlagIndex + 1] : DEFAULT_SOURCE;

if (!source) throw new Error("--source 後方需要提供 ICS 網址或檔案路徑");

const unfoldIcs = (text) => text.replace(/\r?\n[ \t]/g, "").replace(/\r\n/g, "\n");
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
  // Google Calendar 的露營車行事曆使用台灣時間；沒有 Z 時，將牆上時間換算成 UTC。
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

async function readSource(sourceValue) {
  if (/^https?:\/\//i.test(sourceValue)) {
    const url = new URL(sourceValue);
    url.searchParams.set("availability_sync", Date.now().toString());
    const response = await fetch(url, {
      headers: { "user-agent": "JoyForest-CamperVan-Availability-Sync/1.0" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`下載行事曆失敗：HTTP ${response.status}`);
    return response.text();
  }
  return readFile(path.resolve(sourceValue), "utf8");
}

const ics = unfoldIcs(await readSource(source));
const eventBlocks = ics.match(/BEGIN:VEVENT\n[\s\S]*?\nEND:VEVENT/g) ?? [];
const today = formatTaipeiDate(new Date());
const unavailableDates = new Set();

for (const block of eventBlocks) {
  const lines = block.split("\n");
  const isCampervanEvent = lines.some((line) => /^X-JOYFOREST-TAG:rv\s*$/i.test(line.trim()));
  if (!isCampervanEvent) continue;
  const start = parseIcsDate(lines.find((line) => /^DTSTART(?:;|:)/i.test(line)));
  const end = parseIcsDate(lines.find((line) => /^DTEND(?:;|:)/i.test(line)));
  for (const date of expandEventDates(start, end)) {
    if (date >= today) unavailableDates.add(date);
  }
}

const payload = {
  calendar: "露營車",
  timeZone: "Asia/Taipei",
  unavailableDates: [...unavailableDates].sort(),
};

await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`已更新 ${path.relative(projectRoot, outputPath)}：${payload.unavailableDates.length} 個無法預約日期`);
