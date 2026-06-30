import React, { useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native';
import CustomButton from '../CustomButton';
import { usePaymentStore } from '../../store';
import { useTranslation } from '../../hooks/useTranslation';

export default function PaymentMethodComponent(props) {
    const { setActiveSheet } = props;
  const { setPaymentMethod } = usePaymentStore();
  const [selectedMethod, setSelectedMethod] = useState(null);
  const { t } = useTranslation("ride");

  const PAYMENT_OPTIONS = [
    {
      id: 'cash',
      title: t("payment.cash"),
      icon: '💵',
    },
    {
      id: 'card',
      title: t("payment.card"),
      icon: '💳',
    },
  ];


  const handleSelectMethod = (method) => {
    setSelectedMethod(method.id);
  };

  const handleContinue = () => {
    if (selectedMethod) {
      setPaymentMethod(selectedMethod);
      setActiveSheet("confirmRide");
    }
  };

  return (
    <View className='pb-4'>

    <View className="flex-1 p-2">
             
              
              {PAYMENT_OPTIONS.map((option) => {
                const isSelected = selectedMethod === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    onPress={() => handleSelectMethod(option)}
                   className={`${
              isSelected ? "bg-secondary/20" : "bg-white"
            } flex flex-row items-center  py-2 my-2 px-3 rounded-xl`}
                  >
                    <Text className="text-3xl">{option.icon}</Text>
                    <Text className={`ml-5 text-lg ${isSelected ? 'font-bold text-blue-600' : 'font-bold text-gray-700'}`}>
                      {option.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
    
              <View className="flex-1 justify-end my-3">
                {!selectedMethod ? (
                  <View className="opacity-50">
                    <CustomButton title={t("payment.continue")} />
                  </View>
                ) : (
                  <CustomButton title={t("payment.continue")} onPress={handleContinue} />
                )}
              </View>
            </View>
    </View>
  )
}
