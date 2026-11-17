/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useState } from 'react';
import { EuiInMemoryTable, EuiLink, EuiPanel, type EuiBasicTableColumn } from '@elastic/eui';
import type { TableNode } from '@kbn/isomer-components';
import type { AppNodeProps, KibanaUiEnv, KibanaUiRenderer } from '@kbn/custom-app-registry';
import { DroppedActions } from '../../components/dropped_actions';

type Node = TableNode & AppNodeProps;
type Row = Readonly<Record<string, unknown>>;
interface Item {
  index: number;
  values: Row;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];

/**
 * The rows its query filled, sortable and paged. A row click runs the node's handlers with that
 * row, by the names of its columns.
 */
const TableView = ({ node, env }: { node: Node; env: KibanaUiEnv }) => {
  const [dropped, setDropped] = useState<string[]>([]);
  const onRowClick = node.onRowClick ?? [];
  const isClickable = onRowClick.length > 0;
  const handleRowClick = (row: Row) => setDropped(env.dispatch(onRowClick, { row }));

  const items: Item[] = node.rows.map((cells, index) => ({
    index,
    values: Object.fromEntries(node.columns.map(({ label }, position) => [label, cells[position]])),
  }));
  const columns: Array<EuiBasicTableColumn<Item>> = node.columns.map(({ label }, position) => ({
    field: label,
    name: label,
    sortable: (item: Item) => item.values[label] as string | number,
    render: (_value: unknown, item: Item) => {
      const text = String(item.values[label] ?? '—');
      // A real control in the first cell, so the row click is reachable by keyboard.
      return isClickable && position === 0 ? (
        <EuiLink
          onClick={(event: React.MouseEvent) => {
            event.stopPropagation();
            handleRowClick(item.values);
          }}
        >
          {text}
        </EuiLink>
      ) : (
        text
      );
    },
  }));

  return (
    <EuiPanel hasBorder hasShadow={false} paddingSize="s" data-node-id={node.id}>
      <DroppedActions reasons={dropped} onDismiss={() => setDropped([])} />
      <EuiInMemoryTable<Item>
        compressed
        items={items}
        itemId="index"
        columns={columns}
        sorting
        pagination={{ initialPageSize: PAGE_SIZE_OPTIONS[0], pageSizeOptions: PAGE_SIZE_OPTIONS }}
        tableCaption={node.id}
        rowProps={
          isClickable
            ? (item) => ({
                onClick: () => handleRowClick(item.values),
                'data-test-subj': 'customAppTableRow',
              })
            : undefined
        }
      />
    </EuiPanel>
  );
};

export const renderTable: KibanaUiRenderer<Node> = (node, env) => (
  <TableView node={node} env={env} />
);
