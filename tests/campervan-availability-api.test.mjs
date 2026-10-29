import assert from "node:assert/strict";
import test from "node:test";

import { onRequestGet } from "../functions/api/campervan-availability.js";

const snapshot = {
  calendar: "露營車",
  timeZone: "Asia/Taipei",
  bookedDates: ["2026-11-01"],
  waitlistDates: [],
  unavailableDates: []
};

test("returns the bundled snapshot when both cross-site sources fail", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("cross-site source unavailable");
  };

  try {
    const response = await onRequestGet({
      env: {
        ASSETS: {
          async fetch(url) {
            assert.equal(new URL(url).pathname, "/assets/data/campervan-availability.json");
            return Response.json(snapshot);
          }
        }
      }
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.deepEqual(payload.bookedDates, snapshot.bookedDates);
    assert.ok(payload.fetchedAt);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("keeps the timed return date from the original campervan calendar", async () => {
  const originalFetch = globalThis.fetch;
  const sourceIcs = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "DTSTART:20261218T110000Z",
    "DTEND:20261220T110000Z",
    "SUMMARY:private booking",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  globalThis.fetch = async (url) => {
    assert.match(String(url), /^https:\/\/calendar\.google\.com\/calendar\/ical\//);
    return new Response(sourceIcs, { status: 200 });
  };

  try {
    const response = await onRequestGet({ env: {} });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.deepEqual(payload.bookedDates, ["2026-12-18", "2026-12-19", "2026-12-20"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
