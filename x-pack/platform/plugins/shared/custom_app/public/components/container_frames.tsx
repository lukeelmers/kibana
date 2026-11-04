/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { createContext, useState, type ReactNode } from 'react';
import {
  EuiAccordion,
  EuiFlexGrid,
  EuiFlexGroup,
  EuiFlexItem,
  EuiIcon,
  EuiPanel,
  EuiTabbedContent,
  EuiText,
  EuiTitle,
  useEuiTheme,
  useGeneratedHtmlId,
} from '@elastic/eui';
import { css } from '@emotion/react';

/**
 * True inside a card whose content sits flush against its edges, such as a section of an accordion
 * drawn as cards: a list there draws no border of its own, as the card is its border.
 */
export const FlushContext = createContext(false);

/** What is inside a container, one under the other. Each is already drawn, as a child of the node. */
export const Column = ({ children }: { children: ReactNode[] }) => (
  <EuiFlexGroup direction="column" gutterSize="m" responsive={false}>
    {children.map((child, index) => (
      <EuiFlexItem key={index} grow={false}>
        {child}
      </EuiFlexItem>
    ))}
  </EuiFlexGroup>
);

interface CardFrameProps {
  nodeId: string;
  title?: string;
  description?: string;
  icon?: string;
  children: ReactNode[];
}

/** A bordered card: a title, with an icon, and a description, over what is inside. */
export const CardFrame = ({ nodeId, title, description, icon, children }: CardFrameProps) => (
  <EuiPanel hasBorder hasShadow={false} paddingSize="m" data-node-id={nodeId}>
    {title || description || icon ? (
      <>
        <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
          {icon ? (
            <EuiFlexItem grow={false}>
              <EuiIcon type={icon} color="primary" aria-hidden="true" />
            </EuiFlexItem>
          ) : null}
          {title ? (
            <EuiFlexItem>
              <EuiTitle size="xs">
                <h4>{title}</h4>
              </EuiTitle>
            </EuiFlexItem>
          ) : null}
        </EuiFlexGroup>
        {description ? (
          <EuiText size="s" color="subdued">
            <p>{description}</p>
          </EuiText>
        ) : null}
        {children.length > 0 ? <div style={{ height: 12 }} /> : null}
      </>
    ) : null}
    <Column>{children}</Column>
  </EuiPanel>
);

/** What is inside side by side, in this many columns, which wrap under each other when narrow. */
export const ColumnsFrame = ({
  nodeId,
  columns,
  children,
}: {
  nodeId: string;
  columns: 2 | 3 | 4;
  children: ReactNode[];
}) => (
  <EuiFlexGrid columns={columns} gutterSize="l" data-node-id={nodeId}>
    {children.map((child, index) => (
      <EuiFlexItem key={index}>{child}</EuiFlexItem>
    ))}
  </EuiFlexGrid>
);

export interface FrameSection {
  id: string;
  label: string;
  open?: boolean;
  /** What is shown beside the title, such as a count. */
  title?: ReactNode;
  /** Whether the content is only lists, which sit flush in a card. */
  isFlush?: boolean;
  content: ReactNode[];
}

/** Sections as tabs, one shown at a time. Which is shown is kept by the frame, not by the app. */
export const TabsFrame = ({ nodeId, sections }: { nodeId: string; sections: FrameSection[] }) => (
  <div data-node-id={nodeId}>
    <EuiTabbedContent
      size="s"
      tabs={sections.map(({ id, label, content }) => ({
        id,
        name: label,
        content: (
          <div style={{ paddingTop: 12 }}>
            <Column>{content}</Column>
          </div>
        ),
      }))}
    />
  </div>
);

const AccordionSection = ({ section }: { section: FrameSection }) => {
  const id = useGeneratedHtmlId({ prefix: 'customAppAccordion', suffix: section.id });
  return (
    <EuiPanel hasBorder hasShadow={false} paddingSize="s">
      <EuiAccordion
        id={id}
        buttonContent={
          section.title ? (
            <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
              <EuiFlexItem grow={false}>{section.label}</EuiFlexItem>
              <EuiFlexItem grow={false}>{section.title}</EuiFlexItem>
            </EuiFlexGroup>
          ) : (
            section.label
          )
        }
        initialIsOpen={section.open === true}
        paddingSize="s"
      >
        <Column>{section.content}</Column>
      </EuiAccordion>
    </EuiPanel>
  );
};

/**
 * A section as a card of its own: its title, with what is beside it, is a header across the card that
 * opens and closes it, and the content sits below a rule.
 */
const AccordionCard = ({ section }: { section: FrameSection }) => {
  const { euiTheme } = useEuiTheme();
  const id = useGeneratedHtmlId({ prefix: 'customAppAccordionCard', suffix: section.id });
  const [isOpen, setIsOpen] = useState(section.open !== false);

  return (
    <EuiPanel
      hasBorder={false}
      hasShadow={false}
      paddingSize="none"
      data-test-subj="customAppAccordionCard"
      css={css({
        boxSizing: 'border-box',
        overflow: 'hidden',
        border: `${euiTheme.border.width.thin} solid ${euiTheme.border.color}`,
      })}
    >
      <EuiAccordion
        id={id}
        forceState={isOpen ? 'open' : 'closed'}
        onToggle={setIsOpen}
        arrowDisplay="none"
        paddingSize="none"
        buttonContent={
          <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
            <EuiFlexItem grow={false}>
              <EuiIcon
                type="chevronSingleRight"
                aria-hidden="true"
                css={css({ transform: `rotate(${isOpen ? '90deg' : '0deg'})` })}
              />
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiTitle size="xxs">
                <span>{section.label}</span>
              </EuiTitle>
            </EuiFlexItem>
            {section.title ? <EuiFlexItem grow={false}>{section.title}</EuiFlexItem> : null}
          </EuiFlexGroup>
        }
        buttonProps={{
          css: css`
            box-sizing: border-box;
            align-items: center;
            block-size: ${euiTheme.size.xxxl};
            padding: 0 ${euiTheme.size.base};

            &:hover,
            &:focus {
              text-decoration: none;
            }

            &:hover,
            &:focus-visible {
              background-color: ${euiTheme.colors.backgroundBaseInteractiveHover};
            }
          `,
        }}
      >
        <div
          css={css({
            borderTop: euiTheme.border.thin,
            padding: section.isFlush ? 0 : `${euiTheme.size.m} ${euiTheme.size.base}`,
          })}
        >
          <FlushContext.Provider value={section.isFlush === true}>
            <Column>{section.content}</Column>
          </FlushContext.Provider>
        </div>
      </EuiAccordion>
    </EuiPanel>
  );
};

/** Sections that open and close, each on its own, in a panel or, as cards, each a card of its own. */
export const AccordionFrame = ({
  nodeId,
  sections,
  variant = 'default',
}: {
  nodeId: string;
  sections: FrameSection[];
  variant?: 'default' | 'cards';
}) => (
  <EuiFlexGroup
    direction="column"
    gutterSize={variant === 'cards' ? 'l' : 's'}
    responsive={false}
    data-node-id={nodeId}
  >
    {sections.map((section) => (
      <EuiFlexItem key={section.id} grow={false}>
        {variant === 'cards' ? (
          <AccordionCard section={section} />
        ) : (
          <AccordionSection section={section} />
        )}
      </EuiFlexItem>
    ))}
  </EuiFlexGroup>
);
