import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeQrImage } from "../src/lib/qr";

test("Supabase SVG data URLs are encoded without losing the QR image content", () => {
  const svg = '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"><rect fill="#000" /></svg>\n';
  const prefix = "data:image/svg+xml;utf-8,";
  const result = encodeQrImage(prefix + svg);
  assert.equal(decodeURIComponent(result.slice(prefix.length)), svg);
  assert.doesNotMatch(result, /[\s<>"#]/);
});

test("unexpected image formats fail explicitly", () => {
  assert.throws(() => encodeQrImage("https://example.com/image.svg"), /Ungültiges/);
});
