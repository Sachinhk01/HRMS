import { useEffect, useState } from 'react';
import { hrmsService } from '../services/hrmsService';
import { getActiveLeaveTypes } from '../services/leaveService';

export default function useLeavePolicy() {
  const [policy, setPolicy] = useState({
    loading: true,
    guideline: 2,
    sandwichKnown: false,
    sandwich: { monday: false, friday: false, fridayMonday: false },
    error: '',
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [settingsResult, typesResult] = await Promise.allSettled([
        hrmsService.getLeaveSettings(),
        getActiveLeaveTypes(),
      ]);
      if (cancelled) return;

      const settings = settingsResult.status === 'fulfilled' ? settingsResult.value : null;
      const types = typesResult.status === 'fulfilled' ? typesResult.value : [];
      const typeGuideline = Array.isArray(types)
        ? types.find((type) => type.monthlyGuideline !== null && type.monthlyGuideline !== undefined)?.monthlyGuideline
        : undefined;
      const guideline = settings?.monthlyGuideline ?? typeGuideline ?? 2;
      const expectedForbidden = settingsResult.status === 'rejected' && settingsResult.reason?.status === 403;
      const errors = [];
      if (settingsResult.status === 'rejected' && !expectedForbidden) {
        errors.push(settingsResult.reason?.message || 'Could not load leave settings.');
      }
      if (typesResult.status === 'rejected') {
        errors.push(typesResult.reason?.message || 'Could not load leave types.');
      }

      setPolicy({
        loading: false,
        guideline: Number(guideline),
        sandwichKnown: Boolean(settings),
        sandwich: {
          monday: Boolean(settings?.sandwichLeaveMondayEnabled),
          friday: Boolean(settings?.sandwichLeaveFridayEnabled),
          fridayMonday: Boolean(settings?.sandwichLeaveFridayMondayEnabled),
        },
        error: errors.join(' '),
      });
    };
    load();
    return () => { cancelled = true; };
  }, []);

  return policy;
}
