/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { loggingSystemMock } from '@kbn/core/server/mocks';
import type { ManagedSkillsClient } from '@kbn/agent-builder-server';

import type { PackageInstallContext } from '../../../../../common/types';
import { KibanaSavedObjectType } from '../../../../../common/types';

import {
  getPackageSkillOwner,
  installSkills,
  isSkillAssetPath,
  parseSkillAsset,
  uninstallSkills,
} from './install';

const createContext = (entries: Record<string, string>): PackageInstallContext =>
  ({
    packageInfo: { name: 'my_pkg' },
    paths: Object.keys(entries),
    archiveIterator: {
      traverseEntries: async (
        onEntry: (entry: { path: string; buffer?: Buffer }) => Promise<void>,
        filter?: (path: string) => boolean
      ) => {
        for (const [path, content] of Object.entries(entries)) {
          if (!filter || filter(path)) {
            await onEntry({ path, buffer: Buffer.from(content) });
          }
        }
      },
    },
  } as unknown as PackageInstallContext);

const createClient = () =>
  ({
    upsert: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(undefined),
  } as jest.Mocked<ManagedSkillsClient>);

const SKILL_PATH = 'my_pkg-1.0.0/kibana/skill/my-skill/SKILL.md';
const OTHER_SKILL_PATH = 'my_pkg-1.0.0/kibana/skill/other-skill/SKILL.md';

const skillFile = ({
  name = 'my-skill',
  description = 'Does a thing',
  extra = '',
  body = 'Use the tools.',
}: { name?: string; description?: string; extra?: string; body?: string } = {}) =>
  `---\nname: ${name}\ndescription: ${description}\n${extra}---\n\n${body}\n`;

const skillRef = (id: string) => ({ id, type: KibanaSavedObjectType.skill });

describe('skill assets', () => {
  const logger = loggingSystemMock.createLogger();

  describe('isSkillAssetPath', () => {
    it('matches only SKILL.md files in a kibana/skill/<id> directory', () => {
      expect(isSkillAssetPath(SKILL_PATH)).toBe(true);
      expect(isSkillAssetPath('my_pkg-1.0.0/kibana/skill/my-skill.md')).toBe(false);
      expect(isSkillAssetPath('my_pkg-1.0.0/kibana/skill/my-skill/notes.md')).toBe(false);
      expect(isSkillAssetPath('my_pkg-1.0.0/kibana/workflow/my-skill/SKILL.md')).toBe(false);
      expect(isSkillAssetPath('my_pkg-1.0.0/kibana/skill/a/b/SKILL.md')).toBe(false);
    });
  });

  describe('getPackageSkillOwner', () => {
    it('prefixes the package name with fleet', () => {
      expect(getPackageSkillOwner('my_pkg')).toBe('fleet:my_pkg');
    });
  });

  describe('parseSkillAsset', () => {
    it('takes the id from the directory and the content from the body', () => {
      expect(parseSkillAsset(SKILL_PATH, Buffer.from(skillFile()))).toEqual({
        id: 'my-skill',
        name: 'my-skill',
        description: 'Does a thing',
        content: 'Use the tools.',
      });
    });

    it('reads allowed-tools as a comma-separated string or a list', () => {
      expect(
        parseSkillAsset(SKILL_PATH, Buffer.from(skillFile({ extra: 'allowed-tools: a, b\n' })))
          .tool_ids
      ).toEqual(['a', 'b']);
      expect(
        parseSkillAsset(
          SKILL_PATH,
          Buffer.from(skillFile({ extra: 'allowed-tools:\n  - a\n  - b\n' }))
        ).tool_ids
      ).toEqual(['a', 'b']);
    });

    it('throws without frontmatter, name or description', () => {
      expect(() => parseSkillAsset(SKILL_PATH, Buffer.from('Just text'))).toThrow(
        /must start with YAML frontmatter/
      );
      expect(() =>
        parseSkillAsset(SKILL_PATH, Buffer.from('---\nname: my-skill\n---\n\nBody'))
      ).toThrow(/needs a name and a description/);
    });

    it('throws on an invalid allowed-tools value', () => {
      expect(() =>
        parseSkillAsset(SKILL_PATH, Buffer.from(skillFile({ extra: 'allowed-tools: 3\n' })))
      ).toThrow(/invalid allowed-tools/);
    });
  });

  describe('installSkills', () => {
    it('writes every skill of the package and returns their refs', async () => {
      const client = createClient();

      const refs = await installSkills({
        client,
        packageInstallContext: createContext({
          [SKILL_PATH]: skillFile(),
          [OTHER_SKILL_PATH]: skillFile({ name: 'other-skill' }),
          'my_pkg-1.0.0/kibana/workflow/hello.yml': 'name: hello',
        }),
        logger,
      });

      expect(client.upsert).toHaveBeenCalledTimes(2);
      expect(client.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'my-skill', content: 'Use the tools.' })
      );
      expect(refs).toEqual([skillRef('my-skill'), skillRef('other-skill')]);
    });

    it('rewrites skills in place on upgrade and removes the ones no longer shipped', async () => {
      const client = createClient();

      const refs = await installSkills({
        client,
        packageInstallContext: createContext({ [SKILL_PATH]: skillFile({ body: 'New text.' }) }),
        logger,
        previousRefs: [skillRef('my-skill'), skillRef('other-skill')],
      });

      expect(client.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'my-skill', content: 'New text.' })
      );
      expect(client.delete).toHaveBeenCalledTimes(1);
      expect(client.delete).toHaveBeenCalledWith('other-skill');
      expect(refs).toEqual([skillRef('my-skill')]);
    });

    it('removes the skills it created and throws when a skill fails', async () => {
      const client = createClient();
      client.upsert
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('taken'));

      await expect(
        installSkills({
          client,
          packageInstallContext: createContext({
            [SKILL_PATH]: skillFile(),
            [OTHER_SKILL_PATH]: skillFile({ name: 'other-skill' }),
            'my_pkg-1.0.0/kibana/skill/third/SKILL.md': skillFile({ name: 'third' }),
          }),
          logger,
          previousRefs: [skillRef('my-skill')],
        })
      ).rejects.toThrow('Failed to install skill third: taken');

      // my-skill was installed before this run, so it is kept.
      expect(client.delete).toHaveBeenCalledTimes(1);
      expect(client.delete).toHaveBeenCalledWith('other-skill');
    });

    it('throws before writing anything when a SKILL.md is invalid', async () => {
      const client = createClient();

      await expect(
        installSkills({
          client,
          packageInstallContext: createContext({ [SKILL_PATH]: 'No frontmatter' }),
          logger,
        })
      ).rejects.toThrow(/must start with YAML frontmatter/);
      expect(client.upsert).not.toHaveBeenCalled();
    });
  });

  describe('uninstallSkills', () => {
    it('deletes only skill refs', async () => {
      const client = createClient();

      await uninstallSkills({
        client,
        refs: [skillRef('my-skill'), { id: 'dash', type: KibanaSavedObjectType.dashboard }],
        logger,
      });

      expect(client.delete).toHaveBeenCalledTimes(1);
      expect(client.delete).toHaveBeenCalledWith('my-skill');
    });

    it('logs failures, or throws them when strict', async () => {
      const client = createClient();
      client.delete.mockRejectedValue(new Error('boom'));

      await uninstallSkills({ client, refs: [skillRef('my-skill')], logger });
      expect(logger.warn).toHaveBeenCalledWith('Failed to uninstall skill my-skill: boom');

      await expect(
        uninstallSkills({ client, refs: [skillRef('my-skill')], logger, strict: true })
      ).rejects.toThrow('boom');
    });
  });
});
