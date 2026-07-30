import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SOURCE_MORPHS, DB } from "../constants.js";
import { updatePage, createPage, makeReceipt, getNotion, toRichText } from "../services/notion.js";

export function registerReflectTools(server: McpServer): void {

  server.registerTool(
    "claudine_update_task",
    {
      title: "Update Task",
      description: `Update properties on an existing Claudine Task. Contract v0.1: Status values are Inbox/To do/Doing/Done. Triage values are Inbox/Upcoming/Scheduled/Someday.`,
      inputSchema: z.object({
        page_id: z.string().min(32),
        status: z.enum(["Inbox","To do","Doing","Done"]).optional(),
        priority: z.enum(["High","Medium","Low"]).optional(),
        triage: z.enum(["Inbox","Upcoming","Scheduled","Someday"]).optional(),
        notes: z.string().max(2000).optional(),
        due: z.string().optional(),
        updated_by: z.enum(SOURCE_MORPHS),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ page_id, status, priority, triage, notes, due, updated_by }) => {
      const properties: Record<string, unknown> = {};
      const written: Record<string, unknown> = { updated_by };
      if (status) { properties["Status"] = { status: { name: status } }; written["status"] = status; }
      if (priority) { properties["Priority"] = { select: { name: priority } }; written["priority"] = priority; }
      if (triage) { properties["Triage"] = { select: { name: triage } }; written["triage"] = triage; }
      if (notes) { properties["Notes"] = { rich_text: toRichText(notes) }; written["notes"] = notes.slice(0, 80); }
      if (due) { properties["Due"] = { date: { start: due } }; written["due"] = due; }
      if (Object.keys(properties).length === 0) return { content: [{ type: "text", text: "No properties to update." }] };
      const { id, url } = await updatePage(page_id, properties as Parameters<typeof updatePage>[1]);
      const receipt = makeReceipt("update_task", id, url, written);
      return { content: [{ type: "text", text: JSON.stringify(receipt, null, 2) }], structuredContent: receipt };
    }
  );

  server.registerTool(
    "claudine_complete_task",
    {
      title: "Complete Task",
      description: `Mark a Claudine Task as Done.`,
      inputSchema: z.object({
        page_id: z.string().min(32),
        completed_by: z.enum(SOURCE_MORPHS),
        completion_note: z.string().max(1000).optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ page_id, completed_by, completion_note }) => {
      const properties: Record<string, unknown> = { "Status": { status: { name: "Done" } } };
      if (completion_note) properties["Notes"] = { rich_text: toRichText(completion_note) };
      const { id, url } = await updatePage(page_id, properties as Parameters<typeof updatePage>[1]);
      const receipt = makeReceipt("complete_task", id, url, { completed_by, completion_note: completion_note ?? null });
      return { content: [{ type: "text", text: JSON.stringify(receipt, null, 2) }], structuredContent: receipt };
    }
  );

  server.registerTool(
    "claudine_resolve_signal",
    {
      title: "Resolve Signal",
      description: `Mark a Signal Board entry as resolved.`,
      inputSchema: z.object({
        page_id: z.string().min(32),
        resolved_by: z.enum(SOURCE_MORPHS),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ page_id, resolved_by }) => {
      const notion = getNotion();
      let originalForMorphs: string[] = [];
      let signalSummary = "";
      let alreadyResolved = false;
      try {
        const page = await notion.pages.retrieve({ page_id });
        const props = (page as Record<string, unknown>)["properties"] as Record<string, unknown>;
        const forField = props["For"] as { type?: string; multi_select?: Array<{ name: string }> } | undefined;
        if (forField?.type === "multi_select" && forField.multi_select) {
          originalForMorphs = forField.multi_select.map(o => o.name);
        }
        const nameField = props["Name"] as { type?: string; title?: Array<{ plain_text: string }> } | undefined;
        if (nameField?.type === "title" && nameField.title) {
          signalSummary = nameField.title.map(t => t.plain_text).join("");
        }
        const resolvedField = props["Resolved"] as { type?: string; status?: { name?: string } } | undefined;
        if (resolvedField?.type === "status" && resolvedField.status?.name === "Done") {
          alreadyResolved = true;
        }
      } catch {
        // If we can't read the existing page, fall through and resolve anyway.
      }

      const { id, url } = await updatePage(page_id, { "Resolved": { status: { name: "Done" } } } as Parameters<typeof updatePage>[1]);

      const warnings: string[] = [];
      let auto_fyi_id: string | null = null;
      const isNonAddressee = originalForMorphs.length > 0 && !originalForMorphs.includes(resolved_by);
      if (isNonAddressee && !alreadyResolved) {
        if (!DB.SIGNAL_BOARD) {
          warnings.push("auto_fyi_skipped: SIGNAL_BOARD_DB_ID not set");
        } else {
          try {
            const fyiTitle = `${resolved_by} resolved: ${signalSummary || "(unnamed signal)"}`;
            const fyiMessage = `Signal originally addressed to ${originalForMorphs.join(", ")} was resolved by ${resolved_by}. Original signal: ${url}`;
            const fyi = await createPage({
              parent: { database_id: DB.SIGNAL_BOARD },
              properties: {
                "Name": { title: toRichText(fyiTitle) },
                "From": { select: { name: resolved_by } },
                "For": { multi_select: originalForMorphs.map(m => ({ name: m })) },
                "Type": { select: { name: "FYI" } },
                "Message": { rich_text: toRichText(fyiMessage) },
                "Intensity": { number: 0.5 },
                "Priority": { select: { name: "low" } },
                "Resolved": { status: { name: "Not started" } },
              } as Parameters<typeof createPage>[0]["properties"],
            });
            auto_fyi_id = fyi.id;
          } catch (err) {
            warnings.push(`auto_fyi_failed: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }

      const receipt = makeReceipt("resolve_signal", id, url, {
        resolved_by,
        original_for_morphs: originalForMorphs,
        already_resolved: alreadyResolved,
        auto_fyi_id,
        warnings,
      });
      return { content: [{ type: "text", text: JSON.stringify(receipt, null, 2) }], structuredContent: receipt };
    }
  );

  server.registerTool(
    "claudine_update_living_sync",
    {
      title: "Update Living Sync Quick Dispatch",
      description: `Write to the Quick Dispatch section of Living Sync. Contract v0.1: only the Quick Dispatch region is writable. Use for cross-morph status updates, urgent flags, or dispatching work.`,
      inputSchema: z.object({
        dispatch_content: z.string().max(2000).describe("Content for the Quick Dispatch section"),
        updated_by: z.enum(SOURCE_MORPHS),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ dispatch_content, updated_by }) => {
      const notion = getNotion();
      const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ");
      const blocks = await notion.blocks.children.list({ block_id: DB.LIVING_SYNC, page_size: 50 });
      let dispatchHeadingId: string | null = null;
      let nextSectionId: string | null = null;
      let foundDispatch = false;
      for (const block of blocks.results) {
        const b = block as Record<string, unknown>;
        const type = b["type"] as string;
        if (!foundDispatch) {
          if (type === "heading_2") {
            const h2 = b["heading_2"] as Record<string, unknown>;
            const rt = h2["rich_text"] as Array<{ plain_text: string }>;
            const text = rt?.map(t => t.plain_text).join("") ?? "";
            if (text.includes("Quick Dispatch")) { dispatchHeadingId = b["id"] as string; foundDispatch = true; }
          }
        } else {
          if (type === "divider" || type === "heading_2" || type === "heading_1") { nextSectionId = b["id"] as string; break; }
        }
      }
      if (!dispatchHeadingId) {
        return { content: [{ type: "text", text: "Could not find Quick Dispatch section in Living Sync. Contract anchor may have moved." }] };
      }
      const dispatchBlocks = await notion.blocks.children.list({ block_id: DB.LIVING_SYNC, page_size: 50 });
      const toDelete: string[] = [];
      let inDispatch = false;
      for (const block of dispatchBlocks.results) {
        const b = block as Record<string, unknown>;
        const bid = b["id"] as string;
        if (bid === dispatchHeadingId) { inDispatch = true; continue; }
        if (inDispatch) {
          if (nextSectionId && bid === nextSectionId) break;
          const type = b["type"] as string;
          if (type === "divider" || type === "heading_2" || type === "heading_1") break;
          toDelete.push(bid);
        }
      }
      for (const id of toDelete) { try { await notion.blocks.delete({ block_id: id }); } catch { /* best effort */ } }
      await notion.blocks.children.append({
        block_id: DB.LIVING_SYNC,
        after: dispatchHeadingId,
        children: [
          { object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: `Last updated: ${timestamp} by ${updated_by}` }, annotations: { italic: true } }] } },
          { object: "block", type: "paragraph", paragraph: { rich_text: toRichText(dispatch_content) } },
        ],
      });
      const receipt = makeReceipt("update_living_sync", DB.LIVING_SYNC, `https://notion.so/${DB.LIVING_SYNC.replace(/-/g, "")}`, { updated_by, timestamp, dispatch_preview: dispatch_content.slice(0, 80) });
      return { content: [{ type: "text", text: JSON.stringify(receipt, null, 2) }], structuredContent: receipt };
    }
  );

  server.registerTool(
    "claudine_resolve_id",
    {
      title: "Resolve ID",
      description: `Normalize a Notion page identifier to canonical form. Accepts raw UUIDs, full notion.so URLs, or compressed URLs. Returns both page_url and page_id. Use when you have an identifier in an unknown format and need the canonical page_id for other tool calls.`,
      inputSchema: z.object({
        id: z.string().min(8).describe("Raw UUID, full notion.so URL, or compressed URL"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ id }) => {
      let page_id = id.trim();
      const urlMatch = id.match(/notion\.so\/(?:[^/]+\/)?(?:[^/]+-)?([a-f0-9]{32})(?:\?|#|$)/i);
      if (urlMatch) { page_id = urlMatch[1]; }
      else { page_id = page_id.replace(/-/g, "").replace(/[^a-f0-9]/gi, ""); }
      if (page_id.length === 32) {
        const formatted = `${page_id.slice(0,8)}-${page_id.slice(8,12)}-${page_id.slice(12,16)}-${page_id.slice(16,20)}-${page_id.slice(20)}`;
        const page_url = `https://notion.so/${page_id}`;
        const result = { page_id: formatted, page_url, raw_input: id };
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result };
      }
      return { content: [{ type: "text", text: `Could not parse "${id}" as a Notion page ID. Expected a 32-char UUID or notion.so URL.` }] };
    }
  );
}
