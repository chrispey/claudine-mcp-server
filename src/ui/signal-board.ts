/**
 * Signal Board view for MCP Apps (SEP-1865, spec 2026-01-26).
 *
 * Returned verbatim as the body of the ui://claudine/signal-board resource.
 * Must be a single self-contained HTML5 document: the host renders it under a
 * deny-by-default CSP (default-src 'none'; script-src 'self' 'unsafe-inline';
 * style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'),
 * so no external scripts, stylesheets, fonts, or network calls are possible.
 *
 * The view talks to the host with raw JSON-RPC over postMessage. No SDK is
 * bundled, which is explicitly supported by the spec and avoids adding a
 * bundler to a project whose build is plain tsc.
 *
 * Note for editors: this is a TS template literal wrapping JS. Do not use
 * backticks or ${...} inside the embedded script; use string concatenation.
 * All signal-derived text is written with textContent, never innerHTML, since
 * signal messages are arbitrary user content.
 */

export function SIGNAL_BOARD_HTML(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Signal Board</title>
</head>
<body style="margin:0;padding:0;background:#b45309;">
  <div id="banner" style="background:#b45309;color:#ffffff;font-family:monospace;font-size:14px;line-height:1.7;padding:16px;min-height:120px;">
    <div style="font-size:18px;font-weight:bold;">CLAUDINE VIEW MOUNTED</div>
    <div>Static HTML. No CSS variables, no light-dark(), no cascade.</div>
    <div>If you can read this, the sandbox paints.</div>
    <div id="log" style="margin-top:10px;color:#ffe9c7;"></div>
  </div>
<script>
(function () {
  "use strict";
  var lines = [];
  function log(m) {
    lines.push(m);
    var el = document.getElementById("log");
    if (el) el.textContent = lines.join(" | ");
    size();
  }
  var pending = new Map(), handlers = new Map(), nextId = 1;
  window.addEventListener("message", function (e) {
    var m = e.data;
    if (!m || m.jsonrpc !== "2.0") return;
    if (m.id !== undefined && m.method === undefined) {
      var p = pending.get(m.id); if (!p) return; pending.delete(m.id);
      if (m.error) p.reject(new Error(m.error.message || "rpc error")); else p.resolve(m.result);
      return;
    }
    if (m.method) { log("recv " + m.method); var h = handlers.get(m.method); if (h) h(m.params || {}, m.id); }
  });
  function request(method, params) {
    var id = nextId++;
    return new Promise(function (res, rej) {
      pending.set(id, { resolve: res, reject: rej });
      window.parent.postMessage({ jsonrpc: "2.0", id: id, method: method, params: params }, "*");
    });
  }
  function notify(method, params) {
    window.parent.postMessage({ jsonrpc: "2.0", method: method, params: params }, "*");
  }
  function respond(id, result) {
    if (id !== undefined) window.parent.postMessage({ jsonrpc: "2.0", id: id, result: result }, "*");
  }
  var lastH = 0;
  function size() {
    var h = Math.max(160, Math.ceil(document.body.scrollHeight));
    if (h === lastH) return; lastH = h;
    notify("ui/notifications/size-changed", { width: 640, height: h });
  }
  handlers.set("ui/resource-teardown", function (p, id) { respond(id, {}); });
  handlers.set("ui/notifications/tool-result", function (p) {
    var sc = p && p.structuredContent;
    log("tool-result: " + (sc && sc.signals ? sc.signals.length + " signals" : "no structuredContent"));
  });

  log("script ran");
  notify("ui/notifications/size-changed", { width: 640, height: 200 });

  request("ui/initialize", {
    protocolVersion: "2026-01-26",
    appCapabilities: { availableDisplayModes: ["inline"] },
    clientInfo: { name: "claudine-signal-board", version: "0.1.0" }
  }).then(function (r) {
    log("initialize OK host=" + ((r && r.hostInfo && r.hostInfo.name) || "?"));
    notify("ui/notifications/initialized", {});
    return request("tools/call", { name: "claudine_get_contract", arguments: {} });
  }).then(function () {
    log("tools/call OK - fully live");
  })["catch"](function (err) {
    log("ERR " + String(err && err.message ? err.message : err));
  });

  setTimeout(function () { log("t+3s alive"); }, 3000);
})();
</script>
</body>
</html>`;
}
