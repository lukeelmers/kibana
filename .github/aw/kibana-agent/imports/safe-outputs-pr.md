---
description: Shared POC fragment — safe outputs for PR creation and related rules.
---

## Safe outputs — pull requests

- Opening or updating a PR from agent work must go through the **`create_pull_request`** safe output — never push or mutate remotes directly from agent steps.
- Draft PRs target the configured **base branch** (`poc/agent-factory` for execute). Limits (`max`) and **protected-files** behavior come from workflow frontmatter; if a change touches protected paths, follow the configured fallback (e.g. report via issue) rather than forcing the mutation.
