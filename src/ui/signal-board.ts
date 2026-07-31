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
<style>
  :root {
    --color-background-primary: light-dark(#ffffff, #171717);
    --color-background-secondary: light-dark(#f7f7f5, #1f1f1f);
    --color-background-ghost: light-dark(#efefec, #262626);
    --color-text-primary: light-dark(#171717, #fafafa);
    --color-text-secondary: light-dark(#5c5c57, #a3a3a3);
    --color-text-tertiary: light-dark(#8a8a82, #737373);
    --color-border-primary: light-dark(#e0e0dc, #303030);
    --color-border-secondary: light-dark(#ebebe7, #262626);
    --color-text-danger: light-dark(#a8321e, #f08a72);
    --color-text-warning: light-dark(#8a5a12, #e0aa5c);
    --color-text-info: light-dark(#1f5c8a, #7cb8e0);
    --color-text-success: light-dark(#1f6b45, #6cc294);
    --color-background-danger: light-dark(#fbeae6, #3a1e18);
    --color-background-warning: light-dark(#fcf3e2, #33270f);
    --color-background-info: light-dark(#e8f1f8, #14283a);
    --color-background-success: light-dark(#e7f3ec, #14291d);
    --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    --font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
    --border-radius-sm: 6px;
    --border-radius-md: 10px;
    --font-text-xs-size: 11px;
    --font-text-sm-size: 13px;
    --font-text-md-size: 14px;
    color-scheme: light dark;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 12px;
    font-family: var(--font-sans);
    font-size: var(--font-text-md-size);
    color: var(--color-text-primary);
    /* DIAGNOSTIC: opaque + bordered. A view that mounts but fails to paint
       must not be indistinguishable from empty space. Revert to
       background:transparent once mounting is confirmed. */
    background: light-dark(#fffbeb, #2a2413);
    border: 2px solid light-dark(#b45309, #f59e0b);
    border-radius: 10px;
    min-height: 90px;
  }
  #diag {
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.6;
    color: light-dark(#7c2d12, #fbbf24);
    background: light-dark(#fef3c7, #3a3016);
    border-radius: 6px;
    padding: 8px 10px;
    margin-bottom: 10px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  #diag b { font-weight: 700; letter-spacing: 0.04em; }
  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 10px;
    margin-bottom: 10px;
    border-bottom: 1px solid var(--color-border-primary);
  }
  h1 {
    margin: 0;
    font-size: var(--font-text-md-size);
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .count {
    font-size: var(--font-text-xs-size);
    color: var(--color-text-tertiary);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  li {
    border: 1px solid var(--color-border-secondary);
    border-radius: var(--border-radius-md);
    padding: 10px 12px;
    background: var(--color-background-secondary);
    transition: opacity 160ms ease;
  }
  li.resolving { opacity: 0.45; }
  li.failed { border-color: var(--color-text-danger); }
  .row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .from {
    font-weight: 600;
    font-size: var(--font-text-sm-size);
  }
  .arrow { color: var(--color-text-tertiary); font-size: var(--font-text-xs-size); }
  .badge {
    font-size: var(--font-text-xs-size);
    padding: 1px 7px;
    border-radius: var(--border-radius-full, 999px);
    font-weight: 500;
    white-space: nowrap;
  }
  .t-needs-review { background: var(--color-background-warning); color: var(--color-text-warning); }
  .t-conflict-detected { background: var(--color-background-danger); color: var(--color-text-danger); }
  .t-dependency { background: var(--color-background-info); color: var(--color-text-info); }
  .t-FYI { background: var(--color-background-ghost); color: var(--color-text-secondary); }
  .t-pattern { background: var(--color-background-success); color: var(--color-text-success); }
  .p-high { color: var(--color-text-danger); font-weight: 600; }
  .p-medium { color: var(--color-text-secondary); }
  .p-low { color: var(--color-text-tertiary); }
  .meta {
    margin-left: auto;
    font-size: var(--font-text-xs-size);
    color: var(--color-text-tertiary);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .msg {
    margin: 7px 0 0;
    font-size: var(--font-text-sm-size);
    line-height: 1.5;
    color: var(--color-text-secondary);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .msg.clamped {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .actions { display: flex; gap: 6px; margin-top: 9px; align-items: center; }
  button {
    font-family: inherit;
    font-size: var(--font-text-xs-size);
    padding: 4px 10px;
    border-radius: var(--border-radius-sm);
    border: 1px solid var(--color-border-primary);
    background: var(--color-background-primary);
    color: var(--color-text-primary);
    cursor: pointer;
  }
  button:hover:not(:disabled) { background: var(--color-background-ghost); }
  button:disabled { cursor: default; opacity: 0.5; }
  button.link {
    border-color: transparent;
    background: transparent;
    color: var(--color-text-tertiary);
    padding-left: 4px;
    padding-right: 4px;
  }
  .nonaddressee {
    font-size: var(--font-text-xs-size);
    color: var(--color-text-warning);
    margin-left: 2px;
  }
  .state {
    padding: 18px 4px;
    font-size: var(--font-text-sm-size);
    color: var(--color-text-tertiary);
    text-align: center;
  }
  .err {
    margin-top: 6px;
    font-size: var(--font-text-xs-size);
    color: var(--color-text-danger);
    font-family: var(--font-mono);
    overflow-wrap: anywhere;
  }
</style>
</head>
<body>
<header>
  <h1 id="title">Signal Board</h1>
  <span class="count" id="count"></span>
</header>
<div id="diag"><b>CLAUDINE VIEW MOUNTED</b>
This box is static HTML. If you can read it, the iframe rendered.
status: script not yet executed</div>
<div id="root"><div class="state" id="state">Connecting…</div></div>

<script>
(function () {
  "use strict";

  var PROTOCOL = "2026-01-26";
  var pending = new Map();
  var handlers = new Map();
  var nextId = 1;
  var forMorph = null;
  var signals = [];

  // ---- DIAGNOSTIC -----------------------------------------------------
  var diagLines = [];
  function diag(msg) {
    diagLines.push(msg);
    var el = document.getElementById("diag");
    if (el) {
      el.textContent = "CLAUDINE VIEW MOUNTED\\n" +
        "This box is static HTML. If you can read it, the iframe rendered.\\n" +
        diagLines.join("\\n");
    }
    reportSize();
  }

  // ---- JSON-RPC over postMessage -------------------------------------
  // Written deliberately rather than using the spec's illustrative snippet,
  // which rejects on any interleaved message. Notifications and responses
  // share one channel, so they must be dispatched separately.

  window.addEventListener("message", function (event) {
    var msg = event.data;
    if (!msg || msg.jsonrpc !== "2.0") return;
    if (msg.id !== undefined && msg.method === undefined) {
      var p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message || "RPC error"));
      else p.resolve(msg.result);
      return;
    }
    if (msg.method) {
      var h = handlers.get(msg.method);
      if (h) h(msg.params || {}, msg.id);
    }
  });

  function request(method, params) {
    var id = nextId++;
    return new Promise(function (resolve, reject) {
      pending.set(id, { resolve: resolve, reject: reject });
      window.parent.postMessage({ jsonrpc: "2.0", id: id, method: method, params: params }, "*");
    });
  }
  function notify(method, params) {
    window.parent.postMessage({ jsonrpc: "2.0", method: method, params: params }, "*");
  }
  function respond(id, result) {
    if (id === undefined) return;
    window.parent.postMessage({ jsonrpc: "2.0", id: id, result: result }, "*");
  }
  function on(method, fn) { handlers.set(method, fn); }

  // ---- Theming --------------------------------------------------------

  function applyTheme(ctx) {
    if (!ctx) return;
    var vars = ctx.styles && ctx.styles.variables;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        if (vars[k]) document.documentElement.style.setProperty(k, vars[k]);
      });
    }
    if (ctx.theme) document.documentElement.style.colorScheme = ctx.theme;
    var dim = ctx.containerDimensions;
    if (dim) {
      if ("height" in dim) document.documentElement.style.height = "100vh";
      else if (dim.maxHeight) document.documentElement.style.maxHeight = dim.maxHeight + "px";
      if ("width" in dim) document.documentElement.style.width = "100vw";
      else if (dim.maxWidth) document.documentElement.style.maxWidth = dim.maxWidth + "px";
    }
  }

  // ---- Rendering ------------------------------------------------------
  // textContent everywhere. Signal messages are arbitrary Notion content and
  // must never reach innerHTML.

  function relAge(iso) {
    if (!iso) return "";
    var then = new Date(iso).getTime();
    if (isNaN(then)) return "";
    var days = Math.floor((Date.now() - then) / 86400000);
    if (days < 1) return "today";
    if (days === 1) return "1d";
    if (days < 400) return days + "d";
    return Math.floor(days / 365) + "y";
  }

  function setState(text) {
    var root = document.getElementById("root");
    root.textContent = "";
    var d = document.createElement("div");
    d.className = "state";
    d.textContent = text;
    root.appendChild(d);
  }

  function updateCount() {
    var el = document.getElementById("count");
    var n = signals.length;
    el.textContent = n === 0 ? "" : n + (n === 1 ? " unresolved" : " unresolved");
  }

  function render() {
    var root = document.getElementById("root");
    if (!signals.length) { setState("Nothing unresolved."); updateCount(); reportSize(); return; }
    root.textContent = "";
    var ul = document.createElement("ul");

    signals.forEach(function (sig) {
      var li = document.createElement("li");
      li.dataset.id = sig.id;

      var row = document.createElement("div");
      row.className = "row";

      var from = document.createElement("span");
      from.className = "from";
      from.textContent = sig.from || "unknown";
      row.appendChild(from);

      var arrow = document.createElement("span");
      arrow.className = "arrow";
      arrow.textContent = "\\u2192";
      row.appendChild(arrow);

      var forList = Array.isArray(sig["for"]) ? sig["for"] : [];
      var toEl = document.createElement("span");
      toEl.className = "arrow";
      toEl.textContent = forList.length ? forList.join(", ") : "(unaddressed)";
      row.appendChild(toEl);

      var type = document.createElement("span");
      type.className = "badge t-" + (sig.type || "FYI");
      type.textContent = sig.type || "FYI";
      row.appendChild(type);

      var prio = document.createElement("span");
      prio.className = "badge p-" + (sig.priority || "low");
      prio.textContent = sig.priority || "low";
      row.appendChild(prio);

      var meta = document.createElement("span");
      meta.className = "meta";
      var bits = [];
      if (typeof sig.intensity === "number") bits.push("int " + sig.intensity.toFixed(1));
      var age = relAge(sig.created);
      if (age) bits.push(age);
      meta.textContent = bits.join("  ");
      row.appendChild(meta);

      li.appendChild(row);

      var msg = document.createElement("p");
      msg.className = "msg clamped";
      msg.textContent = sig.message || "";
      li.appendChild(msg);

      var actions = document.createElement("div");
      actions.className = "actions";

      var resolveBtn = document.createElement("button");
      resolveBtn.textContent = "Resolve";
      resolveBtn.addEventListener("click", function () { doResolve(sig, li, resolveBtn); });
      actions.appendChild(resolveBtn);

      var moreBtn = document.createElement("button");
      moreBtn.className = "link";
      moreBtn.textContent = "Expand";
      moreBtn.addEventListener("click", function () {
        var clamped = msg.classList.toggle("clamped");
        moreBtn.textContent = clamped ? "Expand" : "Collapse";
        reportSize();
      });
      actions.appendChild(moreBtn);

      if (sig.url) {
        var openBtn = document.createElement("button");
        openBtn.className = "link";
        openBtn.textContent = "Open in Notion";
        openBtn.addEventListener("click", function () {
          request("ui/open-link", { url: sig.url })["catch"](function () {});
        });
        actions.appendChild(openBtn);
      }

      if (forMorph && forList.length && forList.indexOf(forMorph) === -1) {
        var warn = document.createElement("span");
        warn.className = "nonaddressee";
        warn.textContent = "Rule 3: not an addressee";
        actions.appendChild(warn);
      }

      li.appendChild(actions);
      ul.appendChild(li);
    });

    root.appendChild(ul);
    updateCount();
    reportSize();
  }

  function doResolve(sig, li, btn) {
    btn.disabled = true;
    li.classList.add("resolving");
    li.classList.remove("failed");
    var old = li.querySelector(".err");
    if (old) old.remove();

    request("tools/call", {
      name: "claudine_resolve_signal",
      arguments: { page_id: sig.id, resolved_by: forMorph }
    }).then(function () {
      signals = signals.filter(function (s) { return s.id !== sig.id; });
      render();
    })["catch"](function (err) {
      li.classList.remove("resolving");
      li.classList.add("failed");
      btn.disabled = false;
      var e = document.createElement("div");
      e.className = "err";
      e.textContent = String(err && err.message ? err.message : err);
      li.appendChild(e);
      reportSize();
    });
  }

  // ---- Auto-resize ----------------------------------------------------

  var lastH = 0, lastW = 0;
  function reportSize() {
    var h = Math.ceil(document.body.scrollHeight);
    var w = Math.ceil(document.body.scrollWidth);
    if (h === lastH && w === lastW) return;
    lastH = h; lastW = w;
    notify("ui/notifications/size-changed", { width: w, height: h });
  }
  if (window.ResizeObserver) {
    new ResizeObserver(function () { reportSize(); }).observe(document.body);
  }

  // ---- Lifecycle ------------------------------------------------------

  on("ui/notifications/tool-input", function (params) {
    var args = params.arguments || {};
    if (args.for_morph) {
      forMorph = args.for_morph;
      document.getElementById("title").textContent = "Signals for " + forMorph;
    }
  });

  on("ui/notifications/tool-result", function (params) {
    var sc = params.structuredContent;
    if (!sc || !Array.isArray(sc.signals)) { setState("No structured result."); return; }
    if (sc.for_morph && !forMorph) {
      forMorph = sc.for_morph;
      document.getElementById("title").textContent = "Signals for " + forMorph;
    }
    signals = sc.signals.slice();
    render();
  });

  on("ui/notifications/tool-cancelled", function (params) {
    setState("Cancelled" + (params.reason ? ": " + params.reason : "."));
  });

  on("ui/notifications/host-context-changed", function (params) { applyTheme(params); });

  on("ui/resource-teardown", function (params, id) { respond(id, {}); });

  diag("script executing, sending ui/initialize…");
  // Report a size before the handshake, in case the host is sizing the frame
  // from our notification and would otherwise leave it collapsed.
  notify("ui/notifications/size-changed", { width: 600, height: 220 });

  request("ui/initialize", {
    protocolVersion: PROTOCOL,
    appCapabilities: { availableDisplayModes: ["inline"] },
    clientInfo: { name: "claudine-signal-board", version: "0.1.0" }
  }).then(function (res) {
    var host = (res && res.hostInfo) || {};
    diag("ui/initialize OK  host=" + (host.name || "?") + " " + (host.version || ""));
    diag("displayMode=" + String(res && res.hostContext && res.hostContext.displayMode));
    applyTheme(res && res.hostContext);
    notify("ui/notifications/initialized", {});
    setState("Loading signals…");
    reportSize();
    // Phone home through the host. If this lands, the server logs it, which
    // proves the view is alive even if nothing is visible on screen.
    return request("tools/call", { name: "claudine_get_contract", arguments: {} });
  }).then(function () {
    diag("tools/call round-trip OK — view is fully live");
  })["catch"](function (err) {
    diag("FAILED: " + String(err && err.message ? err.message : err));
    setState("Could not reach host: " + String(err && err.message ? err.message : err));
  });
})();
</script>
</body>
</html>`;
}
