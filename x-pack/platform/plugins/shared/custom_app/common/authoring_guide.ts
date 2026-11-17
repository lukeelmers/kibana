/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { describeCapability, listActions, listCapabilities } from '@kbn/custom-app-registry';

/**
 * A small app that uses the ideas an agent needs: a table whose row click remembers a column and
 * opens a flyout, and a flyout that shows the row and a form for it. A test checks it is a valid
 * document, so the guide cannot drift from the schema.
 */
export const AUTHORING_GUIDE_EXAMPLE = {
  title: 'Service owners',
  state: { service: '', owner: '' },
  body: [
    {
      type: 'table',
      query: 'FROM logs-* | STATS errors = COUNT(*) BY service.name | SORT errors DESC',
      onRowClick: [{ state: { service: '{{row.service.name}}' } }, { flyout: 'service-details' }],
    },
    {
      type: 'flyout',
      id: 'service-details',
      title: 'Service {{row.service.name}}',
      children: [
        {
          type: 'fields',
          query:
            'FROM logs-* | WHERE service.name == ?service | STATS errors = COUNT(*), last_seen = MAX(@timestamp)',
        },
        {
          type: 'form',
          fields: [{ name: 'owner', label: 'Owner', required: true }],
          submitLabel: 'Set the owner',
          onSubmit: {
            workflow: { id: 'set-owner' },
            inputs: { service: '{{row.service.name}}', owner: '{{state.owner}}' },
          },
        },
      ],
    },
  ],
} as const;

/**
 * What an agent needs to know to build or change a custom app. It is made when it is asked for, so
 * that it says what the registry has by then, including what other plugins registered.
 */
export const getAuthoringGuide =
  (): string => `A custom app is one JSON document, { "title", "description"?, "state", "body" }. "body" is a list of components, each with a "type"; a component that holds others has them in "children". Give a component an "id" (letters, digits, - and _) only when something refers to it, such as the flyout an action opens.

Components:
${listCapabilities().map(describeCapability).join('\n')}

Every component can also have:
- "query": an ES|QL query whose result fills a stat, fields or table. Choose and rename columns in the query (KEEP, EVAL, RENAME, STATS ... AS), and check it with the ES|QL tools you have. ?_tstart and ?_tend are the time range.
- "visibleWhen": { "$state": "name" } shows it while that boolean value is true, and { "$state": "name", "equals": "details" } while the value is that.
- "onClick", "onRowClick", "onSubmit", "onChange": an action, or a list of actions run in order.

Actions, each an object with one key:
${listActions()
  .map(
    ({ id, doc }) =>
      `- ${id}: ${doc.summary} ${doc.whenToUse} Example: ${JSON.stringify(doc.example)}`
  )
  .join('\n')}

Values: "state" names the values of the app by their defaults, such as { "service": "", "limit": 10, "verbose": false, "users": [] }; the type of a value is that of its default. A query reads a value as ?name, and text as {{state.name}}. In a row click, and in a flyout a row click opens, text and the values of actions read the clicked row as {{row.<column>}}. An input's or a select's "bind" names the value it sets. A form puts each answer in the value its field names, which must be declared, then runs "onSubmit"; a form in a flyout closes it once that is done.

Running a workflow: the "workflow" action runs a Workflow as the person who presses the button, after they confirm it. An app that ships in a package names the package's workflows by file: "save-owner" is its kibana/workflow/save-owner.yml, and "other_package:save-owner" is that file of another package. An app you make has no package, so name a workflow saved in the Workflows application as { "id": "<id>" }. Only use a workflow you found with the workflow tools, with its own input names. If none does what a button or a form needs, draft one with the workflow generation tool in the same turn, passing a "workflowId" that you choose (lowercase letters, digits and hyphens) and that no workflow has, and use that id: build the whole app now, button or form included, and do not wait. Never use an id that is neither a workflow you found nor a draft you made. Until the person saves the draft in the Workflows application, the button or the form says it is not ready: tell them that saving the draft is all that is left. You cannot save a workflow yourself.

Alerts are documents, read with ES|QL; look at the indices and fields with the tools before you write a query, and never assume. The alerts of classic rules are in .alerts-*, with fields such as kibana.alert.uuid, kibana.alert.rule.name and kibana.alert.workflow_status. The alerts of the newer ES|QL rules are events in .rule-events, one for each run of a rule, and the events of one alert share an episode.id. Never write to an alert index: to act on an alert, run a workflow from a row click or a button, and hand it the id of the alert.

Example:
${JSON.stringify(AUTHORING_GUIDE_EXAMPLE, null, 2)}`;
