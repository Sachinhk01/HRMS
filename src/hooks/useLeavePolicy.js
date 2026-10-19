import { useEffect, useState } from 'react';
import { hrmsService } from '../services/hrmsService';
import { getActiveLeaveTypes } from '../services/leaveService';

const DEFAULT_GUIDELINE = 2;

const toNumber = (value) => {
  const number = Number(value);
  return value !== null && value !== undefined && Number.isFinite(number) ? number : null;
};

export default function useLeavePolicy() {
  const [policy, setPolicy] = useState({
    loading: true,
    guideline: DEFAULT_GUIDELINE,
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
      const types = typesResult.status === 'fulfilled' && Array.isArray(typesResult.value) ? typesResult.value : [];

      // Settings → Leave → monthlyGuideline is the single source of truth for every role.
      // Leave-type value is only a last-resort fallback if settings cannot be loaded.
      const typeGuideline = types
        .map((type) => toNumber(type.monthlyGuideline))
        .find((value) => value !== null);
      const guideline = toNumber(settings?.monthlyGuideline) ?? typeGuideline ?? DEFAULT_GUIDELINE;

      const errors = [];
      if (settingsResult.status === 'rejected') {
        errors.push(settingsResult.reason?.message || 'Could not load leave settings.');
      }
      if (typesResult.status === 'rejected') {
        errors.push(typesResult.reason?.message || 'Could not load leave types.');
      }

      setPolicy({
        loading: false,
        guideline,
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