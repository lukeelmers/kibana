---
description: Shared egress allowlist for kibana-agent gh-aw workflows (import only; no on trigger).
network:
  allowed:
    - defaults
    - buildkite.com
    - "*.buildkite.com"
    - github.com
    - api.github.com
    - anthropic.com
    - api.anthropic.com
    - elastic.co
    - "*.elastic.co"
    - elastic.dev
    - "*.elastic.dev"
---

Import-only fragment: declare only **`network.allowed`** / **`network.blocked`** (gh-aw 0.71+). Do not set **`firewall`** here; it belongs on the entry workflow if needed.
