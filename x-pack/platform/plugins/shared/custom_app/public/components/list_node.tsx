/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useContext, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  EuiButtonEmpty,
  EuiButtonIcon,
  EuiContextMenuItem,
  EuiContextMenuPanel,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiPopover,
  EuiText,
  EuiToolTip,
  useEuiTheme,
} from '@elastic/eui';
import { css } from '@emotion/react';
import { i18n } from '@kbn/i18n';
import type { Action, AppNodeOfType } from '@kbn/custom-app-common';
import type { SourceData } from '../data/data_layer';
import { useDataLayer } from '../data/data_layer_context';
import { useSource } from '../data/use_source';
import { RowScopeContext } from '../runtime/binding_scope';
import { useInterpolate } from '../runtime/use_interpolate';
import { useActionRunner } from '../workflows/use_action_runner';
import { useWorkflowsGate } from '../workflows/use_workflows_gate';
import { FlushContext } from './container_frames';
import { DataState } from './data_state';
import { DroppedActions } from './dropped_actions';
import { NodeRenderer } from './node_renderer';

type Row = Readonly<Record<string, unknown>>;
type ListNodeType = AppNodeOfType<'list'>;
type RowAction = ListNodeType['rowActions'][number];

const toRows = ({ columns, rows }: SourceData): Row[] =>
  rows.map((row) => Object.fromEntries(columns.map(({ name }, index) => [name, row[index]])));

const moreActionsLabel = i18n.translate('xpack.customApp.listNode.moreActions', {
  defaultMessage: 'More actions',
});

/** A row action shown as an icon, which says why when it cannot be used. */
const RowActionButton = ({
  action,
  label,
  onRun,
}: {
  action: RowAction;
  label: string;
  onRun: (actions: readonly Action[]) => void;
}) => {
  const unavailableReason = useWorkflowsGate(action.onClick);
  return (
    <EuiToolTip content={unavailableReason ?? label} disableScreenReaderOutput>
      <EuiButtonIcon
        size="s"
        color="text"
        iconType={action.icon}
        aria-label={label}
        isDisabled={unavailableReason !== undefined}
        onClick={() => onRun(action.onClick)}
        data-test-subj="customAppListRowAction"
      />
    </EuiToolTip>
  );
};

const RowActionMenuItem = ({
  action,
  label,
  onRun,
}: {
  action: RowAction;
  label: string;
  onRun: (actions: readonly Action[]) => void;
}) => {
  const unavailableReason = useWorkflowsGate(action.onClick);
  return (
    <EuiContextMenuItem
      icon={action.icon}
      disabled={unavailableReason !== undefined}
      toolTipContent={unavailableReason}
      onClick={() => onRun(action.onClick)}
      data-test-subj="customAppListRowMenuAction"
    >
      {label}
    </EuiContextMenuItem>
  );
};

/**
 * What can be done with a row, at its top right: the first action as an icon, and the rest in a
 * menu, after a rule that sets them apart from the row. They sit beside what the row click covers,
 * so that no control is inside another.
 */
const RowActions = ({
  actions,
  onRun,
}: {
  actions: readonly RowAction[];
  onRun: (actions: readonly Action[]) => void;
}) => {
  const { euiTheme } = useEuiTheme();
  const text = useInterpolate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [first, ...rest] = actions;

  return (
    <EuiFlexGroup alignItems="center" gutterSize="xs" responsive={false}>
      <span
        aria-hidden="true"
        css={css({
          width: '1px',
          height: euiTheme.size.base,
          background: euiTheme.colors.backgroundLightText,
          marginLeft: euiTheme.size.s,
          marginRight: euiTheme.size.xs,
        })}
      />
      <EuiFlexItem grow={false}>
        <RowActionButton action={first} label={text(first.label)} onRun={onRun} />
      </EuiFlexItem>
      {rest.length > 0 && (
        <EuiFlexItem grow={false}>
          <EuiPopover
            aria-label={moreActionsLabel}
            anchorPosition="downRight"
            panelPaddingSize="none"
            panelStyle={{ minWidth: 220 }}
            isOpen={isMenuOpen}
            closePopover={() => setIsMenuOpen(false)}
            button={
              <EuiToolTip content={moreActionsLabel} disableScreenReaderOutput>
                <EuiButtonIcon
                  size="s"
                  color="text"
                  iconType="ellipsis"
                  aria-label={moreActionsLabel}
                  onClick={() => setIsMenuOpen((open) => !open)}
                  data-test-subj="customAppListRowMenu"
                />
              </EuiToolTip>
            }
          >
            <EuiContextMenuPanel
              items={rest.map((action, index) => (
                <RowActionMenuItem
                  key={index}
                  action={action}
                  label={text(action.label)}
                  onRun={(run) => {
                    setIsMenuOpen(false);
                    onRun(run);
                  }}
                />
              ))}
            />
          </EuiPopover>
        </EuiFlexItem>
      )}
    </EuiFlexGroup>
  );
};

/**
 * One row: the template, drawn with the row in scope, as one control when a click on the row does
 * something, and the row actions beside it.
 */
