# Service owners

Installs the Service owners custom app and the 2 workflows it uses. Workflows are installed enabled.

- `service-owners-app-setup` creates the `service_owners` lookup index and seeds it with 7 owners,
  only when the index is missing. It runs every minute and can be run by hand.
- `service-owners-app-save` writes one owner, with the service name as the document id. The app's
  Save and Add service forms run it.

The app lists the owners, opens a row in a form to edit it, and joins open Nightshift
investigations to their owners with `LOOKUP JOIN service_owners ON service.name`. The join reads
`nightshift-app-investigations`, which the Nightshift investigations package fills.
