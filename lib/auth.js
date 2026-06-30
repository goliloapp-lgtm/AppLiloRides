import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  fetchSignInMethodsForEmail
} from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { httpsCallable } from 'firebase/functions';
import { requestNotificationPermission, getFCMToken, unregisterToken } from './fcm';
import { getUniqueId } from './device';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, functions } from "../firebase-config";  // Import functions from centralized config

const FIRST_LOGIN_FLAG_KEY = 'is_first_login_completed_on_this_device'; // Define key for first login flag

// Helper function to create user document in Firestore with optional terms metadata
export const createUserInFirestore = async (user, phone = '', termsMetadata = null) => {
  const db = getFirestore();
  const userRef = doc(db, "users", user.uid);

  try {
    // Check if user document already exists
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // Split displayName into firstName and lastName if available
      const nameParts = (user.displayName || '').trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Create user document with all available fields
      const userData = {
        email: user.email || '',
        displayName: user.displayName || '',
        firstName,
        lastName,
        phone: phone || '',
        isActive: true,
        createdAt: new Date().toISOString(),
        ...(termsMetadata ? { termsAccepted: termsMetadata } : {})
      };

      console.log("Creating user document:", userData);
      await setDoc(userRef, userData);
      console.log("User document created successfully");
      return { success: true };
    } else if (termsMetadata) {
      // If user document already exists but terms need to be saved/updated
      await setDoc(userRef, { termsAccepted: termsMetadata }, { merge: true });
      console.log("User document terms updated successfully");
    }

    console.log("User document already exists");
    return { success: true };
  } catch (error) {
    console.error("Error creating/updating user in Firestore:", error);
    return { success: false, error: "Failed to create/update user profile" };
  }
};


