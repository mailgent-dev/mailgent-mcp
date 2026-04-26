#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_KEY = process.env.LOOMAL_API_KEY || "";
const API_BASE = process.env.LOOMAL_API_URL || "https://api.loomal.ai";

async function api(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${API_BASE}/v0${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data };
}

function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function fail(msg: string, data?: unknown) {
  return {
    content: [
      { type: "text" as const, text: data ? `${msg}: ${JSON.stringify(data)}` : msg },
    ],
    isError: true,
  };
}

const server = new McpServer({
  name: "loomal",
  version: "0.1.0",
});

// ============================================
// IDENTITY TOOLS
// ============================================

server.registerTool("identity_whoami", {
  title: "Who Am I",
  description: "Get your agent identity info — name, email, DID, and scopes",
  inputSchema: {},
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async () => {
  const { status, data } = await api("GET", "/whoami");
  if (status === 401) return fail("Invalid API key");
  return status === 200 ? ok(data) : fail("Failed to get identity", data);
});

server.registerTool("identity_sign", {
  title: "Sign Data",
  description: "Sign arbitrary data with this identity's Ed25519 private key. Returns the signature and the identity's DID.",
  inputSchema: {
    data: z.string().describe("Base64-encoded data to sign"),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async ({ data }) => {
  const { status, data: res } = await api("POST", "/whoami/sign", { data });
  return status === 200 ? ok(res) : fail("Failed to sign data", res);
});

server.registerTool("identity_verify", {
  title: "Verify Signature",
  description: "Verify a signature against any did:web identity. Resolves the DID Document and checks the Ed25519 signature.",
  inputSchema: {
    data: z.string().describe("Base64-encoded original data"),
    signature: z.string().describe("Base64-encoded signature to verify"),
    did: z.string().describe("DID of the signer (e.g., did:web:api.loomal.ai:identities:id-abc123)"),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async ({ data, signature, did }) => {
  const { status, data: res } = await api("POST", "/whoami/verify", { data, signature, did });
  return status === 200 ? ok(res) : fail("Failed to verify signature", res);
});

// ============================================
// MAIL TOOLS
// ============================================

server.registerTool("mail_send", {
  title: "Send Email",
  description: "Send an email from your agent's inbox",
  inputSchema: {
    to: z.array(z.string()).describe("Recipient email addresses"),
    subject: z.string().describe("Email subject line"),
    text: z.string().describe("Plain text body of the email"),
    html: z.string().optional().describe("Optional HTML body for rich formatting"),
    cc: z.array(z.string()).optional().describe("Carbon copy recipient email addresses"),
    bcc: z.array(z.string()).optional().describe("Blind carbon copy recipient email addresses"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
}, async ({ to, subject, text, html, cc, bcc }) => {
  const { status, data } = await api("POST", "/messages/send", { to, subject, text, html, cc, bcc });
  return status === 201 ? ok(data) : fail("Failed to send", data);
});

server.registerTool("mail_reply", {
  title: "Reply to Email",
  description: "Reply to an existing email in a thread",
  inputSchema: {
    messageId: z.string().describe("The messageId of the email to reply to"),
    text: z.string().describe("Plain text reply body"),
    html: z.string().optional().describe("HTML reply body (optional)"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
}, async ({ messageId, text, html }) => {
  const { status, data } = await api("POST", `/messages/${encodeURIComponent(messageId)}/reply`, { text, html });
  return status === 201 ? ok(data) : fail("Failed to reply", data);
});

server.registerTool("mail_list_messages", {
  title: "List Messages",
  description: "List emails in your agent's inbox. Returns newest first.",
  inputSchema: {
    limit: z.number().optional().describe("Max messages to return (default 20, max 100)"),
    labels: z.string().optional().describe("Filter by labels, comma-separated"),
    pageToken: z.string().optional().describe("Pagination token"),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async ({ limit, labels, pageToken }) => {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (labels) params.set("labels", labels);
  if (pageToken) params.set("pageToken", pageToken);
  const q = params.toString();
  const { status, data } = await api("GET", `/messages${q ? `?${q}` : ""}`);
  return status === 200 ? ok(data) : fail("Failed to list messages", data);
});

server.registerTool("mail_get_message", {
  title: "Get Message",
  description: "Get a specific email by its messageId",
  inputSchema: {
    messageId: z.string().describe("The messageId to retrieve"),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async ({ messageId }) => {
  const { status, data } = await api("GET", `/messages/${encodeURIComponent(messageId)}`);
  return status === 200 ? ok(data) : fail("Failed to get message", data);
});

server.registerTool("mail_get_attachment", {
  title: "Get Attachment",
  description: "Download the contents of an email attachment as base64-encoded data. Use mail.get_message or mail.get_thread first to find attachment IDs and metadata.",
  inputSchema: {
    messageId: z.string().describe("The messageId that owns the attachment"),
    attachmentId: z.string().describe("The attachmentId from a previous mail.get_message call"),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async ({ messageId, attachmentId }) => {
  const res = await fetch(`${API_BASE}/v0/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (res.status !== 200) {
    const data = await res.json().catch(() => ({}));
    return fail("Failed to get attachment", data);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "application/octet-stream";
  const disposition = res.headers.get("content-disposition") || "";
  const filenameMatch = disposition.match(/filename="(.+?)"/);
  return ok({
    attachmentId,
    messageId,
    filename: filenameMatch?.[1] || "attachment",
    contentType,
    size: buf.length,
    data: buf.toString("base64"),
  });
});

server.registerTool("mail_update_labels", {
  title: "Update Labels",
  description: "Add or remove labels on a message",
  inputSchema: {
    messageId: z.string().describe("The messageId to update"),
    addLabels: z.array(z.string()).optional().describe("Labels to add to the message (e.g. 'important', 'follow-up')"),
    removeLabels: z.array(z.string()).optional().describe("Labels to remove from the message"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async ({ messageId, addLabels, removeLabels }) => {
  const { status, data } = await api("PATCH", `/messages/${encodeURIComponent(messageId)}`, { addLabels, removeLabels });
  return status === 200 ? ok(data) : fail("Failed to update labels", data);
});

server.registerTool("mail_update_thread_labels", {
  title: "Update Thread Labels",
  description: "Add or remove labels on a thread (e.g. 'starred', 'important', 'archived', or custom labels). Thread labels are separate from message labels.",
  inputSchema: {
    threadId: z.string().describe("The threadId to update"),
    addLabels: z.array(z.string()).optional().describe("Labels to add to the thread"),
    removeLabels: z.array(z.string()).optional().describe("Labels to remove from the thread"),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
}, async ({ threadId, addLabels, removeLabels }) => {
  const { status, data } = await api("PATCH", `/threads/${threadId}`, { addLabels, removeLabels });
  return status === 200 ? ok(data) : fail("Failed to update thread labels", data);
});

server.registerTool("mail_delete_message", {
  title: "Delete Message",
  description: "Delete a single message from the inbox",
  inputSchema: {
    messageId: z.string().describe("The messageId to delete"),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
}, async ({ messageId }) => {
  const { status, data } = await api("DELETE", `/messages/${encodeURIComponent(messageId)}`);
  return status === 204 ? ok({ message: `Deleted message '${messageId}'` }) : fail("Failed to delete", data);
});

server.registerTool("mail_delete_thread", {
  title: "Delete Thread",
  description: "Delete an entire thread and all its messages",
  inputSchema: {
    threadId: z.string().describe("The threadId to delete"),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
}, async ({ threadId }) => {
  const { status, data } = await api("DELETE", `/threads/${threadId}`);
  return status === 204 ? ok({ message: `Deleted thread '${threadId}'` }) : fail("Failed to delete thread", data);
});

// ============================================
// EMAIL RULES (ALLOW/BLOCK LISTS)
// ============================================

server.registerTool("mail_list_rules", {
  title: "List Email Rules",
  description: "List all allow/block rules for this identity",
  inputSchema: {},
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async () => {
  const { status, data } = await api("GET", "/email-rules");
  return status === 200 ? ok(data) : fail("Failed to list rules", data);
});

server.registerTool("mail_add_rule", {
  title: "Add Email Rule",
  description: "Add an allow or block rule for email. Use type ALLOW or BLOCK, scope RECEIVE/SEND/REPLY, and value as email or *@domain.com pattern.",
  inputSchema: {
    type: z.enum(["ALLOW", "BLOCK"]).describe("Rule type: ALLOW or BLOCK"),
    scope: z.enum(["RECEIVE", "SEND", "REPLY"]).describe("Rule scope: RECEIVE, SEND, or REPLY"),
    value: z.string().describe("Email address (user@example.com) or domain pattern (*@domain.com)"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
}, async ({ type, scope, value }) => {
  const { status, data } = await api("POST", "/email-rules", { type, scope, value });
  return status === 201 ? ok(data) : fail("Failed to add rule", data);
});

server.registerTool("mail_delete_rule", {
  title: "Delete Email Rule",
  description: "Delete an email allow/block rule by its ID",
  inputSchema: {
    ruleId: z.string().describe("The rule ID to delete"),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
}, async ({ ruleId }) => {
  const { status, data } = await api("DELETE", `/email-rules/${encodeURIComponent(ruleId)}`);
  return status === 204 ? ok({ message: `Deleted rule '${ruleId}'` }) : fail("Failed to delete rule", data);
});

server.registerTool("mail_list_threads", {
  title: "List Threads",
  description: "List email threads in your agent's inbox. Returns newest first.",
  inputSchema: {
    limit: z.number().optional().describe("Max threads to return (default 20, max 100)"),
    pageToken: z.string().optional().describe("Pagination token"),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async ({ limit, pageToken }) => {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (pageToken) params.set("pageToken", pageToken);
  const q = params.toString();
  const { status, data } = await api("GET", `/threads${q ? `?${q}` : ""}`);
  return status === 200 ? ok(data) : fail("Failed to list threads", data);
});

server.registerTool("mail_get_thread", {
  title: "Get Thread",
  description: "Get a full email thread with messages (newest 200 by default)",
  inputSchema: {
    threadId: z.string().describe("The threadId to retrieve"),
    limit: z.number().optional().describe("Max messages to return (default 200, max 500)"),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async ({ threadId, limit }) => {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  const q = params.toString();
  const { status, data } = await api("GET", `/threads/${threadId}${q ? `?${q}` : ""}`);
  return status === 200 ? ok(data) : fail("Failed to get thread", data);
});

// ============================================
// VAULT TOOLS
// ============================================

server.registerTool("vault_list", {
  title: "List Credentials",
  description: "List all credentials in the vault (metadata only, no secrets)",
  inputSchema: {},
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async () => {
  const { status, data } = await api("GET", "/vault");
  return status === 200 ? ok(data) : fail("Failed to list credentials", data);
});

server.registerTool("vault_get", {
  title: "Get Credential",
  description: "Retrieve a decrypted credential from the vault. For TOTP credentials, use vault.totp instead to get the code.",
  inputSchema: {
    name: z.string().describe("Credential name (e.g. 'salesforce', 'hubspot-api')"),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async ({ name }) => {
  const { status, data } = await api("GET", `/vault/${encodeURIComponent(name)}`);
  return status === 200 ? ok(data) : fail("Failed to get credential", data);
});

server.registerTool("vault_totp", {
  title: "Get TOTP Code",
  description: "Generate the current 6-digit TOTP code. Works on any credential that has a TOTP secret. Response also includes backupCodesRemaining (count of stored single-use recovery codes); call vault.totp_use_backup when the live TOTP is unavailable.",
  inputSchema: {
    name: z.string().describe("Credential name with TOTP"),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
}, async ({ name }) => {
  const { status, data } = await api("GET", `/vault/${encodeURIComponent(name)}/totp`);
  return status === 200 ? ok(data) : fail("Failed to get TOTP", data);
});

server.registerTool("vault_totp_use_backup", {
  title: "Use TOTP Backup Code",
  description: "Atomically consume one single-use TOTP backup code. The popped code is moved into data.usedBackupCodes for audit. Use when the live TOTP code is unavailable (clock skew, lost device).",
  inputSchema: {
    name: z.string().describe("Credential name with backup codes"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
}, async ({ name }) => {
  const { status, data } = await api("POST", `/vault/${encodeURIComponent(name)}/totp/backup`);
  return status === 200 ? ok(data) : fail("Failed to consume backup code", data);
});

server.registerTool("vault_store", {
  title: "Store Credential",
  description: "Store or update an encrypted credential in the vault. Prefer the typed helpers (vault.storeApiKey, vault.storeCard, vault.storeShippingAddress) when they fit.",
  inputSchema: {
    name: z.string().describe("Credential name (e.g. 'salesforce', 'prod-db')"),
    type: z.enum([
      "LOGIN", "API_KEY", "OAUTH", "TOTP", "SSH_KEY",
      "DATABASE", "SMTP", "AWS", "CERTIFICATE",
      "CARD", "SHIPPING_ADDRESS", "CUSTOM",
    ]).describe("Credential type"),
    data: z.record(z.string(), z.any()).describe("Secret fields to encrypt (e.g. { key: 'sk_...' })"),
    metadata: z.record(z.string(), z.any()).optional().describe("Non-secret metadata for display (e.g. { service: 'stripe' })"),
    expiresAt: z.string().optional().describe("Expiry date (ISO 8601)"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async ({ name, type, data, metadata, expiresAt }) => {
  const { status, data: res } = await api("PUT", `/vault/${encodeURIComponent(name)}`, { type, data, metadata, expiresAt });
  return status === 200 ? ok(res) : fail("Failed to store credential", res);
});

server.registerTool("vault.storeApiKey", {
  title: "Store API Key",
  description: "Store an API_KEY credential. Use just 'secret' for single-key services (e.g. sk_live_...), or both 'clientId' and 'secret' for OAuth-style client credentials.",
  inputSchema: {
    name: z.string().describe("Credential name (e.g. 'stripe', 'twitter')"),
    secret: z.string().describe("The API key / secret"),
    clientId: z.string().optional().describe("OAuth client ID (omit for single-secret keys)"),
    expiresAt: z.string().optional().describe("Expiry date (ISO 8601)"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async ({ name, secret, clientId, expiresAt }) => {
  const data = clientId ? { clientId, secret } : { key: secret };
  const metadata: Record<string, unknown> = { prefix: secret.slice(0, 8) + "..." };
  if (clientId) metadata.clientId = clientId;
  const { status, data: res } = await api("PUT", `/vault/${encodeURIComponent(name)}`, { type: "API_KEY", data, metadata, expiresAt });
  return status === 200 ? ok(res) : fail("Failed to store API key", res);
});

server.registerTool("vault.storeCard", {
  title: "Store Card",
  description: "Store a payment card as an encrypted credential. This is password-manager-style secret storage — the vault does NOT charge the card.",
  inputSchema: {
    name: z.string().describe("Credential name (e.g. 'personal-visa')"),
    cardholder: z.string().describe("Cardholder name"),
    number: z.string().describe("Card number"),
    expMonth: z.string().describe("Expiration month (MM)"),
    expYear: z.string().describe("Expiration year (YYYY)"),
    cvc: z.string().describe("CVC / CVV"),
    zip: z.string().optional().describe("Billing ZIP / postal code"),
    brand: z.string().optional().describe("Card brand (Visa, Mastercard, etc.) — stored in metadata for display"),
    expiresAt: z.string().optional().describe("Credential expiry date (ISO 8601)"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async ({ name, cardholder, number, expMonth, expYear, cvc, zip, brand, expiresAt }) => {
  const normalized = number.replace(/\s+/g, "");
  const data: Record<string, unknown> = { cardholder, number, expMonth, expYear, cvc };
  if (zip) data.zip = zip;
  const metadata: Record<string, unknown> = { last4: normalized.slice(-4) };
  if (brand) metadata.brand = brand;
  const { status, data: res } = await api("PUT", `/vault/${encodeURIComponent(name)}`, { type: "CARD", data, metadata, expiresAt });
  return status === 200 ? ok(res) : fail("Failed to store card", res);
});

server.registerTool("vault.storeShippingAddress", {
  title: "Store Shipping Address",
  description: "Store a shipping / mailing address as an encrypted credential.",
  inputSchema: {
    name: z.string().describe("Credential name (e.g. 'home', 'office')"),
    recipient: z.string().describe("Recipient name"),
    line1: z.string().describe("Address line 1"),
    line2: z.string().optional().describe("Address line 2"),
    city: z.string().describe("City"),
    state: z.string().describe("State / region"),
    postcode: z.string().describe("Postcode / ZIP"),
    country: z.string().describe("Country code (ISO 3166-1 alpha-2, e.g. 'US')"),
    phone: z.string().optional().describe("Phone number"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async ({ name, recipient, line1, line2, city, state, postcode, country, phone }) => {
  const data: Record<string, unknown> = {
    name: recipient, line1, city, state, postcode, country: country.toUpperCase(),
  };
  if (line2) data.line2 = line2;
  if (phone) data.phone = phone;
  const { status, data: res } = await api("PUT", `/vault/${encodeURIComponent(name)}`, { type: "SHIPPING_ADDRESS", data });
  return status === 200 ? ok(res) : fail("Failed to store shipping address", res);
});

server.registerTool("vault_delete", {
  title: "Delete Credential",
  description: "Remove a credential from the vault",
  inputSchema: {
    name: z.string().describe("Credential name to delete"),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
}, async ({ name }) => {
  const { status, data } = await api("DELETE", `/vault/${encodeURIComponent(name)}`);
  return status === 204 ? ok({ message: `Deleted '${name}'` }) : fail("Failed to delete", data);
});

// ============================================
// CALENDAR TOOLS
// ============================================

server.registerTool("calendar_create", {
  title: "Create Calendar Event",
  description: "Create a new event on this identity's calendar",
  inputSchema: {
    title: z.string().describe("Event title"),
    description: z.string().optional().describe("Event description"),
    startAt: z.string().describe("Start date/time (ISO 8601)"),
    endAt: z.string().optional().describe("End date/time (ISO 8601)"),
    isAllDay: z.boolean().default(false).describe("All-day event"),
    location: z.string().optional().describe("Event location"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
}, async ({ title, description, startAt, endAt, isAllDay, location }) => {
  const { status, data } = await api("POST", "/calendar", { title, description, startAt, endAt, isAllDay, location });
  return status === 201 || status === 200 ? ok(data) : fail("Failed to create event", data);
});

server.registerTool("calendar_update", {
  title: "Update Calendar Event",
  description: "Update an existing calendar event",
  inputSchema: {
    eventId: z.string().describe("Event ID to update"),
    title: z.string().optional().describe("New title"),
    description: z.string().optional().describe("New description"),
    startAt: z.string().optional().describe("New start date/time (ISO 8601)"),
    endAt: z.string().optional().describe("New end date/time (ISO 8601)"),
    isAllDay: z.boolean().optional().describe("All-day event"),
    location: z.string().optional().describe("New location"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async ({ eventId, ...fields }) => {
  const { status, data } = await api("PATCH", `/calendar/${eventId}`, fields);
  return status === 200 ? ok(data) : fail("Failed to update event", data);
});

server.registerTool("calendar_list", {
  title: "List Calendar Events",
  description: "List events on this identity's calendar",
  inputSchema: {
    limit: z.number().optional().describe("Max results (default 50, max 100)"),
    from: z.string().optional().describe("Filter: events starting from (ISO 8601)"),
    to: z.string().optional().describe("Filter: events starting before (ISO 8601)"),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async ({ limit, from, to }) => {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const q = params.toString();
  const { status, data } = await api("GET", `/calendar${q ? `?${q}` : ""}`);
  return status === 200 ? ok(data) : fail("Failed to list events", data);
});

server.registerTool("calendar_get", {
  title: "Get Calendar Event",
  description: "Get details of a specific calendar event",
  inputSchema: {
    eventId: z.string().describe("Event ID"),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async ({ eventId }) => {
  const { status, data } = await api("GET", `/calendar/${eventId}`);
  return status === 200 ? ok(data) : fail("Failed to get event", data);
});

server.registerTool("calendar_delete", {
  title: "Delete Calendar Event",
  description: "Delete a calendar event",
  inputSchema: {
    eventId: z.string().describe("Event ID to delete"),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
}, async ({ eventId }) => {
  const { status, data } = await api("DELETE", `/calendar/${eventId}`);
  return status === 204 ? ok({ message: `Deleted event '${eventId}'` }) : fail("Failed to delete event", data);
});

server.registerTool("calendar_set_public", {
  title: "Set Calendar Visibility",
  description: "Make this identity's calendar public or private. Public calendars are viewable at /identities/:id/calendar.json",
  inputSchema: {
    enabled: z.boolean().describe("true = public, false = private"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async ({ enabled }) => {
  const { status, data } = await api("POST", "/calendar/public", { enabled });
  return status === 200 ? ok(data) : fail("Failed to set calendar visibility", data);
});

// ============================================
// PROMPTS
// ============================================

server.registerPrompt("whoami", {
  title: "Who Am I",
  description: "Get your agent identity — name, email, and permissions",
}, async () => ({
  messages: [{
    role: "user" as const,
    content: { type: "text" as const, text: "Tell me who I am. Get my identity info including my name, email address, and what scopes/permissions I have." },
  }],
}));

server.registerPrompt("check-inbox", {
  title: "Check Inbox",
  description: "Check your inbox for new and unread messages",
}, async () => ({
  messages: [{
    role: "user" as const,
    content: { type: "text" as const, text: "Check my inbox for any new or unread messages. Summarize what you find, including sender, subject, and a brief preview of each message." },
  }],
}));

server.registerPrompt("daily-digest", {
  title: "Daily Digest",
  description: "Get a summary of today's email activity",
}, async () => ({
  messages: [{
    role: "user" as const,
    content: { type: "text" as const, text: "Give me a daily digest of my email activity. List all threads updated today, any unread messages, and highlight anything that needs my attention." },
  }],
}));

server.registerPrompt("read-thread", {
  title: "Read Thread",
  description: "Read a specific email thread and summarize the conversation",
  argsSchema: {
    threadId: z.string().describe("The thread ID to read"),
  },
}, async ({ threadId }) => ({
  messages: [{
    role: "user" as const,
    content: { type: "text" as const, text: `Read thread ${threadId} and give me a summary of the full conversation — who said what, key points, and any action items.` },
  }],
}));

server.registerPrompt("search-messages", {
  title: "Search Messages",
  description: "Search inbox messages by label or keyword",
  argsSchema: {
    query: z.string().describe("Label or keyword to search for"),
  },
}, async ({ query }) => ({
  messages: [{
    role: "user" as const,
    content: { type: "text" as const, text: `Search my inbox for messages related to "${query}". List matching messages with sender, subject, and date.` },
  }],
}));

server.registerPrompt("send-email", {
  title: "Send Email",
  description: "Compose and send an email",
  argsSchema: {
    to: z.string().describe("Recipient email address"),
    subject: z.string().describe("Email subject"),
  },
}, async ({ to, subject }) => ({
  messages: [{
    role: "user" as const,
    content: { type: "text" as const, text: `Compose and send an email to ${to} with the subject "${subject}". Ask me what the email body should contain before sending.` },
  }],
}));

server.registerPrompt("reply-to-email", {
  title: "Reply to Email",
  description: "Reply to a specific email message",
  argsSchema: {
    messageId: z.string().describe("The message ID to reply to"),
  },
}, async ({ messageId }) => ({
  messages: [{
    role: "user" as const,
    content: { type: "text" as const, text: `Read message ${messageId}, show me its contents, and help me draft a reply. Show me the draft before sending.` },
  }],
}));

server.registerPrompt("follow-up", {
  title: "Follow Up",
  description: "Send a follow-up email on a thread",
  argsSchema: {
    threadId: z.string().describe("The thread ID to follow up on"),
  },
}, async ({ threadId }) => ({
  messages: [{
    role: "user" as const,
    content: { type: "text" as const, text: `Read thread ${threadId}, understand the conversation context, and help me draft a follow-up message. Show me the draft before sending.` },
  }],
}));

server.registerPrompt("label-messages", {
  title: "Label Messages",
  description: "Add or remove labels on messages",
  argsSchema: {
    label: z.string().describe("Label to add or remove"),
  },
}, async ({ label }) => ({
  messages: [{
    role: "user" as const,
    content: { type: "text" as const, text: `Find all messages that should be labeled "${label}" and add the label to them. Show me which messages you're labeling.` },
  }],
}));

server.registerPrompt("cleanup-inbox", {
  title: "Cleanup Inbox",
  description: "Clean up inbox by archiving or deleting old messages",
}, async () => ({
  messages: [{
    role: "user" as const,
    content: { type: "text" as const, text: "Help me clean up my inbox. List old threads and messages that can be archived or deleted. Ask for confirmation before deleting anything." },
  }],
}));

server.registerPrompt("list-credentials", {
  title: "List Credentials",
  description: "List all credentials stored in the vault",
}, async () => ({
  messages: [{
    role: "user" as const,
    content: { type: "text" as const, text: "List all credentials in my vault. Show the name, type, and when each was last used. Do not show any secret values." },
  }],
}));

server.registerPrompt("store-credential", {
  title: "Store Credential",
  description: "Store a new credential in the vault",
  argsSchema: {
    name: z.string().describe("Credential name (e.g. 'stripe-api')"),
    type: z.string().describe("Credential type (e.g. API_KEY, LOGIN, TOTP)"),
  },
}, async ({ name, type }) => ({
  messages: [{
    role: "user" as const,
    content: { type: "text" as const, text: `Store a new ${type} credential named "${name}" in the vault. Ask me for the secret values to store.` },
  }],
}));

server.registerPrompt("get-totp", {
  title: "Get TOTP Code",
  description: "Generate a 2FA code from a stored credential",
  argsSchema: {
    name: z.string().describe("Credential name with TOTP"),
  },
}, async ({ name }) => ({
  messages: [{
    role: "user" as const,
    content: { type: "text" as const, text: `Generate the current TOTP 2FA code for the credential "${name}" and tell me the code and how many seconds until it expires.` },
  }],
}));

// ============================================
// PLATFORM MODE
// ============================================

const IS_PLATFORM = API_KEY.startsWith("lopk-");

const platformServer = new McpServer({
  name: "loomal-platform",
  version: "0.1.0",
});

function platformApi(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  return api(method, `/platform${path}`, body);
}

if (IS_PLATFORM) {
  platformServer.registerTool("identities_list", {
    title: "List Identities",
    description: "List all identities in the organization",
    inputSchema: {
      limit: z.number().optional().describe("Max results (default 50, max 100)"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ limit }) => {
    const params = new URLSearchParams();
    if (limit) params.set("limit", String(limit));
    const q = params.toString();
    const { status, data } = await platformApi("GET", `/identities${q ? `?${q}` : ""}`);
    return status === 200 ? ok(data) : fail("Failed to list identities", data);
  });

  platformServer.registerTool("identities_get", {
    title: "Get Identity",
    description: "Get details of a specific identity",
    inputSchema: {
      identityId: z.string().describe("Identity ID"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ identityId }) => {
    const { status, data } = await platformApi("GET", `/identities/${identityId}`);
    return status === 200 ? ok(data) : fail("Failed to get identity", data);
  });

  platformServer.registerTool("identities_create", {
    title: "Create Identity",
    description: "Create a new agent identity with an email inbox and API key",
    inputSchema: {
      name: z.string().describe("Display name (e.g. Sales Agent)"),
      emailName: z.string().describe("Email prefix (e.g. salesagent)"),
      scopes: z.array(z.string()).describe("Scopes: mail:read, mail:send, mail:manage, vault:read, vault:write, identity:sign, identity:verify, calendar:read, calendar:write, calendar:delete, calendar:public"),
    },
  }, async ({ name, emailName, scopes }) => {
    const { status, data } = await platformApi("POST", "/identities", { name, emailName, scopes });
    return status === 201 || status === 200 ? ok(data) : fail("Failed to create identity", data);
  });

  platformServer.registerTool("identities_delete", {
    title: "Delete Identity",
    description: "Permanently delete an identity and all its data (inbox, vault, logs)",
    inputSchema: {
      identityId: z.string().describe("Identity ID to delete"),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  }, async ({ identityId }) => {
    const { status, data } = await platformApi("DELETE", `/identities/${identityId}`);
    return status === 204 ? ok({ message: `Deleted identity ${identityId}` }) : fail("Failed to delete identity", data);
  });

  platformServer.registerTool("identities_rotate_key", {
    title: "Rotate Identity Key",
    description: "Generate a new API key for an identity. The old key is immediately invalidated.",
    inputSchema: {
      identityId: z.string().describe("Identity ID to rotate key for"),
    },
  }, async ({ identityId }) => {
    const { status, data } = await platformApi("POST", `/identities/${identityId}/rotate-key`);
    return status === 200 ? ok(data) : fail("Failed to rotate key", data);
  });

  platformServer.registerTool("identities_update_scopes", {
    title: "Update Identity Scopes",
    description: "Add or remove scopes from an identity",
    inputSchema: {
      identityId: z.string().describe("Identity ID"),
      addScopes: z.array(z.string()).optional().describe("Scopes to add"),
      removeScopes: z.array(z.string()).optional().describe("Scopes to remove"),
    },
  }, async ({ identityId, addScopes, removeScopes }) => {
    const { status, data } = await platformApi("PATCH", `/identities/${identityId}`, { addScopes, removeScopes });
    return status === 200 ? ok(data) : fail("Failed to update scopes", data);
  });
}

// ============================================
// START
// ============================================

async function main() {
  if (!API_KEY) {
    console.error("LOOMAL_API_KEY is required. Set it in your MCP config env.");
    process.exit(1);
  }

  const transport = new StdioServerTransport();

  if (IS_PLATFORM) {
    console.error("Platform mode: lopk- key detected. Registering identity management tools.");
    await platformServer.connect(transport);
  } else {
    await server.connect(transport);
  }
}

main().catch((err) => {
  console.error("MCP server error:", err);
  process.exit(1);
});
