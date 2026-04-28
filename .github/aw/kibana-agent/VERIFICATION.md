# M1.f — Verification: safe outputs, firewall, LiteLLM / cost visibility

This note records what we verified on the **fork** `lukeelmers/kibana` using live workflow runs and a read-through of factory workflow sources. It is intentionally narrow: evidence from runs, configuration as written, and gaps for humans before an end-to-end factory loop.

## 1. Safe outputs

### 1.1 Configured safe outputs (by workflow source)

All seven gh-aw entry workflows under `.github/workflows/kibana-agent-*.md` share:

- `safe-outputs.activation-comments: false` — no automatic activation comment (intentional for the POC).
- `safe-outputs.report-failure-as-issue: false` — failures do not open a tracking issue (intentional for the POC).
- `safe-outputs.threat-detection.enabled: true` on every workflow — AI output is scanned before write-capable safe outputs run (see `common.md`).

**Write-capable keys in frontmatter (branch `poc/agent-factory` as merged on this fork):** every workflow below declares **only** `add-comment` today — same shape on all seven: `max: 1`, `target: "*"`, `hide-older-comments: true`.

- `kibana-agent-spec-draft.md`
- `kibana-agent-spec-refine.md`
- `kibana-agent-review.md`
- `kibana-agent-fix-feedback.md`
- `kibana-agent-ci-fix-loop.md`
- `kibana-agent-execute.md`

Shared fragment **`safe-outputs-pr.md`** states that opening/updating a PR must use the **`create_pull_request`** safe output once the execute workflow is wired for real work. **`create-pull-request`** and **`push-to-pull-request-branch`** are **not** present yet in the YAML `safe-outputs:` blocks on `poc/agent-factory`; expect them when **M1.d** (execute) and **M1.e** (review) land, then re-verify in CI.

### 1.2 Live run evidence — `add-comment`

**Run:** `Kibana Agent Review`, database id `25066628610`, conclusion `success` (pull_request on branch `poc/m1-b-agent-factory-scaffold`).

- The `safe_outputs` job completed successfully after `detection`, indicating safe-output processing ran end-to-end for that activation.
- In practice this run posted a **PR review comment** via the safe-output path (observed on the triggering PR).

### 1.3 Not yet configured or exercised (PR mutation path)

- **`create-pull-request`** — not declared in execute workflow frontmatter on `poc/agent-factory` yet; stub body still points at a later milestone. When added (M1.d), validate with fork PR permissions (§4).
- **`push-to-pull-request-branch`** — not declared on `poc/agent-factory` yet; when added (M1.e), validate with a review run that applies patch-style outputs.

Threat-detection ran in the successful review run (`detection` job succeeded before `safe_outputs`).

## 2. Network firewall

### 2.1 Declared egress allowlist

Source: `.github/aw/kibana-agent/imports/factory-network.md` — `network.allowed`:

- `defaults`
- `buildkite.com`, `*.buildkite.com` (CI log / Buildkite access from tooling)
- `github.com`, `api.github.com`
- `anthropic.com`, `api.anthropic.com`
- **`elastic.litellm-prod.ai`** (LiteLLM gateway)
- `elastic.co`, `*.elastic.co`, `elastic.dev`, `*.elastic.dev`

### 2.2 Live run evidence

**Successful run `25066628610`:**

- Activation metadata included **`GH_AW_INFO_FIREWALL_TYPE: squid`** and **`elastic.litellm-prod.ai`** in `GH_AW_INFO_ALLOWED_DOMAINS` / merged `GH_AW_ALLOWED_DOMAINS`.
- Agent job ran **`Print firewall logs`**; Squid / API proxy / CLI proxy log paths were emitted (standard gh-aw firewall wiring). The agent step completed after ~8 minutes inside the sandbox.

**Contrast — failed run `25065352657` (same workflow name, earlier attempt):**

- The `agent` job failed at **Execute Claude Code CLI** with exit code 1; **`detection`** and **`safe_outputs`** were **skipped**.
- The compiled `awf --allow-domains` list in the log **did not** include `elastic.litellm-prod.ai` (it appeared between `elastic.dev` and `files.pythonhosted.org` without the LiteLLM host). The successful run’s allowlist **does** include that host.
- stderr/summary showed Claude **`authentication_failed`** / “Invalid API key · Fix external API key”. That message may aggregate several upstream failures; together with the missing allowlist entry, the practical fix was aligning **`factory-network.md`** and recompiling so the LiteLLM host is permitted.

