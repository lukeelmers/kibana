/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { registerBuiltinCapabilities } from '../common/capabilities/manifests';

// Registered where an app is first drawn, so its primitives stay out of the page-load bundle.
registerBuiltinCapabilities();

export { customAppEmbeddableFactory } from './custom_app_embeddable';
