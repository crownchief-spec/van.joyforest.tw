import { buildAvailabilityPayload } from "../_shared/campervan-availability.js";

const CALENDAR_SOURCE = "https://camp.8-ways.com/data/calendar-basic.ics";

export async function onRequestGet() {
  try {
    const sourceUrl = new URL(CALENDAR_SOURCE);
    sourceUrl.searchParams.set("availability_live", Date.now().toString());
    const sourceResponse = await fetch(sourceUrl, {
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
  } catch (error) {
    console.error("Campervan availability live refresh failed", error);
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
