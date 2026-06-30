import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../lib/context/LanguageContext';
import { useTranslation } from '../hooks/useTranslation';

const LanguageModal = ({ visible, onClose }) => {
  const { currentLanguage, changeLanguage } = useLanguage();
  const { t } = useTranslation('profile');

  const languages = [
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' }
  ];

  const handleSelectLanguage = async (languageCode) => {
    if (languageCode !== currentLanguage) {
      try {
        await changeLanguage(languageCode);
        onClose();
      } catch (error) {
        console.error('Error changing language:', error);
      }
    } else {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-center items-center p-6">
        <View className="bg-white rounded-2xl w-full max-w-md p-6">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-6">
            <View className="flex-1">
              <Text className="text-xl font-bold text-gray-800">
                {t('languageSelector.title')}
              </Text>
              <Text className="text-gray-600 mt-1">
                {t('languageSelector.subtitle')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 items-center justify-center"
            >
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Language Options */}
          <View className="gap-3">
            {languages.map((language) => {
              const isSelected = currentLanguage === language.code;
              
              return (
                <TouchableOpacity
                  key={language.code}
                  onPress={() => handleSelectLanguage(language.code)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    borderRadius: 12,
                    borderWidth: 2,
                    backgroundColor: isSelected ? 'rgba(43, 157, 217, 0.1)' : '#ffffff',
                    borderColor: isSelected ? '#2B9DD9' : '#E5E7EB'
                  }}
                  activeOpacity={0.7}
                >
                  {/* Flag */}
                  <Text className="text-3xl mr-4">{language.flag}</Text>
                  
                  {/* Language Info */}
                  <View className="flex-1">
                    <Text style={{
                      fontSize: 18,
                      fontWeight: '600',
                      color: isSelected ? '#2B9DD9' : '#1F2937'
                    }}>
                      {language.nativeName}
                    </Text>
                    <Text className="text-sm text-gray-600">
                      {language.name}
                    </Text>
                  </View>
                  
                  {/* Check Icon */}
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={28} color="#056CF2" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default LanguageModal;

