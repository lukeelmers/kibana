/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { shallow } from 'enzyme';
import React from 'react';

import { mockBrowserFields } from '../../containers/source/mock';
import { TestProviders } from '../../mock';

import { DragDropContextWrapper } from './drag_drop_context_wrapper';
import { DroppableWrapper } from './droppable_wrapper';
import { useMountAppended } from '../../utils/use_mount_appended';

jest.mock('../../lib/kibana');

describe('DroppableWrapper', () => {
  const mount = useMountAppended();

  describe('rendering', () => {
    test('it renders against the snapshot', () => {
      const message = 'draggable wrapper content';

      const wrapper = shallow(
        <TestProviders>
          <DragDropContextWrapper browserFields={mockBrowserFields}>
            <DroppableWrapper droppableId="testing">{message}</DroppableWrapper>
          </DragDropContextWrapper>
        </TestProviders>
      );

      expect(wrapper.find('DroppableWrapper')).toMatchSnapshot();
    });

    test('it renders the children when a render prop is not provided', () => {
      const message = 'draggable wrapper content';

      const wrapper = mount(
        <TestProviders>
          <DragDropContextWrapper browserFields={mockBrowserFields}>
            <DroppableWrapper droppableId="testing">{message}</DroppableWrapper>
          </DragDropContextWrapper>
        </TestProviders>
      );

      expect(wrapper.text()).toEqual(message);
    });

    test('it does NOT render the children if a render method is provided', () => {
      const message = 'draggable wrapper content';

      const wrapper = mount(
        <TestProviders>
          <DragDropContextWrapper browserFields={mockBrowserFields}>
            <DroppableWrapper render={() => null} droppableId="testing">
              <div data-test-subj="this-should-not-render">{message}</div>
            </DroppableWrapper>
          </DragDropContextWrapper>
        </TestProviders>
      );

      expect(wrapper.find('[data-test-subj="this-should-not-render"]').exists()).toBe(false);
    });

    test('it renders the render prop contents when a render prop is provided', () => {
      const wrapper = mount(
        <TestProviders>
          <DragDropContextWrapper browserFields={mockBrowserFields}>
            <DroppableWrapper
              render={({ isDraggingOver }) => <div>{`isDraggingOver is: ${isDraggingOver}`}</div>}
              droppableId="testing"
            />
          </DragDropContextWrapper>
        </TestProviders>
      );

      expect(wrapper.text()).toEqual('isDraggingOver is: false');
    });
  });
});
