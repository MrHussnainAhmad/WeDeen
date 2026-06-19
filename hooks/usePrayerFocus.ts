import { useEffect, useState } from 'react';
import {
  getLastPrayerFocusState,
  subscribePrayerFocus,
} from '@/services/prayerFocusCoordinator';
import type { SalahFocusRuntimeState } from '@/services/salahFocusService';

export function usePrayerFocus() {
  const [state, setState] = useState<SalahFocusRuntimeState | null>(getLastPrayerFocusState());

  useEffect(() => {
    return subscribePrayerFocus((next) => setState(next));
  }, []);

  return state;
}
