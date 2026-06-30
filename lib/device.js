import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'device_id';

/**
 * Gets a stable, unique device ID.
 * It first tries to get a native identifier. If that fails or is unavailable,
 * it falls back to a locally stored, randomly generated UUID.
 */
export const getUniqueId = async () => {
  let deviceId;

  // Try to get the native device ID first
  if (Platform.OS === 'ios') {
    deviceId = await Application.getIosIdForVendorAsync();
  } else {
    deviceId = Application.androidId;
  }

  // If a native ID is found, use it
  if (deviceId) {
    console.log(`[getUniqueId] Using native device ID: ${deviceId}`);
    return deviceId;
  }

  // If not, fall back to a stored UUID
  console.warn('[getUniqueId] Native device ID not available. Falling back to stored UUID.');
  let storedId = await AsyncStorage.getItem(DEVICE_ID_KEY);

  if (storedId) {
    console.log(`[getUniqueId] Using stored UUID: ${storedId}`);
    return storedId;
  }

  // If no stored ID, generate a new one, store it, and return it
  const newId = Crypto.randomUUID();
  await AsyncStorage.setItem(DEVICE_ID_KEY, newId);
  console.log(`[getUniqueId] Generated and stored new UUID: ${newId}`);
  return newId;
};