### 2.3 Future milestones

If new tools need additional hostnames, add them once in `factory-network.md`, run `gh aw compile`, and commit lockfiles. `*.buildkite.com` is already present for CI log access patterns.

## 3. LiteLLM configuration and cost visibility

### 3.1 Fork wiring (as configured)

- **Secret:** `ANTHROPIC_API_KEY` — LiteLLM-issued key (not a direct Anthropic consumer key), per `engine-provider.md`.
- **Base URL:** `ANTHROPIC_BASE_URL: https://elastic.litellm-prod.ai` on each workflow `engine.env`.
- **Model:** `llm-gateway/claude-opus-4-6` (LiteLLM `llm-gateway/` prefix).

### 3.2 Cost / usage visibility in GitHub

- gh-aw surfaces **Effective Tokens** in run output. For run **`25066628610`**, the agent job logged `Effective tokens: 159071` (~**159.1K** ET) and set `GH_AW_EFFECTIVE_TOKENS` before printing firewall logs.
- The **`GH_AW_MODEL_MULTIPLIERS`** embedded in the workflow includes **`claude-opus-4.6`: 5.0** (same family as other Opus entries), per gh-aw Effective Tokens computation.

### 3.3 Org-level spend

LiteLLM’s own dashboards and quotas are **outside** this fork; fork-level visibility is the GitHub Actions run metadata above plus whatever the key issuer exposes.

## 4. Human prerequisites (blocking full end-to-end)

1. **GitHub App or machine user** — `kibana-agent` is a placeholder. Real bot identity is needed for consistent comments, assignments, and triggers; maintainer-owned.
2. **Repository secrets** — `ANTHROPIC_API_KEY` is the LLM secret required today; gh-aw also expects the usual `GITHUB_TOKEN` / gh-aw GitHub MCP tokens as generated by the runner (see lockfile manifest).
3. **Workflow permissions** — Fork setting **“Allow GitHub Actions to create and approve pull requests”** must be on for **`create-pull-request`** safe output to open PRs.
4. **First full loop** — After M1.d lands, run **`workflow_dispatch`** on `kibana-agent-execute` (or the designed trigger) once to validate issue → acknowledgment → PR with safe outputs.

## 5. Known gaps (from this verification)

- **`activation-comments: false`** — by design for the POC; no auto “workflow started” noise.
- **`report-failure-as-issue: false`** — failures stay in the Actions UI unless humans triage.
- **Partial pipeline on agent failure** — if the `agent` job fails, **`detection`** / **`safe_outputs`** may never run (seen in `25065352657`).
- **Lockfile manifest nuance** — compiled `gh-aw-manifest` lists **`ghcr.io/github/gh-aw-mcpg:v0.3.0`** and **`ghcr.io/github/github-mcp-server:v1.0.2`** without digests while firewall and `node` images are digest-pinned; download steps still pull named tags. See §6.

## 6. Lockfile spot-check (`kibana-agent-review.lock.yml`)

Verified from the generated lockfile header/manifest (no edits made):

- **GitHub Actions** referenced with **full commit SHAs** (e.g. `actions/checkout@de0fac2…`, `github/gh-aw-actions/setup@239aec4…`).
- **Firewall images** (`gh-aw-firewall/agent`, `api-proxy`, `squid`) and **`node:lts-alpine`** include **digests** in the manifest and in `download_docker_images.sh` invocations.
- **Secrets** listed in manifest: `ANTHROPIC_API_KEY`, `GH_AW_GITHUB_MCP_SERVER_TOKEN`, `GH_AW_GITHUB_TOKEN`, `GITHUB_TOKEN`.
- **Anomaly:** MCP gateway and GitHub MCP server images are **tag-only** in the manifest / download line; everything else critical is pinned by digest. Acceptable for current gh-aw output but slightly asymmetric.

---

*Evidence snapshot: successful review run id `25066628610`; failed comparison run id `25065352657`. Both on `lukeelmers/kibana`.*
