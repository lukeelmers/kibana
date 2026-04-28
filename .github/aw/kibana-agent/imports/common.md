---
description: Shared POC fragment — common kibana-agent factory rules (stub).
---

## Common (stub)

- Use the placeholder agent handle **kibana-agent** where assignment or mention semantics apply. This POC branch does not configure a real bot user.
- Shared LLM provider notes and a **multi-provider registry** live in **`engine-provider.md`** (imported by each workflow). Keep `engine.version` / `engine.model` aligned with that registry when you switch providers.
- Shared **egress allowlist** (`network.allowed`) lives in **`factory-network.md`**; import it from every entry workflow so domains stay in one place.
- **`safe-outputs.threat-detection.enabled: true`** is required for factory workflows so AI output is scanned before any write-capable safe output runs (uses the same Claude engine as the agent unless overridden per safe-output type).
- Expand this fragment with cross-cutting factory rules in a later milestone.
