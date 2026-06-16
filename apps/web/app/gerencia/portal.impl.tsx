'use client';

import type { ComponentType } from 'react';
import ManagerPortalRuntime from './portal.runtime';

const ManagerPortalImpl = ManagerPortalRuntime as unknown as ComponentType;

export default ManagerPortalImpl;
