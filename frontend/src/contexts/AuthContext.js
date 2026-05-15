import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(undefined); // undefined = still loading
  const [profile, setProfile] = useState(null);      // { chess_username, chess_source }

  async function loadProfile(userId) {
    const { data } = await supabase
      .from('user_profiles')
      .select('chess_username, chess_source')
      .eq('id', userId)
      .single();
    setProfile(data || { chess_username: null, chess_source: 'chess.com' });
    return data;
  }

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) loadProfile(u.id);
      else setProfile(null);
    });

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) loadProfile(u.id);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  const updateProfile = useCallback(async (chessUsername, chessSource) => {
    if (!user) return;
    const { error } = await supabase.from('user_profiles').upsert({
      id: user.id,
      chess_username: chessUsername,
      chess_source: chessSource || 'chess.com',
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    setProfile({ chess_username: chessUsername, chess_source: chessSource || 'chess.com' });
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, profile, signInWithGoogle, signOut, updateProfile, loadProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
