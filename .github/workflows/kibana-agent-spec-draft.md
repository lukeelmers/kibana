---
name: Kibana Agent Spec Draft
description: POC stub — draft structured spec for agent-factory issues (scaffold only).
on:
  workflow_dispatch:
  issues:
    types: [opened, labeled, assigned]

permissions:
  contents: read
  issues: read
  pull-requests: read
  actions: read
  checks: read
  models: read

imports:
  - .github/aw/kibana-agent/imports/common.md
  - .github/aw/kibana-agent/imports/trusted-user-gating.md
  - .github/aw/kibana-agent/imports/comment-routing.md
  - .github/aw/kibana-agent/imports/engine-provider.md
  - .github/aw/kibana-agent/imports/network-execution.md
  - .github/aw/kibana-agent/imports/network-review.md
  - .github/aw/kibana-agent/imports/safe-outputs-pr.md
  - .github/aw/kibana-agent/imports/safe-outputs-comment.md

engine:
  id: claude
  version: "2.1.70"
  model: claude-opus-4-6
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

tools:
  github:
    toolsets: [default, actions, search]
  web-fetch:
  bash: true

network:
  allowed:
    - defaults
    - buildkite.com
    - "*.buildkite.com"
    - github.com
    - api.github.com
    - anthropic.com
    - api.anthropic.com
  firewall: true

safe-outputs:
  activation-comments: false
  report-failure-as-issue: false
  threat-detection:
    engine: false
  add-comment:
    max: 1
    target: "*"
    hide-older-comments: true

strict: true
timeout-minutes: 20
---

# Kibana Agent — spec draft (POC stub)

No-op instructions scaffold: read the triggering issue, apply imported fragments, and post a single short acknowledgment comment when wired to real safe-output behavior in a later milestone.

Triggering assignment to **kibana-agent** is the intended future gate; this stub does not enforce it in `if`.
