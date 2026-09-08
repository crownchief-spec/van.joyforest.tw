import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAvailabilityPayload } from "../functions/_shared/campervan-availability.js";

const DEFAULT_SOURCE = "https://camp.8-ways.com/data/calendar-basic.ics";
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

const payload = buildAvailabilityPayload(await readSource(source));

await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(
  `已更新 ${path.relative(projectRoot, outputPath)}：已預訂 ${payload.bookedDates.length} 天、可候補 ${payload.waitlistDates.length} 天、不可預訂 ${payload.unavailableDates.length} 天`,
);
