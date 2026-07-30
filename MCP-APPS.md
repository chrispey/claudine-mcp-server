# Signal Board MCP App

Adds an interactive Signal Board view to `claudine_get_signals`, per MCP Apps
(SEP-1865, spec 2026-01-26). Built and verified 2026-07-30.

## What changed

| File | Change |
|---|---|
| `src/ui/signal-board.ts` | **New.** The view, as a self-contained HTML document returned from a TS template literal. |
| `src/tools/hold.ts` | `claudine_get_signals` now registers via `registerAppTool` with `_meta.ui.resourceUri`, returns four extra fields, and echoes `for_morph`. New `signal_board_view` resource registered alongside. |
| `src/services/notion.ts` | Added `getMultiSelect`, `getNumber`, `getCreatedTime`. |
| `package.json` | Added `@modelcontextprotocol/ext-apps ^1.7.5`. Declared `engines.node >=20`. |

Nothing else moves. No Notion schema change, no contract change, no protocol
migration, no new build tooling. Build stays `tsc`.

## Verified, not assumed

Run against a real install (sdk 1.30.0, ext-apps 1.7.5, zod 3.25.76, node 22.22.2):

- `tsc` compiles clean, zero errors.
- Server capabilities now advertise `resources: { listChanged: true }` alongside
  `tools`. This appears automatically from registering the resource, which
  resolves the open question about whether per-request `createServer()`
  construction would break resource registration. It does not.
- `tools/list` returns `claudine_get_signals` with
  `_meta.ui = { resourceUri: "ui://claudine/signal-board", visibility: ["model","app"] }`.
  ext-apps additionally emits the deprecated flat `_meta["ui/resourceUri"]`, so
  hosts that only read the old key still work.
- `resources/list` returns the view with mimeType exactly
  `text/html;profile=mcp-app`.
- `resources/read` returns ~15KB of HTML with `_meta.ui.prefersBorder`.
- The embedded view JavaScript parses cleanly and contains no external script or
  stylesheet references, no `fetch`, no `XMLHttpRequest`, and no `innerHTML`
  usage, so it satisfies the host's deny-by-default CSP with no `ui.csp` block
  needed.

## Design decisions worth knowing

**No capability gating.** The spec suggests checking `getUiCapability()` before
registering UI-enabled tools. Claudine cannot: `index.ts` builds a fresh
`McpServer` per HTTP request and registers everything inside `createServer()`,
before the transport connects, so client capabilities are unknowable at
registration time. Unconditional registration is safe because a host without
MCP Apps support ignores `_meta.ui` and the tool degrades to its normal text
output, which is still fully populated.

**No SDK in the view.** The spec explicitly permits raw JSON-RPC over
postMessage. Bundling the ext-apps `App` class would require adding Vite to a
project whose build is one `tsc` invocation. The view implements the protocol
directly in about 90 lines.

The JSON-RPC dispatcher is deliberately not the snippet from the spec's
Transport Layer section: that example rejects its promise on any message whose
id does not match, which breaks the moment a notification interleaves with a
pending request, and notifications are how all tool data arrives. This
implementation routes responses and notifications separately.

**textContent, never innerHTML.** Signal messages are arbitrary content pulled
from Notion. Every string that reaches the DOM goes through `textContent`.

**Rule 3 is surfaced, not enforced.** When the viewing morph is not in a
signal's `for` list, the card shows a "Rule 3: not an addressee" marker. It does
not block resolution and does not collect a routing choice, because
`claudine_resolve_signal` cannot yet accept one. That is phase 2, gated on the
Signal Board fields currently with La Fondation.

Resolving through the view calls `claudine_resolve_signal`, which already writes
the `Resolved` status correctly and already emits the Rule 3 auto-FYI. So this
closes the ergonomic gap that produced 84 signals "resolved" in Reply prose with
the status field never written.

## Deploying

```
npm install
npm run build
railway up
```

`TRANSPORT=http` is already set on the service. No new environment variables.

## Not yet verified

The view has been validated structurally and its protocol handling reviewed, but
it has not been rendered in a live host. First render is the real test. Things
to watch: theme variable application, auto-resize behaviour on long messages,
and whether the host proxies the `tools/call` from the view without additional
consent friction.
