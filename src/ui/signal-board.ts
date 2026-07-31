/**
 * Signal Board view for MCP Apps (SEP-1865).
 *
 * Returned verbatim as the body of the ui://claudine/signal-board-vN.html
 * resource. Single self-contained HTML5 document; the host renders it under a
 * deny-by-default CSP, so no external scripts, styles, fonts, or fetches.
 *
 * HARD-WON CONSTRAINTS, verified live in Claude 2026-07-30:
 *  - No light-dark() and no CSS custom properties. Claude's sandbox does not
 *    resolve them; the first build painted invisible text on invisible
 *    background and read as an empty container for hours. Flat hex only.
 *    Theme is switched from hostContext.theme via a class on <html>.
 *  - The resource _meta.ui.domain must equal the first 32 hex chars of
 *    SHA-256 over the exact connector URL, plus ".claudemcpcontent.com".
 *    Set in hold.ts. Not part of the SEP; Claude-specific.
 *  - Claude prefetches this once at connector-add. Editing the HTML requires
 *    bumping the resource URI AND deleting/re-adding the connector.
 *
 * Editing notes: this is a TS template literal wrapping JS. No backticks and
 * no ${...} inside the embedded script. All signal-derived text goes through
 * textContent, never innerHTML, since messages are arbitrary Notion content.
 */

