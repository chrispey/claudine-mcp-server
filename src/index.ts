import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerReceiveTools } from "./tools/receive.js";
import { registerHoldTools } from "./tools/hold.js";
import { registerPatternTools } from "./tools/pattern.js";
import { registerReflectTools } from "./tools/reflect.js";
import http from "http";

function createServer(): McpServer {
  const server = new McpServer({ name: "claudine-mcp-server", version: "0.1.0" });
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

async function runHttp(): Promise<void> {
  const port = parseInt(process.env.PORT ?? "3000", 10);
  const httpServer = http.createServer(async (req, res) => {
    if (req.url === "/" || req.url === "/health") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ name: "claudine-mcp-server", version: "0.1.0", status: "ok" })); return; }
    if (req.method === "GET") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ name: "claudine-mcp-server", version: "0.1.0", status: "ok" })); return; }
    if (req.method !== "POST") { res.writeHead(405); res.end("Method not allowed"); return; }
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res);
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
