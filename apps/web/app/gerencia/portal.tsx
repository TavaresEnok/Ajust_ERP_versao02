'use client';

import type { ComponentType } from 'react';
import ManagerPortalImpl from './portal.impl';

const ManagerPortal = ManagerPortalImpl as unknown as ComponentType;

export default ManagerPortal;
