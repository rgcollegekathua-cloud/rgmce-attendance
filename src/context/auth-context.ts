import { createContext } from 'react';
import type { User } from 'firebase/auth';
import type { DeviceRecord, UserProfile } from '../lib/types';

export interface AuthContextValue {
  loading: boolean;
  profile: UserProfile | null;
  firebaseUser: User | null;
  device: DeviceRecord | null;
  deviceLoading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
