import { useState, useEffect } from 'react';
import { AuthContext } from './AuthContextBase';
import { signOut, getCurrentUser, onAuthStateChange, supabase } from '../lib/supabase';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Fetch user profile safely
   */
  const fetchUserProfile = async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        setProfile(null);
      } else if (!data) {
        setProfile({
          user_id: userId,
          status: 'partial',
          role: 'founder'
        });
      } else {
        setProfile(data);
      }
    } catch (err) {
      setProfile(null);
    }
  };

  /**
   * Initial session check
   */
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { user, error } = await getCurrentUser();

        if (error && error !== 'Auth session missing!') {
        }

        if (user) {
          setUser(user);
          await fetchUserProfile(user.id);
        } else {
        }
      } catch (err) {
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: listener } = onAuthStateChange((event, session) => {
      console.log('Auth event:', event);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session?.user) {
          setLoading(true);
          setUser(session.user);
          fetchUserProfile(session.user.id).finally(() => {
            setLoading(false);
          });
        }
      }

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  /**
   * Sign out handler
   */
  const handleSignOut = async () => {
    try {
      setLoading(true);
      await signOut();
      setUser(null);
      setProfile(null);
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    setUser,
    profile,
    setProfile,
    loading,
    signOut: handleSignOut
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
