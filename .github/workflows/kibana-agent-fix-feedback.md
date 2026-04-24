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
  - .github/aw/kibana-agent/imports/lite-llm.md
  - .github/aw/kibana-agent/imports/network-execution.md
  - .github/aw/kibana-agent/imports/network-review.md
  - .github/aw/kibana-agent/imports/safe-outputs-pr.md
  - .github/aw/kibana-agent/imports/safe-outputs-comment.md

engine:
  id: codex
  version: '0.104.0'
  model: llm-gateway/gpt-5.4
  env:
    CODEX_API_KEY: ${{ steps.mint_litellm_token.outputs.api_key || 'gh-aw-activation-placeholder' }}
    OPENAI_API_KEY: ${{ steps.mint_litellm_token.outputs.api_key || 'gh-aw-activation-placeholder' }}
    OPENAI_BASE_URL: https://elastic.litellm-prod.ai/v1
    RUST_LOG: warn

steps:
  - name: Mint LiteLLM token
    id: mint_litellm_token
    uses: elastic/github-actions/litellm-token@v3
    with:
      base-url: https://elastic.litellm-prod.ai
      master-key: ${{ secrets.LITELLM_API_KEY }}
      models: llm-gateway/gpt-5.4
      key-ttl: 30m
      max-budget: '5'
  - name: Validate LiteLLM token was minted
    run: test -n "$LITELLM_API_KEY"
    env:
      LITELLM_API_KEY: ${{ steps.mint_litellm_token.outputs.api_key }}

post-steps:
  - name: Revoke LiteLLM token
    if: ${{ always() && steps.mint_litellm_token.outputs.api_key != '' }}
    uses: elastic/github-actions/litellm-token@v3
    with:
      operation: revoke
      base-url: https://elastic.litellm-prod.ai
      master-key: ${{ secrets.LITELLM_API_KEY }}
      api-key: ${{ steps.mint_litellm_token.outputs.api_key }}

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
    - ci-stats.kibana.dev
    - github.com
    - api.github.com
    - chatgpt.com
    - elastic.litellm-prod.ai
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

# Kibana Agent — fix feedback (POC stub)

Placeholder for addressing inline review feedback via safe outputs.
