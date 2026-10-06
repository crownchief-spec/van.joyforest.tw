const CALENDAR_SOURCE = "https://camp.8-ways.com/data/calendar-basic.ics";

export async function onRequestGet() {
  try {
    const sourceUrl = new URL(CALENDAR_SOURCE);
    sourceUrl.searchParams.set("contract_admin", Date.now().toString());
    const response = await fetch(sourceUrl, {
      headers: { "user-agent": "Joy Forest-Campervan-Contract-Admin/1.0" },
      cache: "no-store",
      cf: { cacheTtl: 0, cacheEverything: false },
    });
    if (!response.ok) throw new Error(`Calendar source returned HTTP ${response.status}`);

    return new Response(await response.text(), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Expires: "0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Contract calendar refresh failed", error);
    return new Response("calendar_refresh_failed", {
      status: 503,
      headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
