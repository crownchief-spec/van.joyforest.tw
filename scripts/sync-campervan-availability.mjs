import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAvailabilityPayload } from "../functions/_shared/campervan-availability.js";

// 備援檔也直接由露營車原始行事曆產生，避免公開合併 ICS
// 將跨日活動拆成整天狀態時遺漏還車當天。
const DEFAULT_SOURCE = "https://calendar.google.com/calendar/ical/al2upmt9aegl0gc9uk6dms17k4%40group.calendar.google.com/private-96c6b258d3838a040c762d5a412aa839/basic.ics";
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(projectRoot, "assets/data/campervan-availability.json");
const sourceFlagIndex = process.argv.indexOf("--source");
const source = sourceFlagIndex >= 0 ? process.argv[sourceFlagIndex + 1] : DEFAULT_SOURCE;

if (!source) throw new Error("--source 後方需要提供 ICS 網址或檔案路徑");

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

const calendarText = await readSource(source);
const taggedCalendarText = calendarText.replace(/BEGIN:VEVENT\r?\n/g, "BEGIN:VEVENT\r\nX-JOYFOREST-TAG:rv\r\n");
const payload = buildAvailabilityPayload(taggedCalendarText);

await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(
  `已更新 ${path.relative(projectRoot, outputPath)}：已預訂 ${payload.bookedDates.length} 天、可候補 ${payload.waitlistDates.length} 天、不可預訂 ${payload.unavailableDates.length} 天`,
);
