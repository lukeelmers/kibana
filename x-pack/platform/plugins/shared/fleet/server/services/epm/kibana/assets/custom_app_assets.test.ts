/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { KibanaSavedObjectType } from '../../../../../common/types';
import { getPackageWorkflowId } from '../workflows/install';

import { isCustomAppAssetPath, resolveCustomAppWorkflowReferences } from './custom_app_assets';
import type { ArchiveAsset } from './install';

const packageName = 'my_pkg';
const createCasePath = 'my_pkg-1.0.0/kibana/workflow/create-case.yml';
const packagePaths = [
  'my_pkg-1.0.0/manifest.yml',
  'my_pkg-1.0.0/kibana/custom_app/app.json',
  createCasePath,
];

const dataViewReference = { name: 'data_view', type: 'index-pattern', id: 'create-case' };

const createAsset = (workflowId: string): ArchiveAsset => ({
  id: 'app',
  type: KibanaSavedObjectType.customApp,
  attributes: { title: 'App', version: 1, document: { state: {}, root: {} } },
  references: [{ name: 'workflow_0', type: 'workflow', id: workflowId }, dataViewReference],
});

const installedId = (spaceId: string) =>
  getPackageWorkflowId({ spaceId, packageName, path: createCasePath })!;

describe('isCustomAppAssetPath', () => {
  it('matches kibana/custom_app files only', () => {
    expect(isCustomAppAssetPath('my_pkg-1.0.0/kibana/custom_app/app.json')).toBe(true);
    expect(isCustomAppAssetPath(createCasePath)).toBe(false);
  });
});

describe('resolveCustomAppWorkflowReferences', () => {
  const resolve = (asset: ArchiveAsset, spaceId = 'default', paths = packagePaths) =>
    resolveCustomAppWorkflowReferences({ asset, packagePaths: paths, packageName, spaceId });

  it('points workflow references that name a workflow file of the package at the installed id, per space', () => {
    expect(installedId('default')).toMatch(/^system-fleet-package-workflow-/);
    expect(resolve(createAsset('create-case')).references).toEqual([
      { name: 'workflow_0', type: 'workflow', id: installedId('default') },
      dataViewReference,
    ]);
    expect(resolve(createAsset('create-case'), 'other').references[0].id).toBe(
      installedId('other')
    );
    expect(installedId('other')).not.toBe(installedId('default'));
  });

  it('leaves workflows the package does not ship, and every other reference, untouched', () => {
    const asset = createAsset('some-user-workflow');

    expect(resolve(asset).references).toEqual(asset.references);
  });

  it('does not change the asset it was given, and returns it as is without package workflows', () => {
    const asset = createAsset('create-case');

    resolve(asset);
    expect(asset.references[0].id).toBe('create-case');
    expect(resolve(asset, 'default', packagePaths.slice(0, 2))).toBe(asset);
  });
});
