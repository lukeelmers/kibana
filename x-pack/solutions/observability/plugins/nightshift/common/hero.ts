/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { i18n } from '@kbn/i18n';

/** Shared by the Nightshift page header and the `page_header` primitive. */
export const getGreeting = (): string => {
  const hour = new Date().getHours();

  if (hour < 12) {
    return i18n.translate('xpack.nightshift.hero.morningGreetingDescription', {
      defaultMessage: 'Good morning!',
    });
  }

  if (hour < 18) {
    return i18n.translate('xpack.nightshift.hero.afternoonGreetingDescription', {
      defaultMessage: 'Good afternoon!',
    });
  }

  return i18n.translate('xpack.nightshift.hero.eveningGreetingDescription', {
    defaultMessage: 'Good evening!',
  });
};

export const getHeroTitle = ({
  isLoading,
  hasActiveInvestigations,
}: {
  isLoading: boolean;
  hasActiveInvestigations: boolean;
}): string => {
  if (isLoading) {
    return i18n.translate('xpack.nightshift.hero.checkingTitle', {
      defaultMessage: 'Looking into your data...',
    });
  }

  if (hasActiveInvestigations) {
    return i18n.translate('xpack.nightshift.hero.investigationsRunningTitle', {
      defaultMessage: 'Investigations are underway',
    });
  }

  return i18n.translate('xpack.nightshift.hero.allClearTitle', {
    defaultMessage: "You're all caught up",
  });
};
