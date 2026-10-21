import { onAuthStateChanged, signOut as fbSignOut, type User } from 'firebase/auth';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { DeviceRecord, UserProfile } from '../lib/types';
import { subscribeDevice } from '../lib/api';
import { AuthContext, type AuthContextValue } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [device, setDevice] = useState<DeviceRecord | null>(null);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async (user: User | null) => {
    if (!user) {
      setProfile(null);
      setDevice(null);
      return;
    }
    try {
      const snapshot = await getDoc(doc(db, 'users', user.uid));
      if (snapshot.exists()) {
        setProfile(snapshot.data() as UserProfile);
        setError(null);
      } else {
        setProfile(null);
        setError('Your account is not provisioned yet. Contact the administrator.');
        await fbSignOut(auth);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your profile.');
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      await loadProfile(user);
      setLoading(false);
    });
    return unsubscribe;
  }, [loadProfile]);

  useEffect(() => {
    if (!profile || profile.role !== 'teacher') {
      setDevice(null);
      setDeviceLoading(false);
      return undefined;
    }
    setDeviceLoading(true);
    const unsubscribe = subscribeDevice(
      profile.uid,
      (record) => {
        setDevice(record);
        setDeviceLoading(false);
      },
      () => setDeviceLoading(false)
    );
    return unsubscribe;
  }, [profile]);

  const signOut = useCallback(async () => {
    setProfile(null);
    setDevice(null);
    await fbSignOut(auth);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      profile,
      firebaseUser,
      device,
      deviceLoading,
      error,
      refreshProfile: () => loadProfile(auth.currentUser),
      signOut
    }),
    [loading, profile, firebaseUser, device, deviceLoading, error, loadProfile, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
