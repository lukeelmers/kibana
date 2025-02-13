/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useCallback } from 'react';
import type { EuiContextMenuPanelItemDescriptor } from '@elastic/eui';
import { useUpdateCases } from '../../../containers/use_bulk_update_case';
import type { CasesUI } from '../../../../common';
import { CaseStatuses } from '../../../../common/types/domain';

import * as i18n from './translations';
import type { UseActionProps } from '../types';
import { statuses } from '../../status';
import { useUserPermissions } from '../../user_actions/use_user_permissions';
import { useShouldDisableStatus } from './use_should_disable_status';

const getStatusToasterMessage = (status: CaseStatuses, cases: CasesUI): string => {
  const totalCases = cases.length;
  const caseTitle = totalCases === 1 ? cases[0].title : '';

  if (status === CaseStatuses.open) {
    return i18n.REOPENED_CASES({ totalCases, caseTitle });
  } else if (status === CaseStatuses['in-progress']) {
    return i18n.MARK_IN_PROGRESS_CASES({ totalCases, caseTitle });
  } else if (status === CaseStatuses.closed) {
    return i18n.CLOSED_CASES({ totalCases, caseTitle });
  }

  return '';
};

interface UseStatusActionProps extends UseActionProps {
  selectedStatus?: CaseStatuses;
}

export const useStatusAction = ({
  onAction,
  onActionSuccess,
  isDisabled,
  selectedStatus,
}: UseStatusActionProps) => {
  const { mutate: updateCases } = useUpdateCases();
  const { canUpdate, canReopenCase } = useUserPermissions();
  const handleUpdateCaseStatus = useCallback(
    (selectedCases: CasesUI, status: CaseStatuses) => {
      onAction();
      const casesToUpdate = selectedCases.map((theCase) => ({
        status,
        id: theCase.id,
        version: theCase.version,
      }));

      updateCases(
        {
          cases: casesToUpdate,
          successToasterTitle: getStatusToasterMessage(status, selectedCases),
        },
        { onSuccess: onActionSuccess }
      );
    },
    [onAction, updateCases, onActionSuccess]
  );

  const shouldDisableStatus = useShouldDisableStatus();

  const getStatusIcon = (status: CaseStatuses): string =>
    selectedStatus && selectedStatus === status ? 'check' : 'empty';

  const getActions = (selectedCases: CasesUI): EuiContextMenuPanelItemDescriptor[] => {
    return [
      {
        name: statuses[CaseStatuses.open].label,
        icon: getStatusIcon(CaseStatuses.open),
        onClick: () => handleUpdateCaseStatus(selectedCases, CaseStatuses.open),
        disabled: isDisabled || shouldDisableStatus(selectedCases),
        'data-test-subj': 'cases-bulk-action-status-open',
        key: 'cases-bulk-action-status-open',
      },
      {
        name: statuses[CaseStatuses['in-progress']].label,
        icon: getStatusIcon(CaseStatuses['in-progress']),
        onClick: () => handleUpdateCaseStatus(selectedCases, CaseStatuses['in-progress']),
        disabled: isDisabled || shouldDisableStatus(selectedCases),
        'data-test-subj': 'cases-bulk-action-status-in-progress',
        key: 'cases-bulk-action-status-in-progress',
      },
      {
        name: statuses[CaseStatuses.closed].label,
        icon: getStatusIcon(CaseStatuses.closed),
        onClick: () => handleUpdateCaseStatus(selectedCases, CaseStatuses.closed),
        disabled: isDisabled || shouldDisableStatus(selectedCases),
        'data-test-subj': 'cases-bulk-action-status-closed',
        key: 'cases-bulk-status-action',
      },
    ];
  };

  return { getActions, canUpdateStatus: canUpdate || canReopenCase };
};

export type UseStatusAction = ReturnType<typeof useStatusAction>;
