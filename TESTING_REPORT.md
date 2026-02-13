# Dashboards API & Terraform Provider Testing Report

**Date**: 2026-02-13
**Kibana Version**: 9.4.0-SNAPSHOT (local dev, branch `main`)
**Terraform Provider**: `terraform-provider-elasticstack` (built from `main`)
**Terraform**: v1.9.8

---

## 1. API Testing Results

### Summary: 42 passed, 4 failed out of 46 tests

### CRUD Operations (all passed)

| Test | Result |
|------|--------|
| CREATE: minimal (title only) | PASS |
| CREATE: specific ID | PASS |
| CREATE: Markdown panel | PASS |
| CREATE: Lens XY (bar_stacked) | PASS |
| CREATE: Lens Metric | **FAIL** |
| CREATE: multiple panels | PASS |
| CREATE: all optional fields (description, time_range, query, options) | PASS |
| CREATE: duplicate ID → 409 | PASS |
| CREATE: missing title → 400 | PASS |
| CREATE: invalid panels (object instead of array) → 400 | PASS |
| READ: existing dashboard | PASS |
| READ: non-existent → 404 | PASS |
| READ: Lens XY round-trip (config structure preserved) | PASS |
| UPDATE: basic title change | PASS |
| UPDATE: non-existent → 404 | PASS |
| UPDATE: missing title → 400 | PASS |
| UPDATE: full replacement (PUT wipes panels) | PASS |
| DELETE: existing dashboard → 200 | PASS |
| DELETE: verify 404 after delete | PASS |
| DELETE: non-existent → 404 | PASS |
| SEARCH: list all | PASS |
| SEARCH: filter by title | PASS |
| SEARCH: pagination (per_page/page) | PASS |
| SEARCH: empty results | PASS |

### Edge Cases

