import { buildAvailabilityPayload } from "../_shared/campervan-availability.js";

const CALENDAR_SOURCE = "https://camp.8-ways.com/data/calendar-basic.ics";
const LIVE_API_BACKUP = "https://camp.8-ways.com/api/campervan-availability";

function isAvailabilityPayload(value) {
  return Array.isArray(value?.bookedDates)
    && Array.isArray(value?.waitlistDates)
    && Array.isArray(value?.unavailableDates);
}

async function fetchLiveApiBackup() {
  const response = await fetch(LIVE_API_BACKUP, {
    cache: "no-store",
    cf: { cacheTtl: 0, cacheEverything: false },
  });
  if (!response.ok) throw new Error(`Availability backup returned HTTP ${response.status}`);
  const payload = await response.json();
  if (!isAvailabilityPayload(payload)) throw new Error("Availability backup payload is invalid");
  return payload;
}

export async function onRequestGet() {
  try {
    const sourceResponse = await fetch(CALENDAR_SOURCE, {
      headers: { "user-agent": "JoyForest-CamperVan-Availability-Live/1.0" },
      cache: "no-store",
      cf: { cacheTtl: 0, cacheEverything: false },
    });
    if (!sourceResponse.ok) throw new Error(`Calendar source returned HTTP ${sourceResponse.status}`);

    const payload = buildAvailabilityPayload(await sourceResponse.text());
    payload.fetchedAt = new Date().toISOString();

    return Response.json(payload, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Expires: "0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (primaryError) {
    console.warn("Campervan calendar source unavailable; using public API backup", primaryError);
    try {
      const payload = await fetchLiveApiBackup();
      payload.fetchedAt = new Date().toISOString();
      return Response.json(payload, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Expires: "0",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (backupError) {
      console.error("Campervan availability live refresh failed", { primaryError, backupError });
    }
    return Response.json(
      { error: "availability_refresh_failed" },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Expires: "0",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  }
}
