# Nightshift investigations

An example of an app Elastic builds: the Nightshift investigations page, made of the primitives the
Nightshift plugin registers, with a flyout per investigation that creates a case, checks a source IP
or opens its chat.

```
manifest.yml
img/icon.svg
kibana/custom_app/investigations.json                 the app, shown in the navigation
kibana/workflow/nightshift-app-sync.yml               copies investigations into an index ES|QL reads
kibana/workflow/nightshift-app-create-case.yml        opens a case from an investigation
kibana/workflow/nightshift-app-check-ip.yml           checks an IP with the oob_connectors AbuseIPDB type
kibana/skill/nightshift-sources-management/SKILL.md   replaces the built-in skill's text
```

The skill's id matches the built-in skill, so its text replaces the built-in's until the package
is uninstalled. The built-in's tools are kept.
