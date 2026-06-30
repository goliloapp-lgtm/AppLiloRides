import { useTranslation as useI18nTranslation } from 'react-i18next';

/**
 * Custom hook for translations
 * Re-exports the react-i18next useTranslation hook with additional helpers
 */
export const useTranslation = (namespace?: string) => {
  const { t, i18n } = useI18nTranslation(namespace);

  /**
   * Format date according to current language
   */
  const formatDate = (date: string | Date, options?: Intl.DateTimeFormatOptions) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const locale = i18n.language === 'es' ? 'es-ES' : 'en-US';
    
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...options
    };
    
    return new Intl.DateTimeFormat(locale, defaultOptions).format(dateObj);
  };

  /**
   * Format time according to current language
   */
  const formatTime = (date: string | Date, options?: Intl.DateTimeFormatOptions) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const locale = i18n.language === 'es' ? 'es-ES' : 'en-US';
    
    const defaultOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      ...options
    };
    
    return new Intl.DateTimeFormat(locale, defaultOptions).format(dateObj);
  };

  /**
   * Format currency according to current language
   */
  const formatCurrency = (amount: number, currency = 'USD') => {
    const locale = i18n.language === 'es' ? 'es-ES' : 'en-US';
    
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  /**
   * Format number according to current language
   */
  const formatNumber = (value: number, options?: Intl.NumberFormatOptions) => {
    const locale = i18n.language === 'es' ? 'es-ES' : 'en-US';
    return new Intl.NumberFormat(locale, options).format(value);
  };

  /**
   * Get relative time (e.g., "2 hours ago")
   */
  const getRelativeTime = (date: string | Date) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
    
    const isSpanish = i18n.language === 'es';
    
    if (diffInSeconds < 60) {
      return isSpanish ? 'hace un momento' : 'just now';
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return isSpanish 
        ? `hace ${diffInMinutes} ${diffInMinutes === 1 ? 'minuto' : 'minutos'}`
        : `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return isSpanish
        ? `hace ${diffInHours} ${diffInHours === 1 ? 'hora' : 'horas'}`
        : `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    return isSpanish
      ? `hace ${diffInDays} ${diffInDays === 1 ? 'día' : 'días'}`
      : `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
  };

  return {
    t,
    i18n,
    formatDate,
    formatTime,
    formatCurrency,
    formatNumber,
    getRelativeTime
  };
};
