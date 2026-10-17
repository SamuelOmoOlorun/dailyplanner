import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { checkRollover } from '../storage/review';
import { dateKey } from './model';

export function useRollover(onRollover: () => void) {
  const db = useSQLiteContext();
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);
  const checked = useRef<string | null>(null);
  const running = useRef(false);
  const callback = useRef(onRollover);
  callback.current = onRollover;
  const refresh = useCallback(async () => {
    const current = new Date();
    setNow(current);
    if (running.current || checked.current === dateKey(current)) return;
    running.current = true;
    try {
      const needsReview = await checkRollover(db, current);
      checked.current = dateKey(current);
      setError(null);
      if (needsReview) callback.current();
    } catch { setError('Unfinished tasks could not be checked. Retry review.'); }
    finally { running.current = false; }
  }, [db]);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 30000);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    const focus = () => { void refresh(); };
    if (Platform.OS === 'web') window.addEventListener('focus', focus);
    return () => {
      clearInterval(timer); subscription.remove();
      if (Platform.OS === 'web') window.removeEventListener('focus', focus);
    };
  }, [refresh]);
  return { now, error, refresh };
}
