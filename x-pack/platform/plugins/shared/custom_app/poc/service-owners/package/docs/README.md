# Service owners

An example of an app a customer builds: who owns each service, kept in an ES|QL lookup index and
edited from the app through a workflow. Its second table joins open Nightshift investigations to
their owners with `LOOKUP JOIN service_owners ON service.name`.

```
manifest.yml
img/icon.svg
kibana/custom_app/service-owners.json        the app, shown in the navigation
kibana/workflow/service-owners-app-setup.yml creates and seeds the service_owners lookup index
kibana/workflow/service-owners-app-save.yml  writes one owner, run by the app's forms
```

The setup workflow runs every minute and does nothing once the index exists. The join reads
`nightshift-app-investigations`, which the Nightshift investigations package fills.
