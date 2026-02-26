'use client';

import type { ComponentType } from 'react';
import ManagerMockupRuntime from './gerencia-mockup.impl.runtime';

const ManagerMockupImpl = ManagerMockupRuntime as unknown as ComponentType;

export default ManagerMockupImpl;
