import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DB, SOURCE_MORPHS } from "../constants.js";
import {
  queryDatabase, getNotion, getText, getSelect, getStatus,
  getMultiSelect, getNumber, getCreatedTime,
} from "../services/notion.js";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { SIGNAL_BOARD_HTML } from "../ui/signal-board.js";

/**
 * MCP Apps (SEP-1865) UI resource for the signal queue.
 *
 * Registered unconditionally rather than gated on client capability. The spec
 * suggests checking `getUiCapability(clientCapabilities)` before registering
 * UI-enabled tools, but Claudine constructs a fresh McpServer per HTTP request
 * and registers every tool inside createServer(), before the transport is
 * connected. Client capabilities are not knowable at registration time.
 *
 * Unconditional registration is safe: per the spec, a host that does not
 * support MCP Apps ignores `_meta.ui` and the tool behaves as a normal
 * text-only tool. The `content` array is populated either way.
 */
const SIGNAL_BOARD_URI = "ui://claudine/signal-board.html";

export function registerHoldTools(server: McpServer): void {

  server.registerTool(
    "claudine_get_unrouted_deposits",
    {
      title: "Get Unrouted Session Deposits",
      description: `Fetch deposits from Session Deposits with Status = Not started. Use at conversation start to check what is waiting for attention.`,
      inputSchema: z.object({
        limit: z.number().int().min(1).max(50).default(10),
        source_morph: z.enum(SOURCE_MORPHS).optional(),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ limit, source_morph }) => {
      const andFilters: unknown[] = [{ property: "Status", status: { equals: "Not started" } }];
      if (source_morph) andFilters.push({ property: "Source Morph", select: { equals: source_morph } });
      const results = await queryDatabase(DB.SESSION_DEPOSITS, { and: andFilters } as Parameters<typeof queryDatabase>[1], [{ timestamp: "created_time", direction: "descending" }], limit);
      if (results.length === 0) return { content: [{ type: "text", text: "No unrouted deposits found." }], structuredContent: { deposits: [], count: 0 } };
      const deposits = results.map(page => ({
        id: (page as { id: string }).id,
        deposit: getText(page, "Deposit"),
        source_morph: getSelect(page, "Source Morph"),
        owner_morph: getSelect(page, "Owner morph"),
        confidence: getSelect(page, "Confidence"),
        url: `https://notion.so/${(page as { id: string }).id.replace(/-/g, "")}`,
      }));
      return { content: [{ type: "text", text: JSON.stringify({ deposits, count: deposits.length }, null, 2) }], structuredContent: { deposits, count: deposits.length } };
    }
  );

  server.registerTool(
    "claudine_get_tasks",
    {
      title: "Get Tasks",
      description: `Fetch tasks from Claudine Tasks database. Filter by status, triage, domain, or priority.`,
      inputSchema: z.object({
        status: z.enum(["Inbox","To do","Doing","Done"]).optional(),
        triage: z.enum(["Inbox","Upcoming","Scheduled","Someday"]).optional(),
        domain: z.enum(["System","Bridge","Constellation","Keeper","Versailles","Crucible","TYC","Track Two","Repository","Brunch Babies","La Fondation"]).optional(),
        priority: z.enum(["High","Medium","Low"]).optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ status, triage, domain, priority, limit }) => {
      const andFilters: unknown[] = [];
      if (status) andFilters.push({ property: "Status", status: { equals: status } });
      if (triage) andFilters.push({ property: "Triage", select: { equals: triage } });
      if (domain) andFilters.push({ property: "Domain", select: { equals: domain } });
      if (priority) andFilters.push({ property: "Priority", select: { equals: priority } });
      const filter = andFilters.length > 0 ? { and: andFilters } : undefined;
      const results = await queryDatabase(DB.CLAUDINE_TASKS, filter as Parameters<typeof queryDatabase>[1], [{ property: "Priority", direction: "descending" }], limit);
      if (results.length === 0) return { content: [{ type: "text", text: "No tasks found." }], structuredContent: { tasks: [], count: 0 } };
      const tasks = results.map(page => ({
        id: (page as { id: string }).id,
        task: getText(page, "Task"),
        domain: getSelect(page, "Domain"),
        priority: getSelect(page, "Priority"),
        triage: getSelect(page, "Triage"),
        status: getStatus(page, "Status"),
        url: `https://notion.so/${(page as { id: string }).id.replace(/-/g, "")}`,
      }));
      return { content: [{ type: "text", text: JSON.stringify({ tasks, count: tasks.length }, null, 2) }], structuredContent: { tasks, count: tasks.length } };
    }
  );

  server.registerTool(
    "claudine_get_overdue_tasks",
    {
      title: "Get Overdue Tasks",
      description: `Fetch tasks with a due date before today that are not yet Done. Use during Thursday sync or when checking what has slipped.`,
      inputSchema: z.object({
        domain: z.enum(["System","Bridge","Constellation","Keeper","Versailles","Crucible","TYC","Track Two","Repository","Brunch Babies","La Fondation"]).optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ domain, limit }) => {
      const today = new Date().toISOString().slice(0, 10);
      const andFilters: unknown[] = [
        { property: "Due", date: { before: today } },
        { property: "Status", status: { does_not_equal: "Done" } },
      ];
      if (domain) andFilters.push({ property: "Domain", select: { equals: domain } });
      const results = await queryDatabase(DB.CLAUDINE_TASKS, { and: andFilters } as Parameters<typeof queryDatabase>[1], [{ property: "Due", direction: "ascending" }], limit);
      if (results.length === 0) return { content: [{ type: "text", text: "No overdue tasks found." }], structuredContent: { tasks: [], count: 0 } };
      const tasks = results.map(page => ({
        id: (page as { id: string }).id,
        task: getText(page, "Task"),
        domain: getSelect(page, "Domain"),
        priority: getSelect(page, "Priority"),
        status: getStatus(page, "Status"),
        url: `https://notion.so/${(page as { id: string }).id.replace(/-/g, "")}`,
      }));
      return { content: [{ type: "text", text: JSON.stringify({ tasks, count: tasks.length }, null, 2) }], structuredContent: { tasks, count: tasks.length } };
    }
  );

  server.registerTool(
    "claudine_get_task",
    {
      title: "Get Task",
      description: `Retrieve a single task by its Notion page ID. Use for verification flows or cross-referencing write receipts.`,
      inputSchema: z.object({
        page_id: z.string().min(32).describe("Notion page ID of the task"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ page_id }) => {
      const notion = getNotion();
      const page = await notion.pages.retrieve({ page_id });
      const task = {
        id: page.id,
        task: getText(page, "Task"),
        domain: getSelect(page, "Domain"),
        priority: getSelect(page, "Priority"),
        triage: getSelect(page, "Triage"),
        status: getStatus(page, "Status"),
        url: (page as { url?: string }).url ?? `https://notion.so/${page.id.replace(/-/g, "")}`,
      };
      return { content: [{ type: "text", text: JSON.stringify(task, null, 2) }], structuredContent: task };
    }
  );

  server.registerTool(
    "claudine_search_tasks",
    {
      title: "Search Tasks",
      description: `Search Claudine Tasks by keyword in the task title. Optionally filter by domain or status. Use when you know roughly what a task is called but need its page_id.`,
      inputSchema: z.object({
        query: z.string().min(2).max(200).describe("Keyword to search in task titles"),
        domain: z.enum(["System","Bridge","Constellation","Keeper","Versailles","Crucible","TYC","Track Two","Repository","Brunch Babies","La Fondation"]).optional(),
        status: z.enum(["Inbox","To do","Doing","Done"]).optional(),
        limit: z.number().int().min(1).max(25).default(10),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ query, domain, status, limit }) => {
      const notion = getNotion();
      const response = await notion.databases.query({
        database_id: DB.CLAUDINE_TASKS,
        filter: {
          and: [
            { property: "Task", title: { contains: query } },
            ...(domain ? [{ property: "Domain", select: { equals: domain } }] : []),
            ...(status ? [{ property: "Status", status: { equals: status } }] : []),
          ],
        } as Parameters<typeof notion.databases.query>[0]["filter"],
        page_size: limit,
      });
      if (response.results.length === 0) return { content: [{ type: "text", text: `No tasks found matching "${query}".` }], structuredContent: { tasks: [], count: 0 } };
      const tasks = response.results.map(page => ({
        id: page.id,
        task: getText(page, "Task"),
        domain: getSelect(page, "Domain"),
        priority: getSelect(page, "Priority"),
        status: getStatus(page, "Status"),
        url: (page as { url?: string }).url ?? `https://notion.so/${page.id.replace(/-/g, "")}`,
      }));
      return { content: [{ type: "text", text: JSON.stringify({ tasks, count: tasks.length }, null, 2) }], structuredContent: { tasks, count: tasks.length } };
    }
  );

  // --- MCP Apps: the view, and the tool that renders through it ---

  registerAppResource(
    server,
    SIGNAL_BOARD_URI,
    SIGNAL_BOARD_URI,
    {
      mimeType: RESOURCE_MIME_TYPE,
      description: "Interactive Signal Board queue with inline resolve.",
    },
    async (uri: URL) => ({
      contents: [{
        uri: uri.href,
        mimeType: RESOURCE_MIME_TYPE,
        text: SIGNAL_BOARD_HTML(),
        _meta: {
          ui: {
            // No csp block: the view needs no external origins at all.
            // Omitting it means the host applies its restrictive default,
            // which is exactly what we want.
            prefersBorder: true,
          },
        },
      }],
    })
  );

  registerAppTool(
    server,
    "claudine_get_signals",
    {
      title: "Get Inter-Morph Signals",
      description: `Fetch unresolved signals from the Signal Board addressed to a specific morph. Use at conversation start.`,
      inputSchema: z.object({
        for_morph: z.enum(SOURCE_MORPHS),
        min_intensity: z.number().min(0).max(1).default(0),
        limit: z.number().int().min(1).max(50).default(10),
      }),
      outputSchema: z.object({
        signals: z.array(z.object({
          id: z.string(),
          from: z.string(),
          for: z.array(z.string()),
          type: z.string(),
          message: z.string(),
          priority: z.string(),
          intensity: z.number().nullable(),
          created: z.string(),
          resolved: z.string(),
          url: z.string(),
        })),
        count: z.number(),
        for_morph: z.string(),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { ui: { resourceUri: SIGNAL_BOARD_URI } },
    },
    async ({ for_morph, min_intensity, limit }) => {
      if (!DB.SIGNAL_BOARD) return { content: [{ type: "text", text: "Signal Board not configured." }], structuredContent: { signals: [], count: 0, for_morph } };
      const andFilters: unknown[] = [
        { property: "For", multi_select: { contains: for_morph } },
        { property: "Resolved", status: { does_not_equal: "Done" } },
      ];
      if (min_intensity > 0) andFilters.push({ property: "Intensity", number: { greater_than_or_equal_to: min_intensity } });
      const results = await queryDatabase(DB.SIGNAL_BOARD, { and: andFilters } as Parameters<typeof queryDatabase>[1], [{ timestamp: "created_time", direction: "descending" }], limit);
      if (results.length === 0) return { content: [{ type: "text", text: `No unresolved signals for ${for_morph}.` }], structuredContent: { signals: [], count: 0, for_morph } };
      const signals = results.map(page => ({
        id: (page as { id: string }).id,
        from: getSelect(page, "From"),
        // "for" is what lets the view apply Rule 3: a resolver who is not in
        // this list is a non-addressee, which is exactly the case the routing
        // prompt exists for.
        for: getMultiSelect(page, "For"),
        type: getSelect(page, "Type"),
        message: getText(page, "Message"),
        priority: getSelect(page, "Priority"),
        intensity: getNumber(page, "Intensity"),
        created: getCreatedTime(page),
        resolved: getStatus(page, "Resolved"),
        url: `https://notion.so/${(page as { id: string }).id.replace(/-/g, "")}`,
      }));
      return { content: [{ type: "text", text: JSON.stringify({ signals, count: signals.length }, null, 2) }], structuredContent: { signals, count: signals.length, for_morph } };
    }
  );

  server.registerTool(
    "claudine_get_surface_freshness",
    {
      title: "Get Surface Freshness",
      description: `Check last-edited timestamps on key coordination surfaces.`,
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      const notion = getNotion();
      const surfaces = [
        { name: "Living Sync", id: DB.LIVING_SYNC },
        { name: "Architecture Hub", id: DB.ARCHITECTURE_HUB },
        { name: "Pattern Language", id: DB.PATTERN_LANGUAGE },
      ];
      const results = await Promise.all(surfaces.map(async s => {
        try {
          const page = await notion.pages.retrieve({ page_id: s.id });
          const lastEdited = (page as { last_edited_time?: string }).last_edited_time ?? "unknown";
          const daysSince = lastEdited !== "unknown" ? Math.floor((Date.now() - new Date(lastEdited).getTime()) / 86400000) : null;
          return { surface: s.name, last_edited: lastEdited, days_since_edit: daysSince };
        } catch { return { surface: s.name, last_edited: "error", days_since_edit: null }; }
      }));
      return { content: [{ type: "text", text: JSON.stringify({ surfaces: results }, null, 2) }], structuredContent: { surfaces: results } };
    }
  );
}
