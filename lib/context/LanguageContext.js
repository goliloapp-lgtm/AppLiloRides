import React, { createContext, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loadLanguagePreference, saveLanguagePreference } from '../../i18n/config';
import { showToast } from '../../utils/toast';

const LanguageContext = createContext(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [isLoading, setIsLoading] = useState(true);
  const { i18n: i18nInstance } = useTranslation();

  // Load saved language preference on mount
  useEffect(() => {
    const initializeLanguage = async () => {
      try {
        const savedLanguage = await loadLanguagePreference();
        setCurrentLanguage(savedLanguage);
      } catch (error) {
        console.error('Error initializing language:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeLanguage();
  }, []);

  // Change language and persist preference
  const changeLanguage = async (language) => {
    try {
      await saveLanguagePreference(language);
      setCurrentLanguage(language);
      
      // Show success message based on the new language
      if (language === 'es') {
        showToast.success('Idioma cambiado exitosamente');
      } else {
        showToast.success('Language changed successfully');
      }
    } catch (error) {
      console.error('Error changing language:', error);
      
      // Show error message in current language
      if (i18nInstance.language === 'es') {
        showToast.error('Error al cambiar el idioma');
      } else {
        showToast.error('Error changing language');
      }
      throw error;
    }
  };

  const value = {
    currentLanguage,
    changeLanguage,
    isLoading
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