// Login function
export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // --- NEW LOGIC FOR FIRST LOGIN WORKAROUND ---
    console.log('[loginUser] Reading first login flag from AsyncStorage...');
    const isFirstLoginCompletedOnThisDevice = await AsyncStorage.getItem(FIRST_LOGIN_FLAG_KEY);
    console.log('[loginUser] First login flag value:', isFirstLoginCompletedOnThisDevice);
    // --- END NEW LOGIC ---

    // --- SINGLE SESSION CONTROL ---
    // Enforce session control on EVERY login, regardless of first login flag
    // The flag determines if we should warn the user, but the control logic must run always
    console.log('[loginUser] Initiating session control sequence.');
    
    try {
      console.log('[loginUser] Step 1: Checking device type and requesting FCM permissions...');
      
      // Try to get FCM token, but don't block if it fails
      let pushToken = 'NO_PUSH_TOKEN'; // Default fallback
      
      // Check if running on a physical device (emulators often have issues with notifications)
      let isPhysicalDevice = true;
      try {
        isPhysicalDevice = Device.isDevice;
      } catch (e) {
        console.warn('[loginUser] Error checking device type, assuming physical:', e);
      }
      
      console.log('[loginUser] Is physical device:', isPhysicalDevice);
      
      if (isPhysicalDevice) {
        try {
          // Request notification permissions with timeout
          const permissionPromise = requestNotificationPermission();
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Permission request timeout')), 5000)
          );
          
          const hasPermission = await Promise.race([permissionPromise, timeoutPromise]);
          console.log('[loginUser] FCM notification permission granted:', hasPermission);
          
          if (hasPermission) {
            console.log('[loginUser] Step 2: Getting FCM token...');
            pushToken = await getFCMToken();
            
            if (pushToken) {
              console.log('[loginUser] FCM token obtained successfully');
            } else {
              console.warn('[loginUser] Could not obtain FCM token');
              pushToken = 'NO_PUSH_TOKEN';
            }
          } else {
            console.warn('[loginUser] FCM notification permissions not granted. Continuing without push notifications.');
          }
        } catch (notifError) {
          console.warn('[loginUser] Error or timeout getting FCM permissions/token:', notifError.message);
          console.warn('[loginUser] Continuing without push notifications.');
        }
      } else {
        console.warn('[loginUser] Running on emulator/simulator. Skipping FCM permissions.');
        console.warn('[loginUser] Session control will work via Firebase Auth token revocation only.');
      }
      
      console.log('[loginUser] Step 3: Getting device ID...');
      const deviceId = await getUniqueId();
      console.log('[loginUser] Device ID being sent to backend:', deviceId);

      console.log('[loginUser] Step 4: Preparing device info...');
      const deviceInfo = {
        platform: Platform.OS,
        model: Device.modelName,
        osVersion: Device.osVersion,
      };
      console.log('[loginUser] Device info:', deviceInfo);

      console.log('[loginUser] Step 5: Calling enforceSingleSession Cloud Function...');
      // Use the centralized functions instance configured with us-central1 region
      const enforceSingleSession = httpsCallable(functions, 'enforceSingleSession');

      console.log('[loginUser] Calling enforceSingleSession with:', { 
        fcmToken: pushToken === 'NO_PUSH_TOKEN' ? pushToken : pushToken.substring(0, 30) + '...', 
        deviceId 
      });
      
      const sessionResult = await enforceSingleSession({
        fcmToken: pushToken,
        deviceId,
        deviceInfo,
      });

      console.log('[loginUser] enforceSingleSession response:', sessionResult.data);

      if (pushToken && pushToken !== 'NO_PUSH_TOKEN') {
        console.log('[loginUser] Step 5b: Calling registerFCMToken to enable push notifications...');
        try {
          const registerFCMToken = httpsCallable(functions, 'registerFCMToken');
          const registerResult = await registerFCMToken({ fcmToken: pushToken });
          console.log('[loginUser] registerFCMToken response:', registerResult.data);
        } catch (regError) {
           console.warn('[loginUser] Failed to register FCM token with backend:', regError);
        }
      }

      if (sessionResult.data.success) {
        console.log('✅ Single session applied successfully');
        
        if (sessionResult.data.previousSessionRevoked) {
          console.log(`⚠️ Previous session revoked on device: ${sessionResult.data.previousDeviceId}`);
            
            // Only show alert if it's NOT the first login on this device
            // This avoids confusing the user if they're just logging in again on the same device
             if (isFirstLoginCompletedOnThisDevice === 'true') {
               console.log('Previous sessions terminated.');
            }
          }
        } else {
          console.error('[loginUser] enforceSingleSession returned false:', JSON.stringify(sessionResult.data));
        }
    } catch (sessionError) {
      console.error('❌ Error applying single session control:', sessionError);
      
      // Log detailed error information for debugging
      if (sessionError.code) {
        console.error('[loginUser] Session error code:', sessionError.code);
        console.error('[loginUser] Session error message:', sessionError.message);
      }
      if (sessionError.stack) {
        console.error('[loginUser] Session error stack:', sessionError.stack);
      }

      // Don't block the user from logging in even if session control fails
      console.warn('[loginUser] Session control failed, but allowing login to continue.');
    }
    // --- END SINGLE SESSION CONTROL ---

    // --- NEW LOGIC FOR FIRST LOGIN WORKAROUND ---
    if (isFirstLoginCompletedOnThisDevice !== 'true') {
      console.log('[loginUser] Setting first login flag to true in AsyncStorage.');
      await AsyncStorage.setItem(FIRST_LOGIN_FLAG_KEY, 'true');
    }
    // --- END NEW LOGIC ---

    return { success: true, user: user };

  } catch (error) {
    console.error("Full login error:", error);

    if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
      try {
        const methods = await fetchSignInMethodsForEmail(auth, email);
        if (methods.includes('google.com')) {
          return {
            success: false,
            errorCode: 'auth/google-linked-account',
            error: 'This account is linked to a Google account.'
          };
        }
      } catch (fetchError) {
        console.error("Error fetching sign-in methods after initial failure:", fetchError);
        return { success: false, error: 'An error occurred during login.' };
      }
    }

    let errorMessage = "An error occurred during login";
    switch (error.code) {
      case "auth/user-not-found":
        errorMessage = "No account found with this email";
        break;
      case "auth/wrong-password":
        errorMessage = "Incorrect password";
        break;
      case "auth/invalid-credential":
        errorMessage = "Incorrect password or email";
        break;
      case "auth/user-disabled":
        errorMessage = "This account has been disabled";
        break;
      case "auth/too-many-requests":
        errorMessage = "Too many failed attempts. Please try again later";
        break;
    }
    return { success: false, error: errorMessage };
  }
};

// Register function
export const registerUser = async (email, password, displayName, phone, termsMetadata = null) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    if (displayName) {
      await updateProfile(userCredential.user, {
        displayName: displayName
      });
      await userCredential.user.reload();
    }

    const firestoreResult = await createUserInFirestore(userCredential.user, phone, termsMetadata);

    if (!firestoreResult.success) {
      console.warn("User created in Auth but failed to create in Firestore:", firestoreResult.error);
    }

    return { success: true, user: userCredential.user };
  } catch (error) {
    let errorMessage = "An error occurred during registration";

    switch (error.code) {
      case "auth/email-already-in-use":
        errorMessage = "This email is already registered";
        break;
      case "auth/invalid-email":
        errorMessage = "Invalid email address";
        break;
      case "auth/operation-not-allowed":
        errorMessage = "Email/password accounts are not enabled";
        break;
      case "auth/weak-password":
        errorMessage = "Password should be at least 6 characters";
        break;
    }

    return { success: false, error: errorMessage };
  }
};

