import { useState } from 'react';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../firebase-config';
import { createUserInFirestore } from './auth';
import { requestNotificationPermission, getFCMToken } from './fcm';
import { getUniqueId } from './device';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';

// Configure once at module level (safe to call multiple times)
// webClientId is required to get the idToken needed by Firebase
GoogleSignin.configure({
  webClientId: '950183292908-73525mhctb661c9b1fe8s2q7d4kb3tsn.apps.googleusercontent.com',
  offlineAccess: false,
});

export const useGoogleAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      const result = await GoogleSignin.signIn();

      // @react-native-google-signin v13+ wraps the response in { data, type }
      // Older versions return the user object directly
      const idToken = result?.data?.idToken ?? result?.idToken;

      if (!idToken) {
        console.error('[GoogleAuth] No idToken in sign-in result:', result);
        return;
      }

      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);

      // Create Firestore profile if it doesn't exist yet
      await createUserInFirestore(userCredential.user);

      // ─── Register FCM token & enforce single session ───────────────────────
      // Must mirror what loginUser does so Google users also get push notifications.
      try {
        let pushToken = 'NO_PUSH_TOKEN';
        const isPhysicalDevice = Device.isDevice;

        if (isPhysicalDevice) {
          const hasPermission = await requestNotificationPermission();
          if (hasPermission) {
            pushToken = (await getFCMToken()) || 'NO_PUSH_TOKEN';
          }
        }

        const deviceId = await getUniqueId();
        const deviceInfo = {
          platform: Platform.OS,
          model: Device.modelName,
          osVersion: Device.osVersion,
        };

        const enforceSingleSession = httpsCallable(functions, 'enforceSingleSession');
        await enforceSingleSession({ fcmToken: pushToken, deviceId, deviceInfo });

        if (pushToken && pushToken !== 'NO_PUSH_TOKEN') {
          const registerFCMToken = httpsCallable(functions, 'registerFCMToken');
          await registerFCMToken({ fcmToken: pushToken });
          console.log('[GoogleAuth] FCM token registered successfully');
        }
      } catch (fcmError) {
        // Non-blocking — user can still use the app without push notifications
        console.warn('[GoogleAuth] FCM/session setup failed (non-critical):', fcmError.message);
      }
      // ──────────────────────────────────────────────────────────────────────

      setUser(userCredential.user);
    } catch (error) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('[GoogleAuth] User cancelled sign-in');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.log('[GoogleAuth] Sign-in already in progress');
        Alert.alert("Google Sign-In", "Google Sign-In is already in progress.");
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        console.warn('[GoogleAuth] Google Play Services not available');
        Alert.alert("Google Sign-In Error", "Google Play Services are not available on this device.");
      } else {
        console.error('[GoogleAuth] Unexpected error:', error);
        let msg = `An unexpected error occurred during Google Sign-In: ${error.message || error}\n\n(Code: ${error.code || 'unknown'})`;
        if (error.code === '10' || String(error.code) === '10') {
          msg += "\n\nTip: Code 10 (DEVELOPER_ERROR) usually means the SHA-1 fingerprint of your APK is not registered in the Firebase console or Google Cloud Console for this app package.";
        }
        Alert.alert("Google Sign-In Error", msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return { user, loading, signIn };
};
