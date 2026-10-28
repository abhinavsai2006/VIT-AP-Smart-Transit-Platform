'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '@/types/transit';
import { SEED_USERS } from '@/lib/seed-data';

interface AuthContextType {
  user: UserProfile;
  availableUsers: UserProfile[];
  switchUser: (userId: string) => void;
  switchRole: (role: UserRole) => void;
  isConfiguredWithSupabase: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Default to student user for clean initial passenger experience
  const [currentUser, setCurrentUser] = useState<UserProfile>(SEED_USERS[0]);
  const [isConfiguredWithSupabase, setIsConfiguredWithSupabase] = useState(false);

  useEffect(() => {
    // Check if Supabase URL is defined in env
    const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
    setIsConfiguredWithSupabase(hasSupabase);

    // Load saved user from localStorage if present
    const savedUserId = localStorage.getItem('vit_transit_user_id');
    if (savedUserId) {
      const found = SEED_USERS.find((u) => u.id === savedUserId);
      if (found) setCurrentUser(found);
    }
  }, []);

  const switchUser = (userId: string) => {
    const found = SEED_USERS.find((u) => u.id === userId);
    if (found) {
      setCurrentUser(found);
      localStorage.setItem('vit_transit_user_id', found.id);
    }
  };

  const switchRole = (role: UserRole) => {
    const found = SEED_USERS.find((u) => u.role === role);
    if (found) {
      setCurrentUser(found);
      localStorage.setItem('vit_transit_user_id', found.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: currentUser,
        availableUsers: SEED_USERS,
        switchUser,
        switchRole,
        isConfiguredWithSupabase,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
