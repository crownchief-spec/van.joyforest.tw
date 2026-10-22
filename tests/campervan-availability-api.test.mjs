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
