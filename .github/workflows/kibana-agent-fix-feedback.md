---
name: Kibana Agent Fix Feedback
description: POC stub — respond to review or bot feedback on a PR (scaffold only).
on:
  workflow_dispatch:
  pull_request_review_comment:
    types: [created]

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
  - .github/aw/kibana-agent/imports/factory-network.md
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

# Kibana Agent — fix feedback (POC stub)

Placeholder for addressing inline review feedback via safe outputs.
