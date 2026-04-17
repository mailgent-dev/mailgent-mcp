// Integration tests for @loomal/mcp.
//
// These exercise the REST endpoints that the MCP tools wrap. The MCP server
// itself is a thin pass-through (URL + method + Authorization header), so
// validating the underlying endpoint behaviour is what matters.
//
// Skipped automatically when LOOMAL_API_URL is not set, so CI without a local
// API still passes. To run: LOOMAL_API_URL=http://localhost:3001 LOOMAL_API_KEY=loid-... node --test tests/

import { test } from "node:test";
import assert from "node:assert/strict";

const API_BASE = process.env.LOOMAL_API_URL;
const API_KEY = process.env.LOOMAL_API_KEY;
const TEST_CRED = process.env.LOOMAL_TEST_CRED || "test-totp-mcp";

const skip = !API_BASE || !API_KEY;

async function api(method, path, body) {
  const res = await fetch(`${API_BASE}/v0${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

test("vault.list — returns the test credential", { skip }, async () => {
  const { status, data } = await api("GET", "/vault");
  assert.equal(status, 200, `unexpected status: ${status}`);
  assert.ok(Array.isArray(data.credentials), "credentials should be an array");
  const found = data.credentials.find((c) => c.name === TEST_CRED);
  assert.ok(found, `${TEST_CRED} should exist (provision it before running tests)`);
  assert.equal(found.type, "TOTP");
});

test("vault.totp — response includes backupCodesRemaining", { skip }, async () => {
  const { status, data } = await api("GET", `/vault/${TEST_CRED}/totp`);
  assert.equal(status, 200);
  assert.equal(typeof data.code, "string", "code should be a string");
  assert.match(data.code, /^\d{6}$/, "code should be 6 digits");
  assert.equal(typeof data.remaining, "number");
  assert.equal(typeof data.backupCodesRemaining, "number", "backupCodesRemaining should be a number");
  assert.ok(data.backupCodesRemaining >= 0);
});

test("vault.totp_use_backup — consumes one code, returns it, decrements count", { skip }, async () => {
  const before = await api("GET", `/vault/${TEST_CRED}/totp`);
  assert.equal(before.status, 200);
  const initialCount = before.data.backupCodesRemaining;
  if (initialCount === 0) {
    // Nothing to consume; this is the empty-state error case (covered separately)
    return;
  }

  const { status, data } = await api("POST", `/vault/${TEST_CRED}/totp/backup`);
  assert.equal(status, 200, `consume failed: ${JSON.stringify(data)}`);
  assert.equal(typeof data.code, "string");
  assert.ok(data.code.length > 0, "consumed code should be non-empty");
  assert.equal(data.remaining, initialCount - 1, "remaining should decrement by 1");

  const after = await api("GET", `/vault/${TEST_CRED}/totp`);
  assert.equal(after.data.backupCodesRemaining, initialCount - 1);
});

test("vault.totp_use_backup — two consecutive calls return different codes", { skip }, async () => {
  const before = await api("GET", `/vault/${TEST_CRED}/totp`);
  if (before.data.backupCodesRemaining < 2) return; // not enough left

  const a = await api("POST", `/vault/${TEST_CRED}/totp/backup`);
  const b = await api("POST", `/vault/${TEST_CRED}/totp/backup`);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.notEqual(a.data.code, b.data.code, "consecutive backup codes must differ (single-use)");
});

test("vault.totp_use_backup — 400 when no codes remain", { skip }, async () => {
  // Drain whatever is left
  let safety = 20;
  while (safety-- > 0) {
    const { status } = await api("POST", `/vault/${TEST_CRED}/totp/backup`);
    if (status === 400) break;
    if (status !== 200) throw new Error(`unexpected status while draining: ${status}`);
  }
  const { status, data } = await api("POST", `/vault/${TEST_CRED}/totp/backup`);
  assert.equal(status, 400, "should return 400 once codes are exhausted");
  assert.equal(data.error, "bad_request");
});

test("vault.totp_use_backup — 404 for unknown credential", { skip }, async () => {
  const { status, data } = await api("POST", `/vault/__definitely_not_real__/totp/backup`);
  assert.equal(status, 404);
  assert.equal(data.error, "not_found");
});

test("vault.totp — usedBackupCodes accumulates in vault.get", { skip }, async () => {
  const { status, data } = await api("GET", `/vault/${TEST_CRED}`);
  assert.equal(status, 200);
  // Either backupCodes is empty (drained by previous test) or usedBackupCodes is non-empty
  const used = Array.isArray(data.data?.usedBackupCodes) ? data.data.usedBackupCodes : [];
  assert.ok(used.length > 0, "after prior tests, usedBackupCodes should contain consumed codes");
});
