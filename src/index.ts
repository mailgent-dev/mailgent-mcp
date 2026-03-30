#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_KEY = process.env.MAILGENT_API_KEY || "";
const API_BASE = process.env.MAILGENT_API_URL || "https://api.mailgent.dev";

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
  name: "mailgent",
  version: "0.1.0",
});

// ============================================
// MAIL TOOLS
// ============================================

server.registerTool("mail.whoami", {
  title: "Who Am I",
  description: "Get your agent identity info — email address, name, and scopes",
  inputSchema: {},
}, async () => {
  // Call the API to get identity info
  const { status, data } = await api("GET", "/messages?limit=0");
  if (status === 401) return fail("Invalid API key");
  return ok({ message: "Connected to Mailgent", apiBase: API_BASE });
});

server.registerTool("mail.send", {
  title: "Send Email",
  description: "Send an email from your agent's inbox",
  inputSchema: {
    to: z.array(z.string()).describe("Recipient email addresses"),
    subject: z.string().describe("Email subject"),
    text: z.string().describe("Plain text body"),
    html: z.string().optional().describe("HTML body (optional)"),
    cc: z.array(z.string()).optional().describe("CC recipients"),
    bcc: z.array(z.string()).optional().describe("BCC recipients"),
  },
}, async ({ to, subject, text, html, cc, bcc }) => {
  const { status, data } = await api("POST", "/messages/send", { to, subject, text, html, cc, bcc });
  return status === 201 ? ok(data) : fail("Failed to send", data);
});

server.registerTool("mail.reply", {
  title: "Reply to Email",
  description: "Reply to an existing email in a thread",
  inputSchema: {
    messageId: z.string().describe("The messageId to reply to"),
    text: z.string().describe("Reply text"),
    html: z.string().optional().describe("Reply HTML (optional)"),
  },
}, async ({ messageId, text, html }) => {
  const { status, data } = await api("POST", `/messages/${encodeURIComponent(messageId)}/reply`, { text, html });
  return status === 201 ? ok(data) : fail("Failed to reply", data);
});

server.registerTool("mail.list_messages", {
  title: "List Messages",
  description: "List emails in your inbox. Returns newest first.",
  inputSchema: {
    limit: z.number().optional().describe("Max messages (default 20, max 100)"),
    labels: z.string().optional().describe("Filter by labels, comma-separated"),
    pageToken: z.string().optional().describe("Pagination cursor"),
  },
}, async ({ limit, labels, pageToken }) => {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (labels) params.set("labels", labels);
  if (pageToken) params.set("pageToken", pageToken);
  const q = params.toString();
  const { status, data } = await api("GET", `/messages${q ? `?${q}` : ""}`);
  return status === 200 ? ok(data) : fail("Failed to list messages", data);
});

server.registerTool("mail.get_message", {
  title: "Get Message",
  description: "Get a specific email by messageId",
  inputSchema: {
    messageId: z.string().describe("The messageId"),
  },
}, async ({ messageId }) => {
  const { status, data } = await api("GET", `/messages/${encodeURIComponent(messageId)}`);
  return status === 200 ? ok(data) : fail("Failed to get message", data);
});

server.registerTool("mail.update_labels", {
  title: "Update Labels",
  description: "Add or remove labels on a message",
  inputSchema: {
    messageId: z.string().describe("The messageId"),
    addLabels: z.array(z.string()).optional().describe("Labels to add"),
    removeLabels: z.array(z.string()).optional().describe("Labels to remove"),
  },
}, async ({ messageId, addLabels, removeLabels }) => {
  const { status, data } = await api("PATCH", `/messages/${encodeURIComponent(messageId)}`, { addLabels, removeLabels });
  return status === 200 ? ok(data) : fail("Failed to update labels", data);
});

server.registerTool("mail.list_threads", {
  title: "List Threads",
  description: "List email threads. Returns newest first.",
  inputSchema: {
    limit: z.number().optional().describe("Max threads (default 20, max 100)"),
    pageToken: z.string().optional().describe("Pagination cursor"),
  },
}, async ({ limit, pageToken }) => {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (pageToken) params.set("pageToken", pageToken);
  const q = params.toString();
  const { status, data } = await api("GET", `/threads${q ? `?${q}` : ""}`);
  return status === 200 ? ok(data) : fail("Failed to list threads", data);
});

server.registerTool("mail.get_thread", {
  title: "Get Thread",
  description: "Get a full thread with all messages",
  inputSchema: {
    threadId: z.string().describe("The threadId"),
  },
}, async ({ threadId }) => {
  const { status, data } = await api("GET", `/threads/${threadId}`);
  return status === 200 ? ok(data) : fail("Failed to get thread", data);
});

// ============================================
// VAULT TOOLS
// ============================================

server.registerTool("vault.list", {
  title: "List Credentials",
  description: "List all credentials in the vault (metadata only)",
  inputSchema: {},
}, async () => {
  const { status, data } = await api("GET", "/vault");
  return status === 200 ? ok(data) : fail("Failed to list credentials", data);
});

server.registerTool("vault.get", {
  title: "Get Credential",
  description: "Get a decrypted credential from the vault",
  inputSchema: {
    name: z.string().describe("Credential name"),
  },
}, async ({ name }) => {
  const { status, data } = await api("GET", `/vault/${encodeURIComponent(name)}`);
  return status === 200 ? ok(data) : fail("Failed to get credential", data);
});

server.registerTool("vault.totp", {
  title: "Get TOTP Code",
  description: "Get the current 6-digit TOTP code for a credential",
  inputSchema: {
    name: z.string().describe("Credential name with TOTP"),
  },
}, async ({ name }) => {
  const { status, data } = await api("GET", `/vault/${encodeURIComponent(name)}/totp`);
  return status === 200 ? ok(data) : fail("Failed to get TOTP", data);
});

server.registerTool("vault.store", {
  title: "Store Credential",
  description: "Store or update a credential in the vault",
  inputSchema: {
    name: z.string().describe("Credential name"),
    type: z.enum([
      "LOGIN", "API_KEY", "OAUTH", "TOTP", "SSH_KEY",
      "DATABASE", "SMTP", "AWS", "CERTIFICATE", "CUSTOM",
    ]).describe("Credential type"),
    data: z.record(z.unknown()).describe("Secret fields to encrypt"),
    metadata: z.record(z.unknown()).optional().describe("Non-secret metadata"),
    expiresAt: z.string().optional().describe("Expiry (ISO 8601)"),
  },
}, async ({ name, type, data, metadata, expiresAt }) => {
  const { status, data: res } = await api("PUT", `/vault/${encodeURIComponent(name)}`, { type, data, metadata, expiresAt });
  return status === 200 ? ok(res) : fail("Failed to store credential", res);
});

server.registerTool("vault.delete", {
  title: "Delete Credential",
  description: "Delete a credential from the vault",
  inputSchema: {
    name: z.string().describe("Credential name"),
  },
}, async ({ name }) => {
  const { status, data } = await api("DELETE", `/vault/${encodeURIComponent(name)}`);
  return status === 204 ? ok({ message: `Deleted '${name}'` }) : fail("Failed to delete", data);
});

// ============================================
// START
// ============================================

async function main() {
  if (!API_KEY) {
    console.error("MAILGENT_API_KEY is required. Set it in your MCP config env.");
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server error:", err);
  process.exit(1);
});
