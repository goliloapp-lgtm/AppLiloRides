import * as AppleAuthentication from 'expo-apple-authentication';
import { getAuth, OAuthProvider, signInWithCredential } from 'firebase/auth';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { httpsCallable } from 'firebase/functions';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { createUserInFirestore } from './auth';
import { getUniqueId } from './device';
import Toast from 'react-native-toast-message';
import { auth, functions } from '../firebase-config';

// Backfill firstName/lastName and ensure isActive is set for existing users
const backfillUserNameIfMissing = async (user) => {
  try {
    const db = getFirestore();
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      const updates = {};
      // Backfill name fields
      if (!data.firstName && user.displayName) {
        const nameParts = user.displayName.trim().split(' ');
        updates.firstName = nameParts[0] || '';
        updates.lastName = nameParts.slice(1).join(' ') || '';
        updates.displayName = user.displayName;
      }
      // Ensure isActive is always set (prevents App.js spinner loop)
      if (data.isActive === undefined || data.isActive === null) {
        updates.isActive = true;
      }
      if (Object.keys(updates).length > 0) {
        await updateDoc(userRef, updates);
        console.log('[appleAuth] Backfilled user fields:', updates);
      }
    }
  } catch (e) {
    console.warn('[appleAuth] Could not backfill user fields:', e);
  }
};

const FIRST_LOGIN_FLAG_KEY = 'is_first_login_completed_on_this_device';

export const useAppleAuth = () => {
  const signInWithApple = async () => {
    if (Platform.OS !== 'ios') {
      console.warn('Apple Sign-In is only available on iOS');
      Toast.show({
        type: 'error',
        text1: 'Apple Sign-In solo está disponible en iOS.',
      });
      return { success: false, error: 'Apple Sign-In solo está disponible en iOS.' };
    }

    try {
      // 1. Get the Apple ID credential
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        return { success: false, error: 'No identity token received from Apple.' };
      }

      // 2. Build Firebase credential with the Apple ID token.
      const appleProvider = new OAuthProvider('apple.com');
      const firebaseCredential = appleProvider.credential({
        idToken: credential.identityToken,
        rawNonce: credential.nonce,
      });

      // 3. Sign in with Firebase
      const userCredential = await signInWithCredential(auth, firebaseCredential);
      const user = userCredential.user;

      // 4. Handle new user creation (if needed)
      // Note: additionalUserInfo can be null on subsequent sign-ins with modular SDK
      const isNewUser = userCredential.additionalUserInfo?.isNewUser ?? false;
      if (isNewUser) {
        const displayName = user.displayName || (credential.fullName ? `${credential.fullName.givenName} ${credential.fullName.familyName}`.trim() : 'Usuario Apple');
        await createUserInFirestore({ ...user, displayName });
      } else {
        // Even for existing users, ensure a Firestore document exists
        // (handles the race condition where auth succeeded but Firestore creation previously failed)
        await createUserInFirestore({ ...user, displayName: user.displayName || 'Usuario Apple' });
        // Backfill firstName/lastName for users created before the fix (profiles were empty)
        await backfillUserNameIfMissing(user);
      }

      // --- SINGLE SESSION CONTROL ---
      // This is wrapped in a timeout to prevent hanging in production builds
      // where getExpoPushTokenAsync() can stall indefinitely.
      const sessionControlTimeout = new Promise((resolve) =>
        setTimeout(() => resolve({ timedOut: true }), 5000)
      );

      const sessionControlWork = async () => {
        try {
          console.log('[appleAuth] Reading first login flag from AsyncStorage...');
          const isFirstLoginCompletedOnThisDevice = await AsyncStorage.getItem(FIRST_LOGIN_FLAG_KEY);
          console.log('[appleAuth] First login flag value:', isFirstLoginCompletedOnThisDevice);

          if (isFirstLoginCompletedOnThisDevice === 'true') {
            console.log('[appleAuth] Condition met. Applying single session control.');
            try {
              const { status } = await Notifications.requestPermissionsAsync();
              if (status !== 'granted') {
                console.warn('[appleAuth] Notification permissions not granted, skipping session control');
                return;
              }

              const pushToken = (await Notifications.getExpoPushTokenAsync()).data;
              const deviceId = await getUniqueId();
              const deviceInfo = {
                platform: Platform.OS,
                model: Device.modelName,
                osVersion: Device.osVersion,
              };

              const enforceSingleSession = httpsCallable(functions, 'enforceSingleSession');
              const sessionResult = await enforceSingleSession({
                fcmToken: pushToken,
                deviceId,
                deviceInfo,
              });

              if (sessionResult.data.success) {
                console.log('✅ Single session applied successfully (Apple)');
                if (sessionResult.data.previousSessionRevoked) {
                  Alert.alert(
                    'Previous Session Closed',
                    'If you had an active session on another device, it has been closed.',
                    [{ text: 'OK' }]
                  );
                }
              }
            } catch (sessionError) {
              console.error('❌ Error applying single session control (Apple):', sessionError);
            }
          } else {
            console.log('[appleAuth] Condition NOT met. Skipping single session control for first login on this device.');
          }

          if (isFirstLoginCompletedOnThisDevice !== 'true') {
            console.log('[appleAuth] Setting first login flag to true in AsyncStorage.');
            await AsyncStorage.setItem(FIRST_LOGIN_FLAG_KEY, 'true');
          }
        } catch (e) {
          console.warn('[appleAuth] Session control block threw unexpectedly:', e);
        }
        return { timedOut: false };
      };

      const sessionResult = await Promise.race([sessionControlWork(), sessionControlTimeout]);
      if (sessionResult?.timedOut) {
        console.warn('[appleAuth] ⏱ Session control timed out after 5 seconds. Proceeding with login.');
        // Still try to set the first login flag asynchronously
        AsyncStorage.getItem(FIRST_LOGIN_FLAG_KEY).then(val => {
          if (val !== 'true') AsyncStorage.setItem(FIRST_LOGIN_FLAG_KEY, 'true');
        });
      }
      // --- END SINGLE SESSION CONTROL ---


      return { success: true, user };
    } catch (e) {
      if (e.code === 'ERR_CANCELED') {
        return { success: false, error: null }; 
      }
      console.error("Apple Sign-In error:", e);
      return { success: false, error: e.message || 'An unknown error occurred during Apple Sign-In.' };
    }
  };

  return { signInWithApple };
};
