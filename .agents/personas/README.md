# Persona prompt fragments (Kibana Agent Factory)

This directory holds **internal** markdown rubrics for multi-perspective prompts. They are loaded by path from workflow bodies (for example the review workflow reads `.agents/personas/reviewer_*.md` and `synthesizer.md`).

**Review workflow** — The PR review agent reads each `reviewer_*.md` persona sequentially (or conceptually in parallel), applies its checklist, then uses `synthesizer.md` to produce a single public comment. Persona names and paths are not shown on the PR.

Add or edit files here when you extend reviewer concerns; keep the folder limited to fragments that workflows actually reference.
