import React, { createContext, useState, useContext, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { getUserProfile, saveUserProfile } from '../profile';
import { useAuth } from './AuthContext';
import { UserProfile } from '../../types';

interface ProfileContextType {
  profileData: UserProfile | null;
  loading: boolean;
  updateProfile: (newProfileData: Partial<UserProfile>) => Promise<{ success: boolean; data?: any; error?: string }>;
  hasProfile: boolean;
  isFirstTime: boolean;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

interface ProfileProviderProps {
  children: ReactNode;
}

export function ProfileProvider({ children }: ProfileProviderProps) {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const userUid = user?.uid;

  useEffect(() => {
    // This effect reacts to changes in the user UID (login, logout, etc.)
    if (userUid) {
      setLoading(true);
      getUserProfile(userUid)
        .then(result => {
          if (result.success) {
            setProfileData(result.data);
          } else {
            setProfileData(null);
            console.error("ProfileContext: Failed to load profile:", result.error);
          }
        })
        .catch(error => {
          console.error("ProfileContext: Unhandled error in getUserProfile:", error);
          setProfileData(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      // No user is signed in, so clear profile data and stop loading.
      setProfileData(null);
      setLoading(false);
    }
  }, [userUid]);

  // Function to update the user's profile
  const updateProfile = useCallback(async (newProfileData: Partial<UserProfile>) => {
    if (!userUid) {
      return { success: false, error: "User not authenticated" };
    }

    try {
      const result = await saveUserProfile(userUid, newProfileData);
      if (result.success) {
        // Immediately update local state upon successful save, merging with existing data
        setProfileData(prev => {
          if (!prev) return result.data;
          const merged = { ...prev, ...newProfileData };
          // Ensure updatedAt matches string format instead of a sentinel object
          merged.updatedAt = new Date().toISOString();
          return merged;
        });
      }
      return result;
    } catch (error) {
      console.error("Error updating profile:", error);
      return { success: false, error: "Failed to update profile" };
    }
  }, [userUid]);
  
  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    profileData,
    loading,
    updateProfile,
    // Add a helper to easily check if a profile exists
    hasProfile: !!profileData,
    // True when the user exists in Firestore but hasn't completed their profile yet
    isFirstTime: !!profileData && !profileData?.firstName,
  }), [profileData, loading, updateProfile]);

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}

// Custom hook to use the profile context
export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
