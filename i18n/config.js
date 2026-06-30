import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import translation files
import enCommon from '../locales/en/common.json';
import enProfile from '../locales/en/profile.json';
import enHome from '../locales/en/home.json';
import enHistory from '../locales/en/history.json';
import enRide from '../locales/en/ride.json';
import enMessages from '../locales/en/messages.json';
import enCompleted from '../locales/en/completed.json';
import enRideCard from '../locales/en/rideCard.json';
import enAuth from '../locales/en/auth.json';

import esCommon from '../locales/es/common.json';
import esProfile from '../locales/es/profile.json';
import esHome from '../locales/es/home.json';
import esHistory from '../locales/es/history.json';
import esRide from '../locales/es/ride.json';
import esMessages from '../locales/es/messages.json';
import esCompleted from '../locales/es/completed.json';
import esRideCard from '../locales/es/rideCard.json';
import esAuth from '../locales/es/auth.json';

// Storage key for language preference
export const LANGUAGE_STORAGE_KEY = '@user_language';

// Available languages
export const LANGUAGES = {
  en: { name: 'English', nativeName: 'English' },
  es: { name: 'Spanish', nativeName: 'Español' }
};

// Translation resources
const resources = {
  en: {
    common: enCommon,
    profile: enProfile,
    home: enHome,
    history: enHistory,
    ride: enRide,
    messages: enMessages,
    completed: enCompleted,
    rideCard: enRideCard,
    auth: enAuth
  },
  es: {
    common: esCommon,
    profile: esProfile,
    home: esHome,
    history: esHistory,
    ride: esRide,
    messages: esMessages,
    completed: esCompleted,
    rideCard: esRideCard,
    auth: esAuth
  }
};

// Initialize i18next
i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3', // For React Native compatibility
    resources,
    lng: 'en', // Default language
    fallbackLng: 'en', // Fallback language if translation is missing
    defaultNS: 'common', // Default namespace
    ns: ['common', 'profile', 'home', 'history', 'ride', 'messages', 'completed', 'rideCard', 'auth'], // Available namespaces
    interpolation: {
      escapeValue: false // React already escapes values
    },
    react: {
      useSuspense: false // Disable suspense for React Native
    }
  });

// Load saved language preference
export const loadLanguagePreference = async () => {
  try {
    const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'es')) {
      await i18n.changeLanguage(savedLanguage);
      return savedLanguage;
    }
    return 'en'; // Default to English
  } catch (error) {
    console.error('Error loading language preference:', error);
    return 'en';
  }
};

// Save language preference
export const saveLanguagePreference = async (language) => {
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    await i18n.changeLanguage(language);
  } catch (error) {
    console.error('Error saving language preference:', error);
    throw error;
  }
};

export default i18n;

