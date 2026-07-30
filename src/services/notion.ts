import { Client } from "@notionhq/client";
import type {
  CreatePageParameters,
  QueryDatabaseParameters,
} from "@notionhq/client/build/src/api-endpoints.js";
import { CONTRACT_VERSION } from "../constants.js";

let _client: Client | null = null;

export function getNotion(): Client {
  if (!_client) {
    const token = process.env.NOTION_TOKEN;
    if (!token) {
      throw new Error(
        "NOTION_TOKEN environment variable is not set. " +
        "Add it to your Railway service environment variables."
      );
    }
    _client = new Client({ auth: token });
  }
  return _client;
}

export interface WriteReceipt {
  [key: string]: unknown;
  success: true;
  contract_version: string;
  operation: string;
  page_id: string;
  url: string;
  written: Record<string, unknown>;
  timestamp: string;
}

export function makeReceipt(
  operation: string,
  page_id: string,
  url: string,
  written: Record<string, unknown>
): WriteReceipt {
  return {
    success: true,
    contract_version: CONTRACT_VERSION,
    operation,
    page_id,
    url,
    written,
    timestamp: new Date().toISOString(),
  };
}

const NOTION_RICH_TEXT_LIMIT = 2000;

export function toRichText(content: string): Array<{ type: "text"; text: { content: string } }> {
  if (!content) return [];
  if (content.length <= NOTION_RICH_TEXT_LIMIT) {
    return [{ type: "text", text: { content } }];
  }
  const segments: string[] = [];
  let remaining = content;
  while (remaining.length > NOTION_RICH_TEXT_LIMIT) {
    let cut = NOTION_RICH_TEXT_LIMIT;
    const slice = remaining.slice(0, NOTION_RICH_TEXT_LIMIT);
    const boundary = Math.max(slice.lastIndexOf(" "), slice.lastIndexOf("\n"));
    if (boundary > NOTION_RICH_TEXT_LIMIT - 200) cut = boundary + 1;
    segments.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut);
  }
  if (remaining) segments.push(remaining);
  return segments.map(s => ({ type: "text", text: { content: s } }));
}

export async function queryDatabase(
  database_id: string,
  filter?: QueryDatabaseParameters["filter"],
  sorts?: QueryDatabaseParameters["sorts"],
  page_size = 20
): Promise<unknown[]> {
  const notion = getNotion();
  const response = await notion.databases.query({
    database_id,
    filter,
    sorts,
    page_size,
  });
  return response.results;
}

export async function createPage(
  params: CreatePageParameters
): Promise<{ id: string; url: string }> {
  const notion = getNotion();
  const page = await notion.pages.create(params);
  return {
    id: page.id,
    url: (page as { url?: string }).url ?? `https://notion.so/${page.id.replace(/-/g, "")}`,
  };
}

export async function updatePage(
  page_id: string,
  properties: CreatePageParameters["properties"]
): Promise<{ id: string; url: string }> {
  const notion = getNotion();
  const page = await notion.pages.update({ page_id, properties });
  return {
    id: page.id,
    url: (page as { url?: string }).url ?? `https://notion.so/${page.id.replace(/-/g, "")}`,
  };
}

export function getText(page: unknown, prop: string): string {
  try {
    const properties = (page as Record<string, unknown>)["properties"] as Record<string, unknown>;
    const field = properties[prop] as Record<string, unknown>;
    if (field?.type === "title") {
      const title = field["title"] as Array<{ plain_text: string }>;
      return title.map(t => t.plain_text).join("");
    }
    if (field?.type === "rich_text") {
      const rt = field["rich_text"] as Array<{ plain_text: string }>;
      return rt.map(t => t.plain_text).join("");
    }
    return "";
  } catch {
    return "";
  }
}

export function getSelect(page: unknown, prop: string): string {
  try {
    const properties = (page as Record<string, unknown>)["properties"] as Record<string, unknown>;
    const field = properties[prop] as Record<string, unknown>;
    const select = field["select"] as { name: string } | null;
    return select?.name ?? "";
  } catch {
    return "";
  }
}

export function getStatus(page: unknown, prop: string): string {
  try {
    const properties = (page as Record<string, unknown>)["properties"] as Record<string, unknown>;
    const field = properties[prop] as Record<string, unknown>;
    if (field?.type !== "status") return "";
    const status = field["status"] as { name: string } | null;
    return status?.name ?? "";
  } catch {
    return "";
  }
}

export function getDate(page: unknown, prop: string): string {
  try {
    const properties = (page as Record<string, unknown>)["properties"] as Record<string, unknown>;
    const field = properties[prop] as Record<string, unknown>;
    const date = field["date"] as { start: string } | null;
    return date?.start ?? "";
  } catch {
    return "";
  }
}

export function getMultiSelect(page: unknown, prop: string): string[] {
  try {
    const properties = (page as Record<string, unknown>)["properties"] as Record<string, unknown>;
    const field = properties[prop] as Record<string, unknown>;
    const options = field["multi_select"] as Array<{ name: string }> | null;
    return options?.map(o => o.name) ?? [];
  } catch {
    return [];
  }
}

export function getNumber(page: unknown, prop: string): number | null {
  try {
    const properties = (page as Record<string, unknown>)["properties"] as Record<string, unknown>;
    const field = properties[prop] as Record<string, unknown>;
    const value = field["number"];
    return typeof value === "number" ? value : null;
  } catch {
    return null;
  }
}

export function getCreatedTime(page: unknown): string {
  return (page as { created_time?: string }).created_time ?? "";
}

