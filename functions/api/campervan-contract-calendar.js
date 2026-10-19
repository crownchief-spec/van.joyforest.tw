// 合約後台必須讀取「露營車」原始私人行事曆，才能取得客戶姓名、
// 電話、租期、費用與交還車資料。camp.8-ways.com 的公開 ICS 只保留
// 忙碌狀態，不能拿來產生合約。
const CALENDAR_SOURCE = "https://calendar.google.com/calendar/ical/al2upmt9aegl0gc9uk6dms17k4%40group.calendar.google.com/private-96c6b258d3838a040c762d5a412aa839/basic.ics";

export async function onRequestGet() {
  try {
    const response = await fetch(CALENDAR_SOURCE);
    if (!response.ok) throw new Error(`Calendar source returned HTTP ${response.status}`);
    const calendarText = await response.text();
    // 私人露營車行事曆不含公開合併檔使用的分類標籤；在伺服器端補上，
    // 讓既有解析器只需處理同一種格式，又不會把私人網址暴露給瀏覽器。
    const taggedCalendarText = calendarText.replace(/BEGIN:VEVENT\r?\n/g, "BEGIN:VEVENT\r\nX-JOYFOREST-TAG:rv\r\n");

    return new Response(taggedCalendarText, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Expires: "0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Contract calendar refresh failed", error);
    return new Response(`calendar_refresh_failed: ${error.message}`, {
      status: 503,
      headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
