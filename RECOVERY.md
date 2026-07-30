# Recovery note

This tree was reconstructed on 2026-07-30 by reading the deployed container
filesystem of the Railway service `rare-growth` (project `claudine-mcp`,
environment `production`, us-west2) via the Railway agent's read-only
`readContainerFileTool`.

It was NOT recovered from a git repository, because none exists. The service
has no GitHub repo connected: Railway's Settings > Source shows unconnected
"Connect Repo" / "Connect Image" buttons, and the Root Directory hint refers to
CLI deploys. The server was pushed with `railway up` from a local folder.

## Provenance and fidelity

Source files were taken from the raw tool output rather than the agent's
rendered markdown. That mattered twice:

- `hold.ts` came back in the rendered view with its indentation collapsed to
  single spaces. Original two-space indentation is restored here from raw.
- `reflect.ts` came back in the rendered view with a space injected into the
  regex in `claudine_resolve_id`, producing
  `/notion\.so\/(?:[^/]+\/)? (?:[^/]+-)?.../` which would not match. The raw
  form has no space and is what is written here.

Line endings in the container were mostly CRLF, with a couple of LF lines in
`constants.ts`. This tree is normalized to LF throughout. Content is unchanged.

`src/schemas/` existed in the container as an empty directory. A `.gitkeep`
preserves it.

## Timestamps observed in the container

- `src/index.ts` last modified 2026-04-05
- `src/tools/*` and `src/services/*` last modified 2026-05-02
- `dist/` and `node_modules/` built 2026-05-18 (last deploy)

## Known issues carried over, not fixed here

This is a faithful copy. The following were observed and deliberately left
alone so the first commit represents the deployed state:

1. `TASK_DOMAINS` is exported from `constants.ts` and never imported. The task
   domain enum is hardcoded inline in four places across `receive.ts` and
   `hold.ts` instead. Same for `TASK_STATUS`, `TASK_PRIORITY`, `TASK_TRIAGE`,
   and `CHARACTER_LIMIT`, all exported and unused.
2. `SOURCE_MORPHS` includes `Brunch Babies`, which a documentation audit
   retired, and omits `Fesh` and `Photeque`, which exist on the Signal Board.
   Two morphs on the board cannot be addressed by the server.
3. `railway.json` specifies `NIXPACKS`. The live service config reports
   `RAILPACK`. The committed file and the service setting have drifted.
4. `pattern.ts` is written on compressed single lines while every other tool
   file is normally formatted.
5. `claudine_resolve_signal` writes `Resolved` and emits an auto-FYI, but never
   writes `Reply`, never persists `resolved_by` to the row (it appears only in
   the receipt and in the FYI's prose), and never sets `External Signal ID` on
   the FYI it creates, so a retry would duplicate it.

## First commit

    git init
    git add -A
    git commit -m "Recover deployed source from Railway container, 2026-07-30"

Then create a private GitHub repo and connect it in Railway under
Settings > Source, so future deploys have history and rollback.
