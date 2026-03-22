import React, { createContext, useContext, useEffect, useState } from 'react';
import { account } from '../services/appwrite';
import { User, Session } from '../types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Check for existing session on mount
  const checkSession = async () => {
    try {
      console.log('🔍 Checking for existing session...');
      const currentUser = await account.get();
      
      // Ensure the user object has the name property
      const userWithName: User = {
        $id: currentUser.$id,
        email: currentUser.email,
        name: currentUser.name || '',
        phone: currentUser.phone || undefined,
        prefs: currentUser.prefs || {},
        emailVerification: currentUser.emailVerification || false,
        phoneVerification: currentUser.phoneVerification || false,
        status: currentUser.status || false,
      };
      
      setUser(userWithName);
      
      // Get current session
      const sessions = await account.listSessions();
      const currentSession = sessions.sessions.find((s: any) => s.current);
      setSession(currentSession as Session || null);
      
      console.log('✅ Session found:', currentUser.email);
    } catch (error: any) {
      console.log('ℹ️ No active session found');
      setUser(null);
      setSession(null);
    } finally {
      setInitialized(true);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      console.log('🔐 Logging in:', email);
      await account.createEmailPasswordSession(email, password);
      await checkSession();
      console.log('✅ Login successful');
    } catch (error: any) {
      console.error('❌ Login error:', error);
      throw new Error(error.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    setLoading(true);
    try {
      console.log('📝 Creating account:', email);
      await account.create('unique()', email, password, name);
      
      // Auto-login after signup
      await login(email, password);
      console.log('✅ Account created and logged in');
    } catch (error: any) {
      console.error('❌ Signup error:', error);
      throw new Error(error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      console.log('👋 Logging out...');
      await account.deleteSession('current');
      setUser(null);
      setSession(null);
      console.log('✅ Logged out successfully');
    } catch (error: any) {
      console.error('❌ Logout error:', error);
      throw new Error(error.message || 'Failed to logout');
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    initialized,
    login,
    signup,
    logout,
    checkSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
