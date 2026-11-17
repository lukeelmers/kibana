/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { appDocumentSchema, getDocumentIssues } from '@kbn/custom-app-common';
import { AUTHORING_GUIDE_EXAMPLE, getAuthoringGuide } from './authoring_guide';

const CUSTOM_APP_AUTHORING_GUIDE = getAuthoringGuide();

describe('the authoring guide', () => {
  it('has an example that is a valid app, so the guide cannot drift from the schema', () => {
    expect(getDocumentIssues(AUTHORING_GUIDE_EXAMPLE)).toEqual([]);
    expect(appDocumentSchema.safeParse(AUTHORING_GUIDE_EXAMPLE).success).toBe(true);
  });

  it.each([
    'section',
    'row',
    'header',
    'markdown',
    'stat',
    'table',
    'fields',
    'select',
    'button',
    'link',
    'form',
    'flyout',
  ])('describes the %s component', (type) => {
    expect(CUSTOM_APP_AUTHORING_GUIDE).toContain(type);
  });

  it('says how a value is used in a query and in text', () => {
    expect(CUSTOM_APP_AUTHORING_GUIDE).toContain('?name');
    expect(CUSTOM_APP_AUTHORING_GUIDE).toContain('{{state.name}}');
  });

  it('does not teach anything the app no longer has', () => {
    expect(CUSTOM_APP_AUTHORING_GUIDE).not.toMatch(
      /dataSources|valueField|"gap"|"size"|"theme"|"root"/
    );
  });

  it('teaches how a workflow is run, and that it is run by whoever presses the button', () => {
    expect(CUSTOM_APP_AUTHORING_GUIDE).toContain('"workflow"');
    expect(CUSTOM_APP_AUTHORING_GUIDE).toContain('as the person who presses the button');
    expect(CUSTOM_APP_AUTHORING_GUIDE).toContain('{{row.<column>}}');
    expect(CUSTOM_APP_AUTHORING_GUIDE).toContain('found with the workflow tools');
  });

  it('teaches how alerts are read and acted on', () => {
    expect(CUSTOM_APP_AUTHORING_GUIDE).toContain('.alerts-*');
    expect(CUSTOM_APP_AUTHORING_GUIDE).toContain('kibana.alert.uuid');
    // The alerts of the newer kind are somewhere else, and are read per episode.
    expect(CUSTOM_APP_AUTHORING_GUIDE).toContain('.rule-events');
    expect(CUSTOM_APP_AUTHORING_GUIDE).toContain('episode.id');
    expect(CUSTOM_APP_AUTHORING_GUIDE).toContain('Never write to an alert index');
  });

  it('says what to do when no workflow does what a button needs: draft one under an id it chooses, and build the whole app', () => {
    expect(CUSTOM_APP_AUTHORING_GUIDE).toContain('"workflowId" that you choose');
    expect(CUSTOM_APP_AUTHORING_GUIDE).toContain(
      'build the whole app now, button or form included, and do not wait'
    );
    expect(CUSTOM_APP_AUTHORING_GUIDE).toContain(
      'Never use an id that is neither a workflow you found nor a draft you made'
    );
    expect(CUSTOM_APP_AUTHORING_GUIDE).toContain('saving the draft is all that is left');
    expect(CUSTOM_APP_AUTHORING_GUIDE).toContain('You cannot save a workflow yourself');
  });

  it('no longer tells the agent to leave the button out and wait', () => {
    expect(CUSTOM_APP_AUTHORING_GUIDE).not.toContain('do not add the button');
    expect(CUSTOM_APP_AUTHORING_GUIDE).not.toContain('wait for them to say it is saved');
  });

  it('says to look at the alert indices and fields first, since they differ', () => {
    expect(CUSTOM_APP_AUTHORING_GUIDE).toContain(
      'look at the indices and fields with the tools before you write a query, and never assume'
    );
  });
});
