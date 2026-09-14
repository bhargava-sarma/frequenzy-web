/** Subscribes a component to the device performance tier. */

import { useEffect, useState } from 'react';

import { deviceTier, onTierChange, type Tier } from '../lib/perf';

export function useDeviceTier(): Tier {
  const [tier, setTier] = useState<Tier>(deviceTier);
  useEffect(() => onTierChange(setTier), []);
  return tier;
}
