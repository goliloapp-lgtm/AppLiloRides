import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  serverTimestamp 
} from "firebase/firestore";
import { db } from "../firebase-config";
import { UserProfile } from "../types";

export interface ProfileOperationResult {
  success: boolean;
  data?: any;
  error?: string;
}

// Get user profile from Firestore
export const getUserProfile = async (userId: string): Promise<ProfileOperationResult> => {
  try {
    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      return { success: true, data: userDoc.data() as UserProfile };
    } else {
      return { success: true, data: null }; // User profile doesn't exist yet
    }
  } catch (error: any) {
    console.error("Error getting user profile:", error);
    return { 
      success: false, 
      error: "Failed to load profile data" 
    };
  }
};

// Create user profile in Firestore
export const createUserProfile = async (userId: string, profileData: Partial<UserProfile>): Promise<ProfileOperationResult> => {
  try {
    const userDocRef = doc(db, "users", userId);
    
    const profileWithTimestamp = {
      ...profileData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    await setDoc(userDocRef, profileWithTimestamp);
    
    return { success: true, data: profileWithTimestamp };
  } catch (error: any) {
    console.error("Error creating user profile:", error);
    
    let errorMessage = "Failed to create profile";
    
    switch (error.code) {
      case "permission-denied":
        errorMessage = "Permission denied. Please check your authentication.";
        break;
      case "unavailable":
        errorMessage = "Service temporarily unavailable. Please try again.";
        break;
      case "network-request-failed":
        errorMessage = "Network error. Please check your connection.";
        break;
    }
    
    return { success: false, error: errorMessage };
  }
};

// Update user profile in Firestore
export const updateUserProfile = async (userId: string, profileData: Partial<UserProfile>): Promise<ProfileOperationResult> => {
  try {
    const userDocRef = doc(db, "users", userId);
    
    const updatedData = {
      ...profileData,
      updatedAt: serverTimestamp()
    };
    
    await updateDoc(userDocRef, updatedData);
    
    return { success: true, data: updatedData };
  } catch (error: any) {
    console.error("Error updating user profile:", error);
    
    let errorMessage = "Failed to update profile";
    
    switch (error.code) {
      case "not-found":
        errorMessage = "Profile not found. Creating new profile...";
        // Try to create the profile instead
        return await createUserProfile(userId, profileData);
      case "permission-denied":
        errorMessage = "Permission denied. Please check your authentication.";
        break;
      case "unavailable":
        errorMessage = "Service temporarily unavailable. Please try again.";
        break;
      case "network-request-failed":
        errorMessage = "Network error. Please check your connection.";
        break;
    }
    
    return { success: false, error: errorMessage };
  }
};

// Save user profile (create or update)
export const saveUserProfile = async (userId: string, profileData: Partial<UserProfile>): Promise<ProfileOperationResult> => {
  try {
    // First, try to get the existing profile
    const existingProfile = await getUserProfile(userId);
    
    if (!existingProfile.success) {
      return existingProfile;
    }
    
    // If profile exists, update it; otherwise, create it
    if (existingProfile.data) {
      return await updateUserProfile(userId, profileData);
    } else {
      return await createUserProfile(userId, profileData);
    }
  } catch (error) {
    console.error("Error saving user profile:", error);
    return { 
      success: false, 
      error: "Failed to save profile data" 
    };
  }
}; 
