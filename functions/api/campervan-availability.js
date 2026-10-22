import { buildAvailabilityPayload } from "../_shared/campervan-availability.js";

const CALENDAR_SOURCE = "https://camp.8-ways.com/data/calendar-basic.ics";
const LIVE_API_BACKUP = "https://camp.8-ways.com/api/campervan-availability";
const LOCAL_AVAILABILITY_ASSET = "https://assets.local/assets/data/campervan-availability.json";

function isAvailabilityPayload(value) {
  return Array.isArray(value?.bookedDates)
    && Array.isArray(value?.waitlistDates)
    && Array.isArray(value?.unavailableDates);
}

async function fetchLiveApiBackup() {
  const response = await fetch(LIVE_API_BACKUP, {
    cf: { cacheTtl: 0, cacheEverything: false },
  });
  if (!response.ok) throw new Error(`Availability backup returned HTTP ${response.status}`);
  const payload = await response.json();
  if (!isAvailabilityPayload(payload)) throw new Error("Availability backup payload is invalid");
  return payload;
}

async function fetchLocalAssetBackup(env) {
  if (!env?.ASSETS?.fetch) throw new Error("ASSETS binding is unavailable");
  const response = await env.ASSETS.fetch(LOCAL_AVAILABILITY_ASSET);
  if (!response.ok) throw new Error(`Local availability backup returned HTTP ${response.status}`);
  const payload = await response.json();
  if (!isAvailabilityPayload(payload)) throw new Error("Local availability backup payload is invalid");
  return payload;
}

function availabilityResponse(payload) {
  payload.fetchedAt = new Date().toISOString();
  return Response.json(payload, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function onRequestGet({ env }) {
  try {
    const sourceResponse = await fetch(CALENDAR_SOURCE, {
      headers: { "user-agent": "JoyForest-CamperVan-Availability-Live/1.0" },
      cf: { cacheTtl: 0, cacheEverything: false },
    });
    if (!sourceResponse.ok) throw new Error(`Calendar source returned HTTP ${sourceResponse.status}`);

    const payload = buildAvailabilityPayload(await sourceResponse.text());
    return availabilityResponse(payload);
  } catch (primaryError) {
    console.warn("Campervan calendar source unavailable; using public API backup", primaryError);
    try {
      const payload = await fetchLiveApiBackup();
      return availabilityResponse(payload);
    } catch (backupError) {
      console.warn("Public API backup unavailable; using bundled availability snapshot", backupError);
      try {
        return availabilityResponse(await fetchLocalAssetBackup(env));
      } catch (localError) {
        console.error("Campervan availability refresh failed", { primaryError, backupError, localError });
      }
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
