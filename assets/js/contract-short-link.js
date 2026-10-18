(() => {
  "use strict";

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  function toBase64Url(bytes) {
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function fromBase64Url(value) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalized + "===".slice((normalized.length + 3) % 4));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  async function transform(bytes, format, operation) {
    const StreamClass = operation === "compress" ? window.CompressionStream : window.DecompressionStream;
    if (!StreamClass) throw new Error(`${operation}_stream_unavailable`);
    const stream = new Blob([bytes]).stream().pipeThrough(new StreamClass(format));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function encodePayload(value) {
    const raw = encoder.encode(JSON.stringify(value));
    try {
      return `z${toBase64Url(await transform(raw, "gzip", "compress"))}`;
    } catch (_error) {
      return `b${toBase64Url(raw)}`;
    }
  }

  async function decodePayload(token) {
    const prefix = token?.slice(0, 1);
    const bytes = fromBase64Url(token?.slice(1) || "");
    const raw = prefix === "z" ? await transform(bytes, "gzip", "decompress") : bytes;
    return JSON.parse(decoder.decode(raw));
  }

  // A compact, deterministic identifier lets the public signing page find the
  // matching calendar event without placing customer details in the URL.
  function shortBookingId(value) {
    let hash = 0x811c9dc5;
    for (const byte of encoder.encode(String(value || ""))) {
      hash ^= byte;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(36).padStart(7, "0");
  }

  window.JoyForestContractLinks = { encodePayload, decodePayload, shortBookingId };
})();
