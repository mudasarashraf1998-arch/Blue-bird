# REA — full-history import and local setup

Source: https://github.com/morluto/rea (MIT, `rea-agents` v6.8.0)

## Repository state

`arena/87afce57-blue-bird` now contains REA's complete source **and its full
upstream history**, imported with a non-destructive merge of unrelated
histories. Nothing was rewritten: the original `977cb58 Initial commit` remains
the first parent, and the original one-line README is preserved verbatim in
[BLUEBIRD.md](BLUEBIRD.md). REA's own documentation is `README.md`.

- 5,740 upstream commits on `main`, 170 branch refs and 40 release tags fetched
  into local `refs/remotes/upstream/*` / `refs/tags/*`.
- Only this one branch is pushed to `origin`. No tags, no other branches, no
  force-push, no branch deletion, no repo-setting changes.
- The merge commit carries `[skip ci]`: upstream ships
  `.github/workflows/real-android-metadata.yml`, which fires on pushes to
  `**` branches. The skip instruction prevents untrusted upstream CI from
  running on this push without disabling Actions for the repository.

## Local, git-excluded working files

These live in the workspace but are listed in `.git/info/exclude`, so they are
**not** part of the pushed tree:

| Path | What it is |
| --- | --- |
| `rea/` | Standalone runnable clone (pinned at `046c4ce35`) with installed deps. Root tracks the newer upstream tip. |
| `tools/node24/` | Local Node.js **24.22.1**. System Node 22.22.3 is below REA's engine requirement. |
| `rea/node_modules/`, `rea/dist/` | 714 npm packages and the compiled runtime. |
| `rea-runs/` | Tiny demo JavaScript app and the Evidence REA produced from it. |

No credentials, installers, git hooks, submodule checkouts, or generated build
output are included in the commit.

## Run it

```bash
export PATH="$PWD/tools/node24/bin:$PATH"   # from /home/user/Blue-bird
cd rea                                     # the installed checkout

node scripts/rea.mjs --version             # 6.8.0
node scripts/rea.mjs --help                # full command catalog
node scripts/rea.mjs doctor                # environment report
node scripts/rea.mjs mcp doctor --format json
node scripts/rea.mjs mcp                   # stdio MCP server for an agent

# Static JavaScript/Electron analysis (no native engine needed):
node scripts/rea.mjs analyze-javascript-application /absolute/path/to/app \
  --detail summary --evidence_output /absolute/path/to/evidence.json --format json

npm run build                              # rebuild dist/
npx vitest run src/domain/absoluteAnalysisInputPaths.test.ts --project domain
```

To run from the repository root instead, `npm ci && npm run build` there first
(the root has the source and history, but not the installed dependencies).
Fetch upstream updates with `git fetch upstream`; submodules are intentionally
left uninitialized (`git submodule update --init --recursive` only if needed).

## Verified here

- `npm ci` — succeeded (714 packages, 17s); `npm run build` — 3/3 turbo tasks
  successful (~16s).
- `rea --version` → `6.8.0`; `rea --help` lists the full command catalog.
- `rea mcp doctor` → **healthy: true**, protocol `2025-11-25`,
  229/229 tools and 6/6 prompts, identity digest matches. A raw stdio
  `initialize` handshake also returned `rea@6.8.0`.
- Real analysis of `rea-runs/demo-app`: 3 relevant files, 2 JS sources, 125 AST
  nodes, 4 findings, complete syntax coverage, 212 KB Evidence bundle
  (`rea-runs/demo-evidence.json`), summary (`rea-runs/demo-summary.json`).
- Smoke test: `src/domain/absoluteAnalysisInputPaths.test.ts` — 8/8 passed.

## Known limits

- `rea doctor` reports overall `healthy: false`: optional native analysis
  engines (Hopper, Ghidra, IDA, JADX, Kuna) are not installed and no agent
  skill is registered. Static JavaScript/Electron analysis works without them.
- The five `third_party/` submodules are recorded as gitlinks but not checked
  out; nothing external was fetched or executed.
- REA pins npm 11.16.0; sandbox npm 10.9.8 with Node 24.22.1 installed and
  built the project successfully.
- This is a local copy of an upstream project, not an official REA release.
  Upstream LICENSE and attribution are retained; the upstream README warns
  that similarly named repositories are not official sources.
