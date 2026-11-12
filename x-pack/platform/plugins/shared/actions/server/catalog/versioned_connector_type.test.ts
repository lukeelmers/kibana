/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { actionsConfigMock } from '../actions_config.mock';
import { actionsMock } from '../mocks';
import { buildVersion } from './build_version';
import { createVersionedConnectorType } from './versioned_connector_type';

const configurationUtilities = actionsConfigMock.create();
const actions = actionsMock.createSetup();
const fixture = readFileSync(join(__dirname, '__fixtures__', 'abuseipdb_oob.yaml'), 'utf8');
const checkBlockAction =
  '\n  checkBlock: { input: { type: object }, request: { method: GET, url: https://x } }';
const atVersion = (version: string, action = '') =>
  buildVersion(fixture.replace('"1.1"', `"${version}"`).replace('\ntest:', `${action}\ntest:`));
const checkBlock = { subAction: 'checkBlock', subActionParams: {} };

it('runs each connector at the spec version it is pinned to', () => {
  const first = atVersion('1.0');
  const type = createVersionedConnectorType({ id: first.id, versions: [first], actions });
  type.addVersion(atVersion('1.1', checkBlockAction));
  type.addVersion(atVersion('2.0', checkBlockAction));
  const params = (specVersion?: string) =>
    type.actionType.validate.params!.resolveSchema!({ configurationUtilities, specVersion });
  // New connectors are pinned to the newest version, unpinned ones run the newest 1.x
  expect([type.getLatestVersion(), type.getLatestVersion(1)]).toEqual(['2.0', '1.1']);
  expect(params(undefined).parse(checkBlock)).toMatchObject(checkBlock);
  // A connector created at 1.0 keeps 1.0 until it is updated to 1.1
  expect(() => params('1.0').parse(checkBlock)).toThrow();
  expect(params('1.1').parse(checkBlock)).toMatchObject(checkBlock);
  expect(() => params('1.2')).toThrow('not installed');
});
