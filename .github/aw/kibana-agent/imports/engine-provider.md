---
description: LLM provider registry and fork secret wiring (Anthropic default; expandable).
---

## Provider registry

Forks configure **standard GitHub Actions repository secrets** (Settings → Secrets and variables → Actions, or `gh aw secrets set`). Each workflow's **`engine`** block must match one row: same `engine.id`, secrets, optional base URL env, and **`network.allowed`** hosts.

| Provider | `engine.id` | Required secret(s) | Optional `engine.env` | Extra `network.allowed` (in addition to `defaults` and your tool hosts) |
|----------|---------------|-------------------|------------------------|---------------------------------------------------------------------------|
| **Anthropic (Claude) via LiteLLM** — **current default** | `claude` | `ANTHROPIC_API_KEY` (LiteLLM key) | `ANTHROPIC_BASE_URL` (LiteLLM endpoint) | `anthropic.com`, `api.anthropic.com`, `elastic.litellm-prod.ai` |
| OpenAI (Codex) | `codex` | `OPENAI_API_KEY` and/or `CODEX_API_KEY` | `OPENAI_BASE_URL` for Azure or custom routers | `api.openai.com`, `openai.com`, plus any custom router hostname |
| GitHub Copilot | `copilot` | `COPILOT_GITHUB_TOKEN` | `GITHUB_COPILOT_BASE_URL` for custom Copilot endpoints | Match gh-aw Copilot / enterprise endpoint guidance |
| Google Gemini | `gemini` | `GEMINI_API_KEY` | `GEMINI_API_BASE_URL` if applicable | Match gh-aw Gemini network guidance |

## Switching providers later

1. In **each** `.github/workflows/kibana-agent-*.md` source, replace the **`engine:`** block (`id`, `version`, `model`, `env`) so it matches the chosen row.
2. Align **`network.allowed`** with that row's egress needs (and any `engine.api-target` / base URL hostnames).
3. Run **`gh aw compile`** and commit the generated **`.lock.yml`** files.

Do not hand-edit lockfiles.

## Current default

This branch routes Claude requests through Elastic's LiteLLM proxy (`elastic.litellm-prod.ai`). The repository secret **`ANTHROPIC_API_KEY`** holds a LiteLLM-issued key (not a direct Anthropic key). Models use the `llm-gateway/` prefix required by LiteLLM (e.g. `llm-gateway/claude-opus-4-6`).

Each workflow sets `ANTHROPIC_BASE_URL` in its engine env to the LiteLLM endpoint. The LiteLLM hostname is included in **`factory-network.md`** so egress is allowed through the firewall.

Shared outbound domains for all factory workflows are centralized in **`factory-network.md`** (imported after this file). When you add a provider-specific API hostname, update that file once, then `gh aw compile`.
