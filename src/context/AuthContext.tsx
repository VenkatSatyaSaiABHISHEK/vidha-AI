import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut, 
  onAuthStateChanged
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

interface AuthContextType {
  isLoggedIn: boolean;
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const register = async (email: string, pass: string) => {
    await createUserWithEmailAndPassword(auth, email, pass);
    const emailClean = email.toLowerCase().trim();
    
    // Save to LocalStorage for offline compatibility
    try {
      const localUsers = JSON.parse(localStorage.getItem('registered_emails') || '[]');
      if (!localUsers.includes(emailClean)) {
        localUsers.push(emailClean);
        localStorage.setItem('registered_emails', JSON.stringify(localUsers));
      }
    } catch (e) {
      console.error("Local storage save failed:", e);
    }

    // Save to Firestore registry
    try {
      const docRef = doc(db, 'registered_emails', emailClean);
      await setDoc(docRef, { exists: true });
    } catch (e) {
      console.error("Firestore database index failed:", e);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const isLoggedIn = !!user;

  return (
    <AuthContext.Provider value={{ isLoggedIn, user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
