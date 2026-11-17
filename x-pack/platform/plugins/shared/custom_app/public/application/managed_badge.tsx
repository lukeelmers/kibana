/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useState } from 'react';
import { EuiBadge, EuiButton, EuiPopover, EuiSpacer, EuiText } from '@elastic/eui';
import { i18n } from '@kbn/i18n';

export const MANAGED_LABEL = i18n.translate('xpack.customApp.standalone.managedBadge', {
  defaultMessage: 'Managed',
});

/**
 * As Dashboards marks a managed dashboard: a badge next to the title, whose popover says where the
 * app comes from and offers to clone it.
 */
export const ManagedBadge = ({
  packageName,
  onClone,
  isCloning,
}: {
  packageName: string;
  /** Left out when the app cannot be cloned here. */
  onClone?: () => void;
  isCloning: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const description = i18n.translate('xpack.customApp.standalone.managed', {
    defaultMessage: 'Installed by the {name} package. Clone it to customize.',
    values: { name: packageName },
  });

  return (
    <EuiPopover
      aria-label={description}
      isOpen={isOpen}
      closePopover={() => setIsOpen(false)}
      panelStyle={{ maxWidth: 280 }}
      button={
        <EuiBadge
          color="primary"
          iconType="readOnly"
          onClick={() => setIsOpen((open) => !open)}
          onClickAriaLabel={description}
          data-test-subj="customAppManagedBadge"
        >
          {MANAGED_LABEL}
        </EuiBadge>
      }
    >
      <EuiText size="s">
        <p>{description}</p>
      </EuiText>
      {onClone && (
        <>
          <EuiSpacer size="s" />
          <EuiButton
            size="s"
            iconType="copy"
            isLoading={isCloning}
            onClick={onClone}
            data-test-subj="customAppClone"
          >
            {i18n.translate('xpack.customApp.standalone.clone', { defaultMessage: 'Clone' })}
          </EuiButton>
        </>
      )}
    </EuiPopover>
  );
};
