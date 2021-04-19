/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import type { AppMountParameters, CoreStart, CoreSetup } from 'src/core/public';

export class BananaPlugin {
  public setup(core: CoreSetup) {
    core.application.register({
      id: 'banana',
      title: 'banana',
      meta: {
        keywords: ['banana'],
      },
      mount: async (params: AppMountParameters) => {
        ReactDOM.render(
          <div>
            <img
              src="https://peanutbutterjellytime.net/img/peanut-butter-jelly-time.gif"
              alt="Banana"
              style={{ position: 'fixed', top: '40%', left: '40%', width: '200px' }}
            />
          </div>,
          params.element
        );

        return () => {
          ReactDOM.unmountComponentAtNode(params.element);
        };
      },
    });

    return {};
  }

  public start(core: CoreStart) {
    return {};
  }

  public stop() {}
}
