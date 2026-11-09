/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { of } from 'rxjs';

import { loggingSystemMock } from '@kbn/core/server/mocks';
import { savedObjectsClientMock } from '@kbn/core-saved-objects-api-server-mocks';
import type { SkillsStart } from '@kbn/agent-builder-server';

import { appContextService } from '../../../../app_context';
import { saveKibanaAssetsRefs } from '../../install';
import { installSkills, isSkillAssetPath } from '../../../kibana/skills/install';
import type { KibanaAssetReference } from '../../../../../../common/types';
import { KibanaSavedObjectType } from '../../../../../../common/types';

import { stepInstallSkills } from './step_install_skills';

jest.mock('../../../../app_context');
jest.mock('../../install');
jest.mock('../../../kibana/skills/install', () => ({
  ...jest.createMockFromModule<typeof import('../../../kibana/skills/install')>(
    '../../../kibana/skills/install'
  ),
  getInstalledSkillRefs: (...args: unknown[]) =>
    jest.requireActual('../../../kibana/skills/install').getInstalledSkillRefs(...args),
  getPackageSkillOwner: (name: string) => `fleet:${name}`,
}));

const mockedAppContext = appContextService as jest.Mocked<typeof appContextService>;

const SKILL_PATH = 'my_pkg-1.0.0/kibana/skill/my-skill/SKILL.md';
const DASHBOARD_PATH = 'my_pkg-1.0.0/kibana/dashboard/a.json';
const SKILL_REF: KibanaAssetReference = { id: 'my-skill', type: KibanaSavedObjectType.skill };

const createContext = ({
  paths,
  installedKibana = [],
  additionalSpaces,
}: {
  paths: string[];
  installedKibana?: KibanaAssetReference[];
  additionalSpaces?: Record<string, KibanaAssetReference[]>;
}) => ({
  logger: loggingSystemMock.createLogger(),
  savedObjectsClient: savedObjectsClientMock.create(),
  spaceId: 'default',
  packageInstallContext: { packageInfo: { name: 'my_pkg' }, paths } as Parameters<
    typeof stepInstallSkills
  >[0]['packageInstallContext'],
  installedPkg: {
    attributes: {
      installed_kibana: installedKibana,
      installed_kibana_space_id: 'default',
      additional_spaces_installed_kibana: additionalSpaces,
    },
  } as unknown as Parameters<typeof stepInstallSkills>[0]['installedPkg'],
});

const mockFeatureFlag = (enabled: boolean) => {
  mockedAppContext.getFeatureFlags.mockReturnValue({
    getBooleanValue$: jest.fn().mockReturnValue(of(enabled)),
  } as unknown as ReturnType<typeof appContextService.getFeatureFlags>);
};

describe('stepInstallSkills', () => {
  const managedClient = {};
  const skills = { getManagedClient: jest.fn() } as unknown as jest.Mocked<SkillsStart>;

  beforeEach(() => {
    jest.resetAllMocks();
    jest
      .mocked(isSkillAssetPath)
      .mockImplementation((path) =>
        jest.requireActual('../../../kibana/skills/install').isSkillAssetPath(path)
      );
    mockFeatureFlag(true);
    skills.getManagedClient.mockReturnValue(managedClient as never);
    mockedAppContext.getAgentBuilderSkills.mockReturnValue(skills);
  });

  it('is a no-op when the package has no skills and none were installed before', async () => {
    await stepInstallSkills(createContext({ paths: [DASHBOARD_PATH] }));

    expect(installSkills).not.toHaveBeenCalled();
    expect(saveKibanaAssetsRefs).not.toHaveBeenCalled();
  });

  it('installs skills as the package owner and saves their refs', async () => {
    jest.mocked(installSkills).mockResolvedValue([SKILL_REF]);
    const context = createContext({ paths: [SKILL_PATH] });

    await stepInstallSkills(context);

    expect(skills.getManagedClient).toHaveBeenCalledWith({
      spaceId: 'default',
      managedBy: 'fleet:my_pkg',
    });
    expect(installSkills).toHaveBeenCalledWith(
      expect.objectContaining({ client: managedClient, previousRefs: [] })
    );
    expect(saveKibanaAssetsRefs).toHaveBeenCalledWith(
      context.savedObjectsClient,
      'my_pkg',
      [SKILL_REF],
      'default',
      false,
      true,
      [KibanaSavedObjectType.skill]
    );
  });

  it('upgrades additional spaces with their previous refs', async () => {
    jest.mocked(installSkills).mockResolvedValue([SKILL_REF]);

    await stepInstallSkills(
      createContext({
        paths: [SKILL_PATH],
        installedKibana: [SKILL_REF],
        additionalSpaces: { other: [SKILL_REF] },
      })
    );

    expect(skills.getManagedClient).toHaveBeenCalledWith({
      spaceId: 'other',
      managedBy: 'fleet:my_pkg',
    });
    expect(installSkills).toHaveBeenCalledTimes(2);
    expect(saveKibanaAssetsRefs).toHaveBeenLastCalledWith(
      expect.anything(),
      'my_pkg',
      [SKILL_REF],
      'other',
      true,
      true,
      [KibanaSavedObjectType.skill]
    );
  });

  it('skips skills when the flag is off or Agent Builder is not available', async () => {
    mockFeatureFlag(false);
    await stepInstallSkills(createContext({ paths: [SKILL_PATH] }));

    mockFeatureFlag(true);
    mockedAppContext.getAgentBuilderSkills.mockReturnValue(undefined);
    await stepInstallSkills(createContext({ paths: [SKILL_PATH] }));

    expect(installSkills).not.toHaveBeenCalled();
    expect(saveKibanaAssetsRefs).not.toHaveBeenCalled();
  });
});
