import { buildTodayContractPayload } from "../_shared/campervan-availability.js";

const CALENDAR_SOURCE = "https://camp.8-ways.com/data/calendar-basic.ics";

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
      Expires: "0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function onRequestGet() {
  try {
    const sourceUrl = new URL(CALENDAR_SOURCE);
    sourceUrl.searchParams.set("contract_today", Date.now().toString());
    const sourceResponse = await fetch(sourceUrl, {
      headers: { "user-agent": "JoyForest-CamperVan-Contract-Today/1.0" },
      cache: "no-store",
      cf: { cacheTtl: 0, cacheEverything: false },
    });
    if (!sourceResponse.ok) throw new Error(`Calendar source returned HTTP ${sourceResponse.status}`);

    const payload = buildTodayContractPayload(await sourceResponse.text());
    if (!payload) return json({ error: "no_upcoming_booking" }, 404);
    return json({ ...payload, fetchedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Today contract calendar refresh failed", error);
    return json({ error: "today_contract_refresh_failed" }, 503);
  }
}