export function SIGNAL_BOARD_HTML(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Signal Board</title>
<style>
  html { background:#fdfdfc; color:#1a1a18; }
  html.dark { background:#1a1a18; color:#f5f5f2; }
  * { box-sizing:border-box; }
  body { margin:0; padding:14px;
    font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
    font-size:14px; background:inherit; color:inherit; }
  header { display:flex; align-items:baseline; justify-content:space-between;
    gap:12px; padding-bottom:10px; margin-bottom:12px; border-bottom:1px solid #e5e5e1; }
  html.dark header { border-bottom-color:#33332f; }
  h1 { margin:0; font-size:14px; font-weight:600; letter-spacing:-0.01em; }
  .count { font-size:11px; color:#8a8a80; font-variant-numeric:tabular-nums; white-space:nowrap; }
  html.dark .count { color:#73736c; }
  ul { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:9px; }
  li { border:1px solid #e5e5e1; border-radius:10px; padding:11px 13px;
    background:#f7f7f5; transition:opacity 160ms ease; }
  html.dark li { border-color:#33332f; background:#242422; }
  li.busy { opacity:.45; }
  li.failed { border-color:#a8321e; }
  .row { display:flex; align-items:center; gap:7px; flex-wrap:wrap; }
  .from { font-weight:600; font-size:13px; }
  .to { font-size:11px; color:#8a8a80; }
  html.dark .to { color:#73736c; }
  .badge { font-size:11px; padding:1px 7px; border-radius:999px; font-weight:500; white-space:nowrap; }
  .t-needs-review { background:#fcf3e2; color:#8a5a12; }
  .t-conflict-detected { background:#fbeae6; color:#a8321e; }
  .t-dependency { background:#e8f1f8; color:#1f5c8a; }
  .t-FYI { background:#eeeeea; color:#5c5c56; }
  .t-pattern { background:#e7f3ec; color:#1f6b45; }
  html.dark .t-needs-review { background:#33270f; color:#e0aa5c; }
  html.dark .t-conflict-detected { background:#3a1e18; color:#f08a72; }
  html.dark .t-dependency { background:#14283a; color:#7cb8e0; }
  html.dark .t-FYI { background:#2e2e2a; color:#a3a39c; }
  html.dark .t-pattern { background:#14291d; color:#6cc294; }
  .p-high { color:#a8321e; font-weight:600; }
  .p-medium { color:#5c5c56; }
  .p-low { color:#8a8a80; }
  html.dark .p-high { color:#f08a72; }
  html.dark .p-medium { color:#a3a39c; }
  html.dark .p-low { color:#73736c; }
  .meta { margin-left:auto; font-size:11px; color:#8a8a80;
    font-variant-numeric:tabular-nums; white-space:nowrap; }
  html.dark .meta { color:#73736c; }
  .msg { margin:8px 0 0; font-size:13px; line-height:1.5; color:#5c5c56;
    white-space:pre-wrap; overflow-wrap:anywhere; }
  html.dark .msg { color:#a3a39c; }
  .msg.clamped { display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
  .actions { display:flex; gap:6px; margin-top:10px; align-items:center; flex-wrap:wrap; }
  button { font-family:inherit; font-size:11px; padding:4px 10px; border-radius:6px;
    border:1px solid #d8d8d2; background:#ffffff; color:#1a1a18; cursor:pointer; }
  html.dark button { border-color:#3d3d38; background:#2e2e2a; color:#f5f5f2; }
  button:hover:not(:disabled) { background:#efefec; }
  html.dark button:hover:not(:disabled) { background:#3a3a35; }
  button:disabled { cursor:default; opacity:.5; }
  button.link { border-color:transparent; background:transparent; color:#8a8a80; padding:4px 5px; }
  html.dark button.link { color:#73736c; }
  .rule3 { font-size:11px; color:#8a5a12; }
  html.dark .rule3 { color:#e0aa5c; }
  .state { padding:20px 4px; font-size:13px; color:#8a8a80; text-align:center; }
  html.dark .state { color:#73736c; }
  .err { margin-top:7px; font-size:11px; color:#a8321e;
    font-family:ui-monospace,Menlo,monospace; overflow-wrap:anywhere; }
  html.dark .err { color:#f08a72; }
</style>
</head>
<body>
<header><h1 id="title">Signal Board</h1><span class="count" id="count"></span></header>
<div id="root"><div class="state">Loading…</div></div>
<script>
(function () {
  "use strict";
  var pending = new Map(), handlers = new Map(), nextId = 1;
  var forMorph = null, signals = [];

  window.addEventListener("message", function (e) {
    var m = e.data;
    if (!m || m.jsonrpc !== "2.0") return;
    if (m.id !== undefined && m.method === undefined) {
      var p = pending.get(m.id); if (!p) return; pending.delete(m.id);
      if (m.error) p.reject(new Error(m.error.message || "rpc error")); else p.resolve(m.result);
      return;
    }
    if (m.method) { var h = handlers.get(m.method); if (h) h(m.params || {}, m.id); }
  });
  function request(method, params) {
    var id = nextId++;
    return new Promise(function (res, rej) {
      pending.set(id, { resolve: res, reject: rej });
      window.parent.postMessage({ jsonrpc:"2.0", id:id, method:method, params:params }, "*");
    });
  }
  function notify(m, p) { window.parent.postMessage({ jsonrpc:"2.0", method:m, params:p }, "*"); }
  function respond(id, r) { if (id !== undefined) window.parent.postMessage({ jsonrpc:"2.0", id:id, result:r }, "*"); }

  var lastH = 0;
  function size() {
    var h = Math.ceil(document.body.scrollHeight) + 4;
    if (h === lastH) return; lastH = h;
    notify("ui/notifications/size-changed", { width: 640, height: h });
  }
  if (window.ResizeObserver) new ResizeObserver(size).observe(document.body);

  function theme(ctx) {
    if (!ctx) return;
    if (ctx.theme === "dark") document.documentElement.classList.add("dark");
    else if (ctx.theme === "light") document.documentElement.classList.remove("dark");
  }

  function age(iso) {
    if (!iso) return "";
    var t = new Date(iso).getTime(); if (isNaN(t)) return "";
    var d = Math.floor((Date.now() - t) / 86400000);
    if (d < 1) return "today"; if (d === 1) return "1d";
    if (d < 400) return d + "d"; return Math.floor(d / 365) + "y";
  }
  function setState(text) {
    var r = document.getElementById("root"); r.textContent = "";
    var d = document.createElement("div"); d.className = "state"; d.textContent = text;
    r.appendChild(d); size();
  }

  function render() {
    var root = document.getElementById("root");
    document.getElementById("count").textContent = signals.length ? signals.length + " unresolved" : "";
    if (!signals.length) { setState("Nothing unresolved."); return; }
    root.textContent = "";
    var ul = document.createElement("ul");

    signals.forEach(function (s) {
      var li = document.createElement("li");
      var row = document.createElement("div"); row.className = "row";

      var f = document.createElement("span"); f.className = "from";
      f.textContent = s.from || "unknown"; row.appendChild(f);

      var forList = Array.isArray(s["for"]) ? s["for"] : [];
      var to = document.createElement("span"); to.className = "to";
      to.textContent = "\\u2192 " + (forList.length ? forList.join(", ") : "(unaddressed)");
      row.appendChild(to);

      var ty = document.createElement("span");
      ty.className = "badge t-" + (s.type || "FYI"); ty.textContent = s.type || "FYI";
      row.appendChild(ty);

      var pr = document.createElement("span");
      pr.className = "badge p-" + (s.priority || "low"); pr.textContent = s.priority || "low";
      row.appendChild(pr);

      var mt = document.createElement("span"); mt.className = "meta";
      var bits = [];
      if (typeof s.intensity === "number") bits.push(s.intensity.toFixed(2).replace(/0$/, ""));
      var a = age(s.created); if (a) bits.push(a);
      mt.textContent = bits.join("  \\u00b7  "); row.appendChild(mt);
      li.appendChild(row);

      var msg = document.createElement("p"); msg.className = "msg clamped";
      msg.textContent = s.message || ""; li.appendChild(msg);

      var acts = document.createElement("div"); acts.className = "actions";

      var rb = document.createElement("button"); rb.textContent = "Resolve";
      rb.addEventListener("click", function () { resolve(s, li, rb); });
      acts.appendChild(rb);

      var eb = document.createElement("button"); eb.className = "link"; eb.textContent = "Expand";
      eb.addEventListener("click", function () {
        var c = msg.classList.toggle("clamped");
        eb.textContent = c ? "Expand" : "Collapse"; size();
      });
      acts.appendChild(eb);

      if (s.url) {
        var ob = document.createElement("button"); ob.className = "link"; ob.textContent = "Open";
        ob.addEventListener("click", function () {
          request("ui/open-link", { url: s.url })["catch"](function () {});
        });
        acts.appendChild(ob);
      }

      if (forMorph && forList.length && forList.indexOf(forMorph) === -1) {
        var w = document.createElement("span"); w.className = "rule3";
        w.textContent = "Rule 3: not an addressee"; acts.appendChild(w);
      }

      li.appendChild(acts);
      ul.appendChild(li);
    });

    root.appendChild(ul); size();
  }

  function resolve(s, li, btn) {
    btn.disabled = true; li.classList.add("busy"); li.classList.remove("failed");
    var old = li.querySelector(".err"); if (old) old.remove();
    request("tools/call", { name:"claudine_resolve_signal",
      arguments:{ page_id: s.id, resolved_by: forMorph } })
      .then(function () {
        signals = signals.filter(function (x) { return x.id !== s.id; });
        render();
      })["catch"](function (err) {
        li.classList.remove("busy"); li.classList.add("failed"); btn.disabled = false;
        var e = document.createElement("div"); e.className = "err";
        e.textContent = String(err && err.message ? err.message : err);
        li.appendChild(e); size();
      });
  }

  handlers.set("ui/notifications/tool-input", function (p) {
    var a = p.arguments || {};
    if (a.for_morph) { forMorph = a.for_morph;
      document.getElementById("title").textContent = "Signals for " + forMorph; }
  });
  handlers.set("ui/notifications/tool-result", function (p) {
    var sc = p.structuredContent;
    if (!sc || !Array.isArray(sc.signals)) { setState("No structured result."); return; }
    if (sc.for_morph && !forMorph) { forMorph = sc.for_morph;
      document.getElementById("title").textContent = "Signals for " + forMorph; }
    signals = sc.signals.slice(); render();
  });
  handlers.set("ui/notifications/tool-cancelled", function (p) {
    setState("Cancelled" + (p.reason ? ": " + p.reason : "."));
  });
  handlers.set("ui/notifications/host-context-changed", function (p) { theme(p); });
  handlers.set("ui/resource-teardown", function (p, id) { respond(id, {}); });

  notify("ui/notifications/size-changed", { width: 640, height: 180 });
  request("ui/initialize", {
    protocolVersion: "2026-01-26",
    appCapabilities: { availableDisplayModes: ["inline"] },
    clientInfo: { name: "claudine-signal-board", version: "1.0.0" }
  }).then(function (r) {
    theme(r && r.hostContext);
    notify("ui/notifications/initialized", {});
    size();
  })["catch"](function (err) {
    setState("Could not reach host: " + String(err && err.message ? err.message : err));
  });
})();
</script>
</body>
</html>`;
}
