import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DB, SOURCE_MORPHS, DEPOSIT_TYPES, CONFIDENCE_VALUES, DEPOSIT_STATUS, SIGNAL_TYPES } from "../constants.js";
import { createPage, makeReceipt, toRichText } from "../services/notion.js";

export function registerReceiveTools(server: McpServer): void {

  server.registerTool(
    "claudine_deposit_session",
    {
      title: "Deposit Session Content",
      description: `Write structured content into the Claudine Session Deposits database. Use at conversation end, or when Chrispey says deposit, settle, or exhale. Each call deposits ONE item. Call multiple times for multiple items. Contract v0.1: title property is Deposit, confidence is a select (tentative/probable/verified), type is multi-select.`,
      inputSchema: z.object({
        deposit: z.string().min(5).max(200).describe("Title of the deposit — short, self-contained label"),
        content: z.string().min(10).max(5000).describe("Full content, written to be read without conversation context"),
        source_morph: z.enum(SOURCE_MORPHS).describe("Which morph is depositing"),
        type: z.array(z.enum(DEPOSIT_TYPES)).optional().describe("One or more deposit types"),
        owner_morph: z.enum(SOURCE_MORPHS).optional().describe("Which morph owns this item downstream"),
        confidence: z.enum(CONFIDENCE_VALUES).default("tentative").describe("tentative / probable / verified"),
        status: z.enum(DEPOSIT_STATUS).default("Not started"),
        destination: z.string().optional().describe("Target database or page for routing"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ deposit, content, source_morph, type, owner_morph, confidence, status, destination }) => {
      const properties: Record<string, unknown> = {
        "Deposit": { title: [{ text: { content: deposit } }] },
        "Content": { rich_text: toRichText(content) },
        "Source Morph": { select: { name: source_morph } },
        "Confidence": { select: { name: confidence } },
        "Status": { status: { name: status } },
      };
      if (type && type.length > 0) properties["Type"] = { multi_select: type.map(t => ({ name: t })) };
      if (owner_morph) properties["Owner morph"] = { select: { name: owner_morph } };
      if (destination) properties["Destination"] = { rich_text: toRichText(destination) };

      const { id, url } = await createPage({
        parent: { database_id: DB.SESSION_DEPOSITS },
        properties: properties as Parameters<typeof createPage>[0]["properties"],
      });

      const receipt = makeReceipt("deposit_session", id, url, {
        deposit, source_morph, type: type ?? [], confidence, status,
        content_preview: content.slice(0, 80) + (content.length > 80 ? "..." : ""),
      });
      return {
        content: [{ type: "text", text: JSON.stringify(receipt, null, 2) }],
        structuredContent: receipt,
      };
    }
  );

  server.registerTool(
    "claudine_create_task",
    {
      title: "Create Task",
      description: `Create a task in the Claudine Tasks database. Contract v0.1: required fields are Task (title) and Domain. Status defaults to To do, Priority to Medium, Triage to Inbox.`,
      inputSchema: z.object({
        task: z.string().min(3).max(300).describe("Task title"),
        domain: z.enum(["System","Bridge","Constellation","Keeper","Versailles","Crucible","TYC","Track Two","Repository","Brunch Babies","La Fondation"]).describe("Owning domain"),
        priority: z.enum(["High","Medium","Low"]).default("Medium"),
        triage: z.enum(["Inbox","Upcoming","Scheduled","Someday"]).default("Inbox"),
        status: z.enum(["Inbox","To do","Doing","Done"]).default("To do"),
        notes: z.string().max(2000).optional(),
        due: z.string().optional().describe("Due date in YYYY-MM-DD format"),
        source_url: z.string().url().optional().describe("Source URL if applicable"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ task, domain, priority, triage, status, notes, due, source_url }) => {
      const properties: Record<string, unknown> = {
        "Task": { title: [{ text: { content: task } }] },
        "Domain": { select: { name: domain } },
        "Priority": { select: { name: priority } },
        "Triage": { select: { name: triage } },
        "Status": { status: { name: status } },
      };
      if (notes) properties["Notes"] = { rich_text: toRichText(notes) };
      if (due) properties["Due"] = { date: { start: due } };
      if (source_url) properties["Source"] = { url: source_url };

      const { id, url } = await createPage({
        parent: { database_id: DB.CLAUDINE_TASKS },
        properties: properties as Parameters<typeof createPage>[0]["properties"],
      });

      const receipt = makeReceipt("create_task", id, url, { task, domain, priority, triage, status });
      return {
        content: [{ type: "text", text: JSON.stringify(receipt, null, 2) }],
        structuredContent: receipt,
      };
    }
  );

  server.registerTool(
    "claudine_send_signal",
    {
      title: "Send Inter-Morph Signal",
      description: `Write a signal to the Signal Board for inter-morph coordination. Requires SIGNAL_BOARD_DB_ID environment variable. Signals are stigmergic traces — they persist and decay, not direct messages.`,
      inputSchema: z.object({
        from_morph: z.enum(SOURCE_MORPHS).describe("Sending morph"),
        for_morphs: z.array(z.enum(SOURCE_MORPHS)).min(1).describe("Receiving morphs"),
        signal_type: z.enum(SIGNAL_TYPES),
        message: z.string().min(10).max(2000).describe("Self-contained signal content"),
        intensity: z.number().min(0).max(1).default(0.7),
        priority: z.enum(["low","medium","high"]).default("medium"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ from_morph, for_morphs, signal_type, message, intensity, priority }) => {
      if (!DB.SIGNAL_BOARD) {
        return { content: [{ type: "text", text: "Signal Board not yet created. Set SIGNAL_BOARD_DB_ID after La Fondation builds the database." }] };
      }
      const { id, url } = await createPage({
        parent: { database_id: DB.SIGNAL_BOARD },
        properties: {
          "Name": { title: [{ text: { content: `${from_morph} to ${for_morphs.join(", ")}: ${signal_type}` } }] },
          "From": { select: { name: from_morph } },
          "For": { multi_select: for_morphs.map(m => ({ name: m })) },
          "Type": { select: { name: signal_type } },
          "Message": { rich_text: toRichText(message) },
          "Intensity": { number: intensity },
          "Priority": { select: { name: priority } },
          "Resolved": { status: { name: "Not started" } },
        } as Parameters<typeof createPage>[0]["properties"],
      });
      const receipt = makeReceipt("send_signal", id, url, { from_morph, for_morphs, signal_type, intensity, priority });
      return {
        content: [{ type: "text", text: JSON.stringify(receipt, null, 2) }],
        structuredContent: receipt,
      };
    }
  );
}