const ListRow = ({
  node,
  row,
  onRun,
}: {
  node: ListNodeType;
  row: Row;
  onRun: (actions: readonly Action[], row: Row) => void;
}) => {
  const { euiTheme } = useEuiTheme();
  const isClickable = node.onRowClick.length > 0;
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onRun(node.onRowClick, row);
    }
  };

  return (
    <RowScopeContext.Provider value={row}>
      <div
        data-test-subj="customAppListRow"
        css={css`
          position: relative;
          padding: ${euiTheme.size.l} ${euiTheme.size.base} ${euiTheme.size.l} ${euiTheme.size.l};
          background: ${euiTheme.colors.backgroundBasePlain};
          ${isClickable
            ? `&:has([data-test-subj='customAppListRowButton']:hover) {
                background: ${euiTheme.colors.backgroundBaseInteractiveHover};
              }`
            : ''}
        `}
      >
        <div
          role={isClickable ? 'button' : undefined}
          tabIndex={isClickable ? 0 : undefined}
          onClick={isClickable ? () => onRun(node.onRowClick, row) : undefined}
          onKeyDown={isClickable ? handleKeyDown : undefined}
          data-test-subj={isClickable ? 'customAppListRowButton' : undefined}
          css={[
            isClickable ? css({ cursor: 'pointer' }) : undefined,
            // The row actions overhang the first line of a template that is a stack of lines, so
            // that line keeps the room under it that they take, as a card of a conversation does.
            node.rowActions.length > 0
              ? css`
                  & > [data-node-id] > .euiFlexItem:first-child {
                    padding-block-end: ${euiTheme.size.s};
                  }
                `
              : undefined,
          ]}
        >
          <NodeRenderer node={node.template} />
        </div>
        {node.rowActions.length > 0 && (
          <div
            css={css`
              position: absolute;
              inset-block-start: ${euiTheme.size.l};
              inset-inline-end: ${euiTheme.size.base};
              margin-block: -${euiTheme.size.s};
            `}
          >
            <RowActions actions={node.rowActions} onRun={(actions) => onRun(actions, row)} />
          </div>
        )}
      </div>
    </RowScopeContext.Provider>
  );
};

const ListRows = ({ node, data }: { node: ListNodeType; data: SourceData }) => {
  const { euiTheme } = useEuiTheme();
  const text = useInterpolate();
  const runActions = useActionRunner(node.id);
  const [dropped, setDropped] = useState<string[]>([]);
  const rows = useMemo(() => toRows(data), [data]);
  const [shown, setShown] = useState(node.pageSize ?? rows.length);
  const visible = node.pageSize === undefined ? rows : rows.slice(0, shown);
  const divided = css`
    border-top: ${euiTheme.border.thin};
  `;

  if (rows.length === 0) {
    return (
      <Padded>
        <EuiText size="s" color="subdued" textAlign="center" data-test-subj="customAppListEmpty">
          <p>
            {node.emptyMessage === undefined
              ? i18n.translate('xpack.customApp.listNode.empty', {
                  defaultMessage: 'No results found',
                })
              : text(node.emptyMessage)}
          </p>
        </EuiText>
      </Padded>
    );
  }

  return (
    <>
      <EuiFlexGroup
        role="list"
        direction="column"
        gutterSize="none"
        responsive={false}
        css={css`
          /* Divide consecutive rows, without a rule above the first or below the last. */
          > * + * {
            border-top: ${euiTheme.border.thin};
          }
        `}
      >
        {visible.map((row, index) => (
          <EuiFlexItem role="listitem" key={index} grow={false}>
            <ListRow
              node={node}
              row={row}
              onRun={(actions, clicked) => setDropped(runActions(actions, { row: clicked }))}
            />
          </EuiFlexItem>
        ))}
      </EuiFlexGroup>
      {visible.length < rows.length && (
        <Padded extraCss={divided}>
          <EuiFlexGroup justifyContent="center" responsive={false}>
            <EuiFlexItem grow={false}>
              <EuiButtonEmpty
                size="s"
                onClick={() => setShown((count) => count + (node.pageSize ?? rows.length))}
                data-test-subj="customAppListShowMore"
              >
                {i18n.translate('xpack.customApp.listNode.showMore', {
                  defaultMessage: 'Show more',
                })}
              </EuiButtonEmpty>
            </EuiFlexItem>
          </EuiFlexGroup>
        </Padded>
      )}
      {dropped.length > 0 && (
        <Padded extraCss={divided}>
          <DroppedActions reasons={dropped} onDismiss={() => setDropped([])} />
        </Padded>
      )}
    </>
  );
};

const Padded = ({
  children,
  extraCss,
}: {
  children: ReactNode;
  extraCss?: ReturnType<typeof css>;
}) => {
  const { euiTheme } = useEuiTheme();
  return (
    <div css={[css({ padding: `${euiTheme.size.m} ${euiTheme.size.base}` }), extraCss]}>
      {children}
    </div>
  );
};

/**
 * The rows of a query, each drawn with the template, one under the other in a panel with a rule
 * between them. A click on a row runs its actions with the row, as a row of a table does.
 */
export const ListNode = ({ node }: { node: ListNodeType }) => {
  const layer = useDataLayer();
  const state = useSource(node.id);
  // In a card that is its border already, such as a section of an accordion drawn as cards.
  const isFlush = useContext(FlushContext);

  return (
    <EuiPanel
      hasBorder={!isFlush}
      hasShadow={false}
      paddingSize="none"
      borderRadius={isFlush ? 'none' : undefined}
      css={css({ overflow: 'hidden' })}
      data-node-id={node.id}
    >
      {state.status === 'success' ? (
        <ListRows node={node} data={state.data} />
      ) : (
        <Padded>
          <DataState state={state} onRetry={layer.retry}>
            {() => null}
          </DataState>
        </Padded>
      )}
    </EuiPanel>
  );
};
