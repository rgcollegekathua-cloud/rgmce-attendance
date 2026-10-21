import { useCallback, useEffect, useState } from 'react';
import { fetchAppSettings, saveAppSettings, ApiError } from '../lib/api';
export function useAppSettings() {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const value = await fetchAppSettings();
            setSettings(value);
            setError(null);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Could not load settings.');
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        void reload();
    }, [reload]);
    const save = useCallback(async (next) => {
        setSaving(true);
        try {
            await saveAppSettings(next);
            setSettings(next);
            setError(null);
            return null;
        }
        catch (e) {
            return e instanceof ApiError ? e.message : 'Could not save settings.';
        }
        finally {
            setSaving(false);
        }
    }, []);
    return { settings, loading, error, save, saving, reload };
}