// Logout function
export const logoutUser = async () => {
  try {
    const authInstance = auth;
    
    // Attempt cleanup if we have user
    if (authInstance.currentUser) {
      try {
        console.log('[logoutUser] Removing FCM token on backend...');
        const currentToken = await getFCMToken();
        if (currentToken) {
          await unregisterToken(currentToken).catch(e => 
            console.warn('[logoutUser] Non-fatal: could not unregister FCM token:', e.message)
          );
        }
        
        console.log('[logoutUser] Calling cleanupInactiveSessions Cloud Function...');
      } catch (e) {
        console.warn('[logoutUser] Cleanup error:', e);
      }
    }

    await signOut(auth);
    
    // Restore production behavior: Clear the first login flag
    console.log('[logoutUser] Clearing first login flag.');
    await AsyncStorage.removeItem(FIRST_LOGIN_FLAG_KEY);
    
    console.log('✅ Logout successful');
    return { success: true };
  } catch (error) {
    console.error('❌ Error during logout:', error);
    return { success: false, error: "Failed to logout" };
  }
};

// ─── EMAIL CALLABLES ─────────────────────────────────────────────────────────

/**
 * Send welcome email after sign-up. Call in background – do not await in UI.
 */
export const sendWelcomeEmail = async (email, displayName, locale) => {
  try {
    const callable = httpsCallable(functions, 'sendWelcomeEmail');
    await callable({ email, displayName: displayName ?? null, locale: locale ?? 'en' });
  } catch (error) {
    // Non-blocking – just log
    console.warn('[sendWelcomeEmail] Failed (non-critical):', error.message);
  }
};

/**
 * Step 1 of password reset: request a code via email.
 */
export const requestPasswordResetCode = async (email, locale) => {
  try {
    const callable = httpsCallable(functions, 'requestPasswordResetCode');
    await callable({ email, locale: locale ?? 'en' });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message ?? 'An error occurred' };
  }
};

/**
 * Step 2 of password reset: verify code and update password.
 */
export const verifyPasswordResetCode = async (email, code, newPassword) => {
  try {
    const callable = httpsCallable(functions, 'verifyPasswordResetCodeAndUpdatePassword');
    await callable({ email, code, newPassword });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message ?? 'An error occurred' };
  }
};

/**
 * Step 1 of account deletion: request a verification code (user must be signed in).
 */
export const requestAccountDeletionCode = async (locale) => {
  try {
    const callable = httpsCallable(functions, 'requestAccountDeletionCode');
    await callable({ locale: locale ?? 'en' });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message ?? 'An error occurred' };
  }
};

/**
 * Step 2 of account deletion: confirm with code to permanently delete the account.
 */
export const confirmAccountDeletion = async (userId, code) => {
  try {
    const callable = httpsCallable(functions, 'confirmAccountDeletion');
    await callable({ userId, code });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message ?? 'An error occurred' };
  }
};

/**
 * Wrapper for reactivateUserAccount callable
 */
export const reactivateUserAccount = async () => {
  try {
    const reactivateAccountFn = httpsCallable(functions, 'reactivateUserAccount');
    const result = await reactivateAccountFn();
    return result.data;
  } catch (error) {
    console.error('Error in reactivateUserAccount:', error);
    throw error;
  }
};

/**
 * Register FCM token manually (for when the token refreshes mid-session)
 */
export const registerTokenWithBackend = async (fcmToken) => {
  if (!fcmToken || fcmToken === 'NO_PUSH_TOKEN') return { success: false };
  try {
    console.log('[registerTokenWithBackend] Starting registration...');
    const registerFCMToken = httpsCallable(functions, 'registerFCMToken');
    const result = await registerFCMToken({ fcmToken });
    console.log('[registerTokenWithBackend] Success:', result.data);
    return result.data;
  } catch (error) {
    console.error('[registerTokenWithBackend] Error:', error);
    throw error;
  }
};

// Note: getCurrentUser and isAuthenticated are handled by AuthContext
// These functions are redundant and have been removed to avoid duplication