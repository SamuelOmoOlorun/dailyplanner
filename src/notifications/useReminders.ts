import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { listReminderTasks } from '../storage/tasks';
import { createReminderBackend } from './index';
import { reconcileReminders } from './reconcile';
import type { Permission } from './types';

export function useReminders(revision: number) {
  const db = useSQLiteContext();
  const [permission, setPermission] = useState<Permission>('default');
  const [warning, setWarning] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const backend = useMemo(() => createReminderBackend(db, setWarning), [db]);
  const queue = useRef(Promise.resolve());
  const active = useRef(true);

  const refresh = useCallback(() => {
    queue.current = queue.current.catch(() => {}).then(async () => {
      if (!active.current) return;
      const status = await backend.permission();
      setPermission(status);
      await reconcileReminders(backend, await listReminderTasks(db));
      if (active.current) setWarning(null);
    }).catch(() => {
      if (active.current) setWarning('Tasks are saved, but reminders could not be updated. Check permissions and try again.');
    });
    return queue.current;
  }, [backend, db]);

  useEffect(() => {
    active.current = true;
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    const timer = setInterval(() => { void refresh(); }, 30000);
    const onFocus = () => { void refresh(); };
    if (Platform.OS === 'web') window.addEventListener('focus', onFocus);
    return () => {
      active.current = false;
      subscription.remove(); clearInterval(timer); backend.dispose?.();
      if (Platform.OS === 'web') window.removeEventListener('focus', onFocus);
    };
  }, [backend, refresh]);

  useEffect(() => { void refresh(); }, [revision, refresh]);

  async function requestPermission() {
    setRequesting(true);
    try {
      // Invoke directly from a user gesture for browser permission prompts.
      const result = await backend.requestPermission();
      setPermission(result);
      await refresh();
    } catch { setWarning('Notification permission could not be requested. Check your device settings.'); }
    finally { setRequesting(false); }
  }

  return { permission, warning, requesting, requestPermission, refresh };
}
