import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerReceiveTools } from "./tools/receive.js";
import { registerHoldTools } from "./tools/hold.js";
import { registerPatternTools } from "./tools/pattern.js";
import { registerReflectTools } from "./tools/reflect.js";
import http from "http";

const UI_EXTENSION_ID = "io.modelcontextprotocol/ui";
const UI_MIME_TYPE = "text/html;profile=mcp-app";

function createServer(): McpServer {
  const server = new McpServer(
    { name: "claudine-mcp-server", version: "0.1.0" },
    {
      // Extension capability negotiation is two-sided. The client advertises
      // io.modelcontextprotocol/ui in its initialize request; without the
      // server declaring it back, the extension is never negotiated and the
      // host has no reason to render a view.
      capabilities: {
        extensions: { [UI_EXTENSION_ID]: { mimeTypes: [UI_MIME_TYPE] } },
      },
    }
  );
  registerReceiveTools(server);
  registerHoldTools(server);
  registerPatternTools(server);
  registerReflectTools(server);
  return server;
}

async function runStdio(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("Claudine MCP server running (stdio)\n");
}

/** Read and JSON-parse the request body. The stream is consumed here, so the
 *  parsed value must be handed to transport.handleRequest as its third arg. */
async function readBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return undefined;
  try { return JSON.parse(raw); } catch { return undefined; }
}

async function runHttp(): Promise<void> {
  const port = parseInt(process.env.PORT ?? "3000", 10);
  const HEALTH = JSON.stringify({ name: "claudine-mcp-server", version: "0.1.0", status: "ok" });
  const NOT_FOUND = JSON.stringify({ error: "not_found" });

  const httpServer = http.createServer(async (req, res) => {
    const path = (req.url ?? "/").split("?")[0];

    if (req.method === "GET") {
      // Only these three paths answer 200. Everything else MUST 404.
      //
      // A catch-all 200 here is what breaks connector sign-in: a client probing
      // /.well-known/oauth-protected-resource or /.well-known/oauth-authorization-server
      // reads any 200 as "this server publishes auth metadata", then attempts
      // dynamic client registration and fails, because there is no OAuth here.
      // A 404 is how a client learns this server needs no auth at all.
      //
      // /mcp must stay 200: railway.json sets it as healthcheckPath.
      if (path === "/" || path === "/health" || path === "/mcp") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(HEALTH);
        return;
      }
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(NOT_FOUND);
      return;
    }

    if (req.method !== "POST") { res.writeHead(405); res.end("Method not allowed"); return; }

    // Only these paths carry MCP traffic, so a POST to /register is not
    // mistaken for an MCP request and answered as though it succeeded.
    if (path !== "/mcp" && path !== "/") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(NOT_FOUND);
      return;
    }

    const body = await readBody(req);

    // ---- TEMPORARY DIAGNOSTIC ----------------------------------------
    // Logs the client's initialize handshake so we can see whether it
    // advertises the MCP Apps extension "io.modelcontextprotocol/ui".
    // If that key is absent from capabilities.extensions, the client never
    // claimed UI support and no amount of server-side correctness will make
    // a view render. Remove this block once the question is answered.
    if (body && typeof body === "object") {
      const b = body as { method?: string; params?: Record<string, unknown> };
      const params = b.params ?? {};
      if (b.method === "initialize") {
        process.stderr.write("[client-handshake] " + JSON.stringify({
          protocolVersion: params["protocolVersion"],
          clientInfo: params["clientInfo"],
          capabilities: params["capabilities"],
        }) + "\n");
      } else {
        // Every other method, so a view-originated tools/call is visible here
        // even when nothing renders on screen.
        process.stderr.write("[rpc] " + b.method + (b.method === "tools/call"
          ? " name=" + String(params["name"]) : "") + "\n");
      }
    }
    // ---- END TEMPORARY DIAGNOSTIC ------------------------------------

    const server = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  });
  httpServer.listen(port, () => {
    process.stderr.write(`Claudine MCP server running (http) on port ${port}\n`);
  });
}

const transport = process.env.TRANSPORT ?? "stdio";
if (transport === "http") {
  runHttp().catch(error => { process.stderr.write(`Fatal error: ${error}\n`); process.exit(1); });
} else {
  runStdio().catch(error => { process.stderr.write(`Fatal error: ${error}\n`); process.exit(1); });
}
