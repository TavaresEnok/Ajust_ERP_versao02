'use client';

import type { ComponentType } from 'react';
import AnalystPortalImpl from './portal.impl';

const AnalystPortal = AnalystPortalImpl as unknown as ComponentType;

export default AnalystPortal;
