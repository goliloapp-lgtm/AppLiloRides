import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from "react-native";
import Toast from "react-native-toast-message";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Formik } from "formik";
import * as yup from "yup";
import { requestPasswordResetCode, verifyPasswordResetCode } from "../../lib/auth";
import { useTranslation } from "../../hooks/useTranslation";

import { KeyboardAvoidingView, Platform } from "react-native";

export default function Password(props) {
  const { setShow } = props;
  const [loading, setLoading] = useState(false);
  // step: 'email' | 'code' | 'done'
  const [step, setStep] = useState('email');
  const [emailForReset, setEmailForReset] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { t } = useTranslation("auth");

  // ─── Step 1: Request code ────────────────────────────────────────────────
  const handleRequestCode = async (values) => {
    try {
      setLoading(true);
      const result = await requestPasswordResetCode(values.email, t.language || 'en');
      if (result.success) {
        setEmailForReset(values.email);
        setStep('code');
        Toast.show({
          type: "success",
          text1: t("password.emailSentSuccess"),
          text2: t("password.checkInbox"),
        });
      } else {
        Toast.show({ type: "error", text1: result.error });
      }
    } catch (error) {
      Toast.show({ type: "error", text1: t("login.unexpectedError") });
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 2: Verify code + set new password ───────────────────────────────
  const handleVerifyCode = async (values) => {
    try {
      setLoading(true);
      const result = await verifyPasswordResetCode(emailForReset, values.code, values.newPassword);
      if (result.success) {
        setStep('done');
        Toast.show({
          type: "success",
          text1: t("password.passwordResetSuccess"),
        });
      } else {
        Toast.show({ type: "error", text1: result.error });
      }
    } catch (error) {
      Toast.show({ type: "error", text1: t("login.unexpectedError") });
    } finally {
      setLoading(false);
    }
  };

  const emailSchema = yup.object().shape({
    email: yup.string().email(t("validation.emailInvalid")).required(t("validation.emailRequired")),
  });

  const codeSchema = yup.object().shape({
    code: yup.string().required(t("validation.codeRequired")),
    newPassword: yup.string().required(t("validation.passwordRequired")).min(6, t("validation.passwordMinLength")),
    confirmPassword: yup.string().required(t("validation.confirmPasswordRequired")).oneOf([yup.ref("newPassword"), null], t("validation.passwordsMustMatch")),
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <View className="flex-1">
        <View className="h-1/3 w-full relative" pointerEvents="box-none">
          <Image
            source={{
              uri: `https://firebasestorage.googleapis.com/v0/b/creative-feel-agency.appspot.com/o/lilo%2FIMG-Login-register.png?alt=media&token=51305e7e-443b-4057-9566-381f79f34851`,
            }}
            className="h-full w-full absolute"
            style={{ zIndex: 0 }}
          />
          <Text
            className="text-gray-700 font-bold text-3xl absolute bottom-10 left-6"
            style={{ zIndex: 1 }}
          >
            {t("password.title")}
          </Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View className="p-6 space-y-6 flex-1">

            {/* ── DONE STATE ─────────────────────────────────────────── */}
            {step === 'done' && (
              <View className="space-y-4 items-center">
                <View className="bg-green-100 p-4 rounded-full">
                  <MaterialCommunityIcons name="check-circle" size={48} color="#22c55e" />
                </View>
                <Text className="text-black text-xl font-bold text-center">
                  {t("password.passwordResetSuccess")}
                </Text>
                <Text className="text-gray-600 text-center text-base leading-6">
                  {t("password.passwordResetSuccessDescription")}
                </Text>
                <TouchableOpacity onPress={() => setShow("Login")}>
                  <View className="bg-secondary w-full rounded-full py-3 px-6">
                    <Text className="text-white text-lg text-center font-bold">
                      {t("password.backToLogin")}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* ── STEP 1: Enter email ─────────────────────────────────── */}
            {step === 'email' && (
              <Formik
                initialValues={{ email: "" }}
                validateOnMount={true}
                validationSchema={emailSchema}
                onSubmit={handleRequestCode}
              >
                {({ handleChange, handleBlur, handleSubmit, values, touched, errors, isValid }) => (
                  <>
                    <View className="space-y-4 mb-4">
                      <Text className="text-gray-600 text-center text-base leading-6">
                        {t("password.description")}
                      </Text>
                    </View>

                    <View className="space-y-2">
                      <Text className="text-black text-lg font-semibold">
                        {t("password.email")}
                      </Text>
                      <View className="bg-gray-100 rounded-full p-3 flex-row items-center space-x-1 shadow-md">
                        <MaterialCommunityIcons name="email-outline" size={24} color="gray" />
                        <TextInput
                          className="w-full"
                          placeholder={t("password.emailPlaceholder")}
                          onChangeText={handleChange("email")}
                          onBlur={handleBlur("email")}
                          value={values.email}
                          autoCapitalize="none"
                          keyboardType="email-address"
                          editable={!loading}
                        />
                      </View>
                      {errors.email && touched.email && (
                        <Text className="text-red-500 text-sm">{errors.email}</Text>
                      )}
                    </View>

                    <View className="space-y-2 mt-6">
                      <TouchableOpacity onPress={handleSubmit} disabled={loading || !isValid}>
                        <View className={`${loading || !isValid ? "bg-gray-400" : "bg-secondary"} w-full rounded-full py-3`}>
                          <Text className="text-white text-xl text-center font-bold">
                            {loading ? t("password.sending") : t("password.sendResetEmail")}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </Formik>
            )}

            {/* ── STEP 2: Enter code + new password ──────────────────── */}
            {step === 'code' && (
              <Formik
                initialValues={{ code: "", newPassword: "", confirmPassword: "" }}
                validateOnMount={false}
                validationSchema={codeSchema}
                onSubmit={handleVerifyCode}
              >
                {({ handleChange, handleBlur, handleSubmit, values, touched, errors, isValid }) => (
                  <>
                    <View className="space-y-4 mb-4">
                      <Text className="text-gray-600 text-center text-base leading-6">
                        {t("password.enterCodeSentTo")} <Text className="font-semibold">{emailForReset}</Text>
                      </Text>
                    </View>

                    {/* Code field */}
                    <View className="space-y-2">
                      <Text className="text-black text-lg font-semibold">{t("password.code")}</Text>
                      <View className="bg-gray-100 rounded-full p-3 flex-row items-center space-x-1 shadow-md">
                        <MaterialCommunityIcons name="numeric" size={24} color="gray" />
                        <TextInput
                          className="w-full"
                          placeholder={t("password.codePlaceholder")}
                          onChangeText={handleChange("code")}
                          onBlur={handleBlur("code")}
                          value={values.code}
                          keyboardType="number-pad"
                          editable={!loading}
                        />
                      </View>
                      {errors.code && touched.code && (
                        <Text className="text-red-500 text-sm">{errors.code}</Text>
                      )}
                    </View>

                    {/* New password */}
                    <View className="space-y-2 mt-4">
                      <Text className="text-black text-lg font-semibold">{t("password.newPassword")}</Text>
                      <View className="bg-gray-100 rounded-full p-3 flex-row items-center space-x-1 shadow-md relative">
                        <Feather name="lock" size={24} color="gray" />
                        <TextInput
                          className="flex-1"
                          placeholder={t("password.newPasswordPlaceholder")}
                          onChangeText={handleChange("newPassword")}
                          onBlur={handleBlur("newPassword")}
                          value={values.newPassword}
                          secureTextEntry={!showNewPassword}
                          editable={!loading}
                        />
                        <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 p-1">
                          <Feather name={showNewPassword ? "eye" : "eye-off"} size={24} color="gray" />
                        </TouchableOpacity>
                      </View>
                      {errors.newPassword && touched.newPassword && (
                        <Text className="text-red-500 text-sm">{errors.newPassword}</Text>
                      )}
                    </View>

                    {/* Confirm password */}
                    <View className="space-y-2 mt-4">
                      <Text className="text-black text-lg font-semibold">{t("password.confirmPassword")}</Text>
                      <View className="bg-gray-100 rounded-full p-3 flex-row items-center space-x-1 shadow-md relative">
                        <Feather name="lock" size={24} color="gray" />
                        <TextInput
                          className="flex-1"
                          placeholder={t("password.confirmPasswordPlaceholder")}
                          onChangeText={handleChange("confirmPassword")}
                          onBlur={handleBlur("confirmPassword")}
                          value={values.confirmPassword}
                          secureTextEntry={!showConfirmPassword}
                          editable={!loading}
                        />
                        <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 p-1">
                          <Feather name={showConfirmPassword ? "eye" : "eye-off"} size={24} color="gray" />
                        </TouchableOpacity>
                      </View>
                      {errors.confirmPassword && touched.confirmPassword && (
                        <Text className="text-red-500 text-sm">{errors.confirmPassword}</Text>
                      )}
                    </View>

                    <View className="space-y-3 mt-6">
                      <TouchableOpacity onPress={handleSubmit} disabled={loading || !isValid}>
                        <View className={`${loading || !isValid ? "bg-gray-400" : "bg-secondary"} w-full rounded-full py-3`}>
                          <Text className="text-white text-xl text-center font-bold">
                            {loading ? t("password.verifying") : t("password.resetPassword")}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setStep('email')}>
                        <View className="bg-gray-200 w-full rounded-full py-3 px-6">
                          <Text className="text-gray-700 text-lg text-center font-bold">
                            {t("password.resendCode")}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </Formik>
            )}

            <View className="flex-row items-center justify-center space-x-2 px-6 ">
              <Text className="text-lg text-gray-400">
                {t("password.alreadyHaveAccount")}
              </Text>
              <Text
                className="text-secondary text-lg font-semibold"
                onPress={() => setShow("Login")}
              >
                {t("password.logIn")}
              </Text>
            </View>
            <View className="flex-row items-center justify-center space-x-2 px-6 ">
              <Text className="text-lg text-gray-400">
                {t("password.dontHaveAccount")}
              </Text>
              <Text
                className="text-secondary text-lg font-semibold"
                onPress={() => setShow("Register")}
              >
                {t("password.signUp")}
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
