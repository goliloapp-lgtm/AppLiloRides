import React, { useState } from "react";
import { View, Text } from "react-native";
import { Button } from "react-native-paper";
import { getAuth, sendEmailVerification } from "firebase/auth";
import { getFirestore, doc, updateDoc } from "firebase/firestore";
import Toast from "react-native-toast-message";
import { useTranslation } from "../../hooks/useTranslation";

export default function DisabledUser() {
  const [reactivating, setReactivating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const { t } = useTranslation("auth");

  const reactivateAccount = async (userId) => {
    const db = getFirestore();
    try {
      await updateDoc(doc(db, "users", userId), { isActive: true });
      return { success: true };
    } catch (error) {
      return { success: false, error: t("disabled.failedToReactivate") };
    }
  };

  const handleReactivate = async () => {
    setReactivating(true);
    try {
      const auth = getAuth();
      if (auth.currentUser) {
        // 1. Reactivar la cuenta en Firestore
        const reactivateResult = await reactivateAccount(auth.currentUser.uid);
        
        if (!reactivateResult.success) {
          Toast.show({
            type: "error",
            text1: t("disabled.error"),
            text2: reactivateResult.error,
          });
          setReactivating(false);
          return;
        }

        // 2. Enviar email de verificación (mantener funcionalidad existente)
        await sendEmailVerification(auth.currentUser);
        
        // 3. Mostrar estado de éxito
        setShowSuccess(true);
        
        // 4. Esperar 2 segundos y redirigir al login
        setTimeout(async () => {
          Toast.show({
            type: "success",
            text1: t("disabled.accountReactivated"),
            text2: t("disabled.accountReactivatedMessage"),
          });
          await auth.signOut(); // Cerrar sesión para redirigir al login
        }, 2000);
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("disabled.error"),
        text2: t("disabled.reactivateError"),
      });
      await getAuth().signOut();
    }
  };

  if (showSuccess) {
    return (
      <View className="flex-1 bg-bg px-6 items-center justify-center">
        <View className="bg-green-100 p-4 rounded-full mb-4">
          <Text className="text-green-600 text-4xl text-center">✓</Text>
        </View>
        <Text className="text-xl font-bold mb-3 text-center text-green-600">
          {t("disabled.successTitle")}
        </Text>
        <Text className="mb-5 text-center text-gray-600">
          {t("disabled.successMessage")}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg px-6 items-center justify-center">
      <Text className="text-lg font-bold mb-3 text-center">
        {t("disabled.title")}
      </Text>
      <Text className="mb-5 text-center">
        {t("disabled.description")}
      </Text>
      <Button
        mode="contained"
        onPress={handleReactivate}
        loading={reactivating}
        disabled={reactivating}
        style={{ marginBottom: 8 }}
        labelStyle={{ fontWeight: "bold" }}
        className="bg-secondary"
      >
        {reactivating ? t("disabled.reactivating") : t("disabled.reactivate")}
      </Button>
      <Button
        mode="outlined"
        onPress={async () => {
          await getAuth().signOut();
        }}
        labelStyle={{ fontWeight: "bold", color: "#201815" }}
        disabled={reactivating}
      >
        {t("disabled.cancel")}
      </Button>
    </View>
  );
}
