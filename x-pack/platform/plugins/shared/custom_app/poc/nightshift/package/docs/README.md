# Nightshift investigations

Installs the Nightshift investigations custom app and the 2 workflows it uses
(`nightshift-app-sync` and `nightshift-app-create-case`). Workflows are installed enabled.

It also ships the `nightshift-sources-management` Agent Builder skill
(`kibana/skill/nightshift-sources-management/SKILL.md`). Its id matches the built-in skill, so
its text replaces the built-in's until the package is uninstalled. The built-in's tools are kept.
