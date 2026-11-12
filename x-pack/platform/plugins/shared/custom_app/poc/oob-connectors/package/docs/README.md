# Out-of-band connectors

Ships the AbuseIPDB connector as a YAML spec (`kibana/connector/abuseipdb_oob.yml`), installed
into the Actions connector catalog. The connector type id is `.abuseipdb_oob` rather than
`.abuseipdb` because catalog specs cannot replace built-in connector types.

The spec version is in the YAML. Each version is stored once and never overwritten; the connector
type runs the newest stored version, and older versions stay stored after an upgrade.

| Package | Spec | Change |
| ------- | ---- | ------ |
| 0.1.1 | 1.1 | Adds `checkBlock` to the 1.0 actions, `checkIp` and `reportIp` |

Uninstalling the package removes the connector type. Connectors created from it are kept but stop
working until the package is installed again.
