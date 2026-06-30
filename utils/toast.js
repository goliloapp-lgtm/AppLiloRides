import Toast from 'react-native-toast-message';

export const showToast = {
  success: (message, title) => {
    Toast.show({
      type: 'success',
      text1: title || 'Éxito',
      text2: message,
      position: 'top',
      visibilityTime: 3000,
    });
  },

  error: (message, title) => {
    Toast.show({
      type: 'error',
      text1: title || 'Error',
      text2: message,
      position: 'top',
      visibilityTime: 4000,
    });
  },

  info: (message, title) => {
    Toast.show({
      type: 'info',
      text1: title || 'Información',
      text2: message,
      position: 'top',
      visibilityTime: 3000,
    });
  },

  warning: (message, title) => {
    Toast.show({
      type: 'error', // Usar error type para warning (color naranja)
      text1: title || 'Advertencia',
      text2: message,
      position: 'top',
      visibilityTime: 3500,
    });
  },
};

