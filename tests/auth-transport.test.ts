import { test } from "node:test";
import assert from "node:assert/strict";
import { secureSupabaseUrl } from "../src/lib/supabase/url";

test("Supabase connections require HTTPS except explicit local development", () => {
  assert.equal(secureSupabaseUrl("https://example.supabase.co"),"https://example.supabase.co");
  for (const url of ["http://localhost:54321","http://127.0.0.1:54321","http://[::1]:54321"]) assert.equal(secureSupabaseUrl(url),url);
  for (const url of ["http://example.supabase.co","http://localhost.example.com","ftp://localhost","https://user:password@example.com"]) {
    assert.throws(() => secureSupabaseUrl(url),/HTTPS/);
  }
});