| Test | Result | Notes |
|------|--------|-------|
| Grid: full width (w=48, h=1) | PASS | |
| Grid: w=0 → 400 | PASS | |
| Grid: w=49 → 400 | PASS | |
| Grid: h=0 → 400 | PASS | |
| Empty panels array | PASS | |
| Unicode title (CJK, Arabic, emoji) | PASS | |
| Very long title (10k chars) | PASS | No limit enforced — see issue below |
| Special characters in ID (/, ?, #) | PASS | Created and retrieved successfully |
| Missing kbn-xsrf → 400 | PASS | |
| Missing elastic-api-version → 400 | PASS | |
| Wrong api version (99) → 400 | PASS | |
| Extra unknown fields → 400 | PASS | Rejected (strict validation) |
| Malformed JSON → 400 | PASS | |
| PUT is idempotent | PASS | |
| Cross-space create/read | PASS | Isolation works correctly |
| Non-existent space → creates anyway? | **ISSUE** | Returns 200, dashboard created despite space not existing (see bug below) |
| Access control (`write_restricted`) | **FAIL** | Requires user profile, cannot use with basic auth |
| ES\|QL dataset in Lens | **FAIL** | Schema validation error — unclear documentation |
| CREATE returns 201 | **FAIL** | Returns 200 instead |

### Bugs Found

#### BUG-1: Lens Metric schema requires `metrics` array, not documented clearly (Severity: Major)
- **Reproduce**: POST a Lens panel with `"type": "metric"` and a `value` field
- **Expected**: The "Getting Started" doc does not provide a metric example; user has to guess the schema
- **Actual**: Fails with validation error. The `metric` type requires a `metrics` array with objects containing `type`, `operation`, etc.
- **Impact**: Users will struggle to create metric panels without explicit documentation

#### BUG-2: ES|QL dataset type schema unclear (Severity: Major)
- **Reproduce**: POST a Lens XY panel with `dataset.type: "esql"` and `esql` or `query` field
- **Expected**: Should work per documentation suggesting ES|QL support
- **Actual**: Validation fails. The error suggests `query` field is expected for esql type but the exact required schema is not documented in the "Getting Started" guide
- **Impact**: ES|QL-based visualizations cannot be created via API without extensive trial-and-error

#### BUG-3: `access_control` doesn't work with basic auth (Severity: Minor)
- **Reproduce**: POST a dashboard with `access_control.access_mode: "write_restricted"` using basic auth
- **Expected**: Should work or give clear guidance
- **Actual**: `"Cannot create a saved object of type dashboard with an access mode because Kibana could not determine the user profile ID"`
- **Impact**: Common auth method (basic auth) doesn't support access control. Should document this limitation.

#### BUG-4: CREATE returns 200 instead of 201 (Severity: Minor)
- **Reproduce**: POST `/api/dashboards` with valid body
- **Expected**: HTTP 201 Created (standard REST practice)
- **Actual**: HTTP 200 OK
- **Impact**: Minor, but violates REST conventions. Some HTTP libraries and tools treat 200 and 201 differently.

#### BUG-5: Non-existent space silently accepts dashboard creation (Severity: Needs Investigation)
- **Reproduce**: POST to `/s/nonexistent-space/api/dashboards` — the API returned 200
- **Expected**: Should return 404 or create the space
- **Actual**: Returns 200 — the space path may be silently creating the space or the dashboard may be orphaned
- **Impact**: Could lead to data in unexpected spaces

#### BUG-6: PUT is full replacement — not documented prominently (Severity: Minor/Documentation)
- **Reproduce**: Create a dashboard with panels, then PUT with only a title (no panels)
- **Actual**: All panels are wiped. This is correct behavior for PUT but surprising for users expecting PATCH semantics
- **Impact**: Users may accidentally lose dashboard content. Should be called out prominently in documentation, and consider adding PATCH support.

#### OBSERVATION-1: No title length limit
- A 10,000-character title is accepted. Consider adding a reasonable max length.

---

## 2. Terraform Provider Testing Results

### Summary: 4/6 resources created successfully, 2 failed with provider bugs

### CRUD via Terraform

| Test | Result | Notes |
|------|--------|-------|
| Create minimal dashboard | PASS | |
| Create Markdown panel dashboard | PASS | |
| Create Lens XY (typed config) | **FAIL** | Server-side defaults cause inconsistent state |
| Create Lens metric (raw JSON) | **FAIL** | JSON key ordering + server defaults cause inconsistent state |
| Create multi-panel dashboard | PASS | |
| Create dashboard with options | PASS | |
| Plan after apply (no phantom diffs) | PASS | For 4 successful resources |
| Drift detection (out-of-band delete) | PASS | Correctly detects and plans recreation |
| Destroy | PASS | All resources destroyed cleanly |
| Import | PASS (with caveats) | Import succeeds but plan shows changes due to empty vs default values |

### Bugs Found

#### TF-BUG-1: Server-side defaults cause "inconsistent result after apply" (Severity: Blocker)
- **Reproduce**: Apply a Lens XY chart with typed config, omitting optional fields like `ignore_global_filters`, `sampling`, `drop_partial_intervals`
- **Expected**: Apply succeeds, plan shows no changes
- **Actual**: Terraform error: "Provider produced inconsistent result after apply" — server adds defaults (`ignore_global_filters: false`, `sampling: 1`, `drop_partial_intervals: false`, `include_empty_rows: true`, etc.) that weren't in the plan
- **Impact**: **Blocker for XY chart typed config**. Users must explicitly specify every optional field with its default value to avoid this error.
- **Root cause**: The provider isn't handling server-populated defaults in its `Create` response mapping.

#### TF-BUG-2: JSON config_json key ordering mismatch (Severity: Major)
- **Reproduce**: Apply a Lens panel using `config_json` with a metric chart
- **Expected**: Apply succeeds
- **Actual**: "Provider produced inconsistent result" — the JSON key ordering changes between what was sent and what was read back, and the server adds defaults like `alignments` and `fit` to metrics
- **Impact**: Raw JSON escape hatch doesn't fully work for metric charts. Key ordering differences cause Terraform to see a diff.
- **Recommendation**: Provider should normalize JSON (sort keys) and suppress server-added defaults, or compare JSON semantically rather than as strings.

#### TF-BUG-3: Too many required fields (Severity: Major)
- **Reproduce**: Try to create a `elasticstack_kibana_dashboard` with just `title`
- **Expected**: Only `title` should be required (matches the API)
- **Actual**: Provider requires `time_from`, `time_to`, `query_language`, `query_text`, `refresh_interval_pause`, `refresh_interval_value` — none of which are required by the API
- **Impact**: User experience is poor. Creates unnecessary boilerplate. Every dashboard needs 7 fields minimum instead of 1.

#### TF-BUG-4: Import produces phantom diffs (Severity: Major)
- **Reproduce**: Create a dashboard via API (with only title), import it into Terraform
- **Expected**: Plan shows no changes
- **Actual**: Plan shows changes for `query_language`, `time_from`, `time_to`, `refresh_interval_pause` — the provider's required fields don't match what the API returns for a minimal dashboard
- **Impact**: Import workflow requires manual state surgery or config adjustment

#### TF-BUG-5: Empty axis config becomes null (Severity: Minor)
- **Reproduce**: Set `axis.x = {}` in xy_chart_config
- **Expected**: Empty object preserved
- **Actual**: Becomes null on read-back, causing inconsistent state
- **Impact**: Users must explicitly set all axis sub-fields

---

## 3. Best Practices Assessment

### API

| Practice | Status | Notes |
|----------|--------|-------|
| Correct HTTP status codes | **PARTIAL** | Uses 200 for create instead of 201 |
| Consistent error format | **GOOD** | `{statusCode, error, message}` consistently |
| Input validation | **GOOD** | Strict schema validation, rejects unknowns |
| Idempotent PUT | **GOOD** | Verified |
| Pagination | **GOOD** | page/per_page with total |
| RBAC/Auth | **GOOD** | Viewer can read, editor can write |
| Cross-space support | **GOOD** | Works correctly with isolation |
| PATCH support (partial update) | **MISSING** | PUT is full replacement — risky for users |
| ETag / optimistic concurrency | **MISSING** | `meta.version` exists but no If-Match support |
| Bulk operations | **MISSING** | No bulk create/update/delete |
| OpenAPI spec | **UNKNOWN** | Not tested |
| Rate limiting docs | **MISSING** | No documented limits |

### Terraform Provider

| Practice | Status | Notes |
|----------|--------|-------|
| Plan accuracy (no phantom diffs) | **PARTIAL** | Works for simple dashboards, broken for Lens typed/JSON configs |
| Import support | **PARTIAL** | Import succeeds but produces phantom diffs |
| Drift detection | **GOOD** | Correctly detects out-of-band changes |
| Destroy | **GOOD** | Clean destruction |
| Error messages | **GOOD** | Clear Terraform-style errors |
| Required vs optional alignment | **BAD** | Many fields required in TF that are optional in API |
| Documentation | **PARTIAL** | Generated docs exist but examples may not work due to bugs |
| Server default handling | **BAD** | Root cause of most provider bugs |

---

## 4. Prioritized Recommendations

1. **[Provider - Blocker]** Fix server-side default handling in Create/Read to prevent "inconsistent result" errors. The provider must either: (a) set defaults in the schema that match server defaults, or (b) normalize the response to exclude server-added defaults.

2. **[Provider - High]** Make `time_from`, `time_to`, `query_language`, `query_text`, `refresh_interval_pause`, `refresh_interval_value` optional with sensible defaults matching the API.

3. **[Provider - High]** Fix `config_json` to compare JSON semantically (parsed) rather than as string equality, to handle key ordering differences.

4. **[API - Medium]** Add comprehensive Lens panel examples to documentation — especially for `metric`, `gauge`, `datatable`, and ES|QL datasets. Current docs only cover `xy` charts.

5. **[API - Medium]** Consider adding PATCH endpoint for partial dashboard updates to prevent accidental data loss from PUT.

6. **[API - Low]** Return 201 instead of 200 for POST (resource creation).

7. **[API - Low]** Document that `access_control` requires an authenticated user profile (not basic auth).

8. **[API - Low]** Investigate whether posting to a non-existent space should be rejected.

9. **[API - Low]** Consider adding a maximum title length.
