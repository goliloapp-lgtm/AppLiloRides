import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { Button } from "react-native-paper";
import Feather from "@expo/vector-icons/Feather";
import Toast from "react-native-toast-message";
import { Formik } from "formik";
import * as yup from "yup";
import { useTranslation } from "../../hooks/useTranslation";
import { useProfile } from "../../lib/context/ProfileContext";
import { logoutUser } from "../../lib/auth";

export default function CompleteProfile() {
  const [saving, setSaving] = useState(false);
  const { t } = useTranslation("auth");
  const { profileData, updateProfile } = useProfile();

  const initialValues = {
    name: profileData?.displayName || "",
    phone: profileData?.phone || "",
  };

  const validationSchema = yup.object().shape({
    name: yup.string().required(t("validation.nameRequired")),
    phone: yup
      .string()
      .required(t("validation.phoneRequired"))
      .matches(/^[+0-9]+$/, t("validation.phoneInvalid")),
  });

  const handleSave = async (values: typeof initialValues) => {
    setSaving(true);
    try {
      const nameParts = values.name.trim().split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      const result = await updateProfile({
        displayName: values.name.trim(),
        firstName,
        lastName,
        phone: values.phone.trim(),
      });

      if (result.success) {
        Toast.show({
          type: "success",
          text1: t("completeProfile.success"),
        });
      } else {
        Toast.show({
          type: "error",
          text1: t("completeProfile.errorTitle"),
          text2: result.error || t("completeProfile.saveError"),
        });
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("completeProfile.errorTitle"),
        text2: t("completeProfile.saveError"),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, backgroundColor: "#f9f9f9" }}
      >
        <View style={{ gap: 32 }}>
          {/* Header */}
          <View style={{ gap: 12, alignItems: "center" }}>
            <View className="bg-secondary/10 p-4 rounded-full">
              <Feather name="user-check" size={40} color="#2B9DD9" />
            </View>
            <Text className="text-2xl font-bold text-black text-center">
              {t("completeProfile.title")}
            </Text>
            <Text className="text-gray-600 text-center leading-5 text-base">
              {t("completeProfile.description")}
            </Text>
          </View>

          {/* Form */}
          <Formik
            initialValues={initialValues}
            validationSchema={validationSchema}
            onSubmit={handleSave}
            enableReinitialize={true}
          >
            {({
              handleChange,
              handleBlur,
              handleSubmit,
              values,
              errors,
              touched,
              isValid,
            }) => (
              <View style={{ gap: 24 }}>
                <View style={{ gap: 24 }}>
                  {/* Name field */}
                  <View style={{ gap: 8 }}>
                    <Text className="text-black text-lg font-semibold">
                      {t("completeProfile.name")}
                    </Text>
                    <View className="bg-gray-100 rounded-lg p-3 flex-row items-center space-x-3 shadow-md">
                      <Feather name="user" size={24} color="gray" />
                      <TextInput
                        placeholderTextColor={"#888888"}
                        className="flex-1 text-black ml-2"
                        placeholder={t("completeProfile.name")}
                        onChangeText={handleChange("name")}
                        onBlur={handleBlur("name")}
                        value={values.name}
                      />
                    </View>
                    {errors.name && touched.name && (
                      <Text className="text-red-500 text-sm">{errors.name}</Text>
                    )}
                  </View>

                  {/* Phone field */}
                  <View style={{ gap: 8 }}>
                    <Text className="text-black text-lg font-semibold">
                      {t("completeProfile.phone")}
                    </Text>
                    <View className="bg-gray-100 rounded-lg p-3 flex-row items-center space-x-3 shadow-md">
                      <Feather name="phone" size={24} color="gray" />
                      <TextInput
                        placeholderTextColor={"#888888"}
                        className="flex-1 text-black ml-2"
                        placeholder={t("completeProfile.phone")}
                        keyboardType="phone-pad"
                        onChangeText={handleChange("phone")}
                        onBlur={handleBlur("phone")}
                        value={values.phone}
                      />
                    </View>
                    {errors.phone && touched.phone && (
                      <Text className="text-red-500 text-sm">{errors.phone}</Text>
                    )}
                  </View>
                </View>

                {/* Actions */}
                <View style={{ gap: 16, marginTop: 16 }}>
                  <Button
                    mode="contained"
                    onPress={() => handleSubmit()}
                    loading={saving}
                    disabled={saving || !isValid}
                    labelStyle={{ fontWeight: "bold", fontSize: 16, paddingVertical: 4 }}
                    className="bg-secondary rounded-lg"
                  >
                    {saving ? t("completeProfile.saving") : t("completeProfile.save")}
                  </Button>
                  
                  <Button
                    mode="outlined"
                    onPress={handleLogout}
                    disabled={saving}
                    textColor="#555555"
                    labelStyle={{ fontWeight: "bold", fontSize: 16, paddingVertical: 4 }}
                    style={{ borderColor: "#cccccc" }}
                    className="rounded-lg"
                  >
                    {t("completeProfile.logout")}
                  </Button>
                </View>
              </View>
            )}
          </Formik>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
