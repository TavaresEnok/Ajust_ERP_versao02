'use client';

import type { ComponentType } from 'react';
import AnalystPortalRuntime from './portal.runtime';

const AnalystPortalImpl = AnalystPortalRuntime as unknown as ComponentType;

export default AnalystPortalImpl;
