import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  Modal,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import Ionicons from "@expo/vector-icons/Ionicons";
import Toast from "react-native-toast-message";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Formik } from "formik";
import * as yup from "yup";
import { registerUser } from "../../lib/auth";
import { sendWelcomeEmail } from "../../lib/auth";
import { useGoogleAuth } from "../../lib/googleAuth";
import { useAppleAuth } from "../../lib/appleAuth";
import * as AppleAuthentication from 'expo-apple-authentication';
import { useTranslation } from "../../hooks/useTranslation";
import { useAuth } from "../../lib/context/AuthContext";

import { KeyboardAvoidingView } from "react-native";

export default function Register(props) {
  const { setShow } = props;
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { user, signIn } = useGoogleAuth();
  const { signInWithApple } = useAppleAuth();
  const { t } = useTranslation("auth");
  const { setUser } = useAuth();
  
  const [isAppleSignInAvailable, setIsAppleSignInAvailable] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showShortTermsModal, setShowShortTermsModal] = useState(false);
  const [showFullTermsModal, setShowFullTermsModal] = useState(false);

  useEffect(() => {
    async function checkAppleSignInAvailability() {
      if (Platform.OS === 'ios') {
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        console.log('[Register.js] Apple Sign-In available on this device:', isAvailable);
        setIsAppleSignInAvailable(isAvailable);
      }
    }
    checkAppleSignInAvailability();
  }, []);
  

  const register = async (values) => {
    if (!termsAccepted) {
      Toast.show({
        type: "error",
        text1: t("register.mustAgree"),
      });
      return;
    }

    try {
      setLoading(true);

      const termsMetadata = {
        acceptedAt: new Date().toISOString(),
        version: "June 2026",
        platform: Platform.OS,
        appName: "Lilo Passenger"
      };

      const result = await registerUser(
        values.email,
        values.password,
        values.name,
        values.phone,
        termsMetadata
      );

      if (result.success) {
        // Upon successful registration, update the global auth state.
        // The top-level navigator in App.js will handle showing the Home screen.
        setUser(result.user);
        // Send welcome email in background (non-blocking)
        sendWelcomeEmail(
          values.email,
          values.name,
          t.language || "en" // i18next instance is available via the 't' object or i18n import
        );
        Toast.show({
          type: "success",
          text1: t("register.accountCreated"),
        });
      } else {
        Toast.show({
          type: "error",
          text1: result.error,
        });
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("register.unexpectedError"),
      });
    } finally {
      setLoading(false);
    }
  };

  const onAppleLogin = async () => {
    setLoading(true);
    const result = await signInWithApple();
    if (!result.success) {
      Toast.show({
        type: 'error',
        text1: result.error,
      });
    }
    setLoading(false);
  };

  const getRegisterValidationSchema = () => {
    return yup.object().shape({
      email: yup
        .string()
        .email(t("validation.emailInvalid"))
        .required(t("validation.emailRequired")),
      name: yup.string().required(t("validation.nameRequired")),
      phone: yup
        .string()
        .required(t("validation.phoneRequired"))
        .matches(/^[+0-9]+$/, t("validation.phoneInvalid")),
      password: yup
        .string()
        .required(t("validation.passwordRequired"))
        .min(6, t("validation.passwordMinLength")),

      confirmPassword: yup
        .string()
        .required(t("validation.confirmPasswordRequired"))
        .oneOf([yup.ref("password"), null], t("validation.passwordsMustMatch")),
    });
  };

  

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <View className="flex-1 pb-12">
        <View className="h-1/3 w-full relative mt-0 pt-0" pointerEvents="box-none">
          <Image
            source={{
              uri: `https://firebasestorage.googleapis.com/v0/b/lilo-23fef.firebasestorage.app/o/Welcome-fondo.png?alt=media&token=de171027-14e1-47d4-b179-54ea536097df`,
            }}
            className="absolute inset-0 w-full h-full"
            resizeMode="contain"
            style={{ zIndex: 0, alignSelf: "center", marginTop: -15 }}
          />
          <Text
            className="text-gray-700 font-bold text-3xl absolute bottom-16 left-6"
            style={{ zIndex: 1 }}
          >
            {t("register.title")}
          </Text>
        </View>
        <ScrollView 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        >
          <View className="p-6 space-y-8">
            <Formik
              initialValues={{
                email: "",
                name: "",
                phone: "",
                password: "",
                confirmPassword: "",
              }}
              validateOnMount={true}
              validationSchema={getRegisterValidationSchema()}
              onSubmit={(values) => register(values)}
            >
              {({
                handleChange,
                handleBlur,
                handleSubmit,
                values,
                touched,
                errors,
                isValid,
              }) => (
                <>
                  <View style={{ gap: 24 }}>
                    {/* Correo Electrónico */}
                    <View style={{ gap: 8 }}>
                      <Text className="text-black text-lg font-semibold">
                        {t("register.email")}
                      </Text>
                      <View className="bg-gray-100 rounded-lg p-3 flex-row items-center space-x-3 shadow-md">
                        <MaterialCommunityIcons
                          name="email-outline"
                          size={24}
                          color="gray"
                        />
                        <TextInput
                          placeholderTextColor={"#000000"}
                          className="flex-1 text-black ml-2"
                          placeholder={t("register.email")}
                          name="email"
                          onChangeText={handleChange("email")}
                          onBlur={handleBlur("email")}
                          value={values.email}
                        />
                      </View>
                      {errors.email && touched.email && (
                        <Text className="text-red-500 text-sm">{errors.email}</Text>
                      )}
                    </View>

                    {/* Nombre */}
                    <View style={{ gap: 8 }}>
                      <Text className="text-black text-lg font-semibold">
                        {t("register.name")}
                      </Text>
                      <View className="bg-gray-100 rounded-lg p-3 flex-row items-center space-x-3 shadow-md">
                        <Feather name="user" size={24} color="gray" />
                        <TextInput
                          placeholderTextColor={"#000000"}
                          className="flex-1 text-black ml-2"
                          placeholder={t("register.name")}
                          name="name"
                          onChangeText={handleChange("name")}
                          onBlur={handleBlur("name")}
                          value={values.name}
                        />
                      </View>
                      {errors.name && touched.name && (
                        <Text className="text-red-500 text-sm">{errors.name}</Text>
                      )}
                    </View>

                    {/* Teléfono */}
                    <View style={{ gap: 8 }}>
                      <Text className="text-black text-lg font-semibold">
                        {t("register.phone")}
                      </Text>
                      <View className="bg-gray-100 rounded-lg p-3 flex-row items-center space-x-3 shadow-md">
                        <Feather name="phone" size={24} color="gray" />
                        <TextInput
                          placeholderTextColor={"#000000"}
                          className="flex-1 text-black ml-2"
                          placeholder={t("register.phone")}
                          name="phone"
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

                    {/* Contraseña */}
                    <View style={{ gap: 8 }}>
                      <Text className="text-black text-lg font-semibold">
                        {t("register.password")}
                      </Text>
                      <View className="bg-gray-100 rounded-lg p-3 flex-row items-center space-x-3 shadow-md relative">
                        <Feather name="lock" size={24} color="gray" />
                        <TextInput
                          placeholderTextColor={"#000000"}
                          className="flex-1 text-black ml-2"
                          name="password"
                          onChangeText={handleChange("password")}
                          onBlur={handleBlur("password")}
                          value={values.password}
                          placeholder={t("register.password")}
                          secureTextEntry={!showPassword}
                        />
                        <TouchableOpacity
                          onPress={() => setShowPassword(!showPassword)}
                          className="absolute right-3 p-1"
                        >
                          <Feather
                            name={showPassword ? "eye" : "eye-off"}
                            size={24}
                            color="gray"
                          />
                        </TouchableOpacity>
                      </View>
                      {errors.password && touched.password && (
                        <Text className="text-red-500 text-sm">{errors.password}</Text>
                      )}
                    </View>

                    {/* Confirmar Contraseña */}
                    <View style={{ gap: 8 }}>
                      <Text className="text-black text-lg font-semibold">
                        {t("register.confirmPassword")}
                      </Text>
                      <View className="bg-gray-100 rounded-lg p-3 flex-row items-center space-x-3 shadow-md relative">
                        <Feather name="lock" size={24} color="gray" />
                        <TextInput
                          placeholderTextColor={"#000000"}
                          className="flex-1 text-black ml-2"
                          name="confirmPassword"
                          onChangeText={handleChange("confirmPassword")}
                          onBlur={handleBlur("confirmPassword")}
                          value={values.confirmPassword}
                          placeholder={t("register.confirmPassword")}
                          secureTextEntry={!showConfirmPassword}
                        />
                        <TouchableOpacity
                          onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 p-1"
                        >
                          <Feather
                            name={showConfirmPassword ? "eye" : "eye-off"}
                            size={24}
                            color="gray"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {/* Checkbox de Términos y Condiciones */}
                  <View className="flex-row items-center mt-6 space-x-2 pr-6">
                      <TouchableOpacity
                        onPress={() => setTermsAccepted(!termsAccepted)}
                        className="h-6 w-6 border-2 border-gray-400 rounded flex items-center justify-center bg-gray-50"
                      >
                        {termsAccepted && (
                          <Ionicons name="checkmark" size={18} color="#2B9DD9" />
                        )}
                      </TouchableOpacity>
                      <View className="flex-row flex-wrap items-center flex-1 ml-3">
                        <Text className="text-gray-600 text-sm">
                          {t("register.iAgreeTo")}{" "}
                        </Text>
                        <TouchableOpacity onPress={() => setShowShortTermsModal(true)}>
                          <Text className="text-secondary text-sm font-semibold underline">
                            {t("register.termsOfService")}
                          </Text>
                        </TouchableOpacity>
                        <Text className="text-gray-600 text-sm">
                          {" "}{t("register.and")}{" "}
                        </Text>
                        <TouchableOpacity onPress={() => setShowShortTermsModal(true)}>
                          <Text className="text-secondary text-sm font-semibold underline">
                            {t("register.privacyPolicy")}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                  <View style={{ gap: 16, marginTop: 32 }}>
                    <TouchableOpacity
                      onPress={handleSubmit}
                      disabled={loading || !isValid || !termsAccepted}
                    >
                      <View
                        className={`${
                          loading || !isValid || !termsAccepted ? "bg-gray-400" : "bg-secondary"
                        } w-full rounded-lg py-3`}
                      >
                        <Text className="text-white text-xl text-center font-bold">
                          {loading ? t("register.register") + "..." : t("register.register")}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <View className="flex-row items-center justify-center space-x-2 px-6">
                      <View className="h-[1px] bg-gray-400 w-1/2" />
                      <Text className="text-black">{t("register.or")}</Text>
                      <View className="h-[1px] bg-gray-400 w-1/2" />
                    </View>
                    <TouchableOpacity
                      onPress={signIn}
                      disabled={loading}
                    >
                      <View className="bg-white flex-row space-x-3 items-center justify-center w-full border border-gray-400 rounded-lg py-3">
                        <Image
                          source={{
                            uri: `https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/2048px-Google_%22G%22_logo.svg.png`,
                          }}
                          className="h-5 w-5"
                        />
                        <Text className="text-black text-xl text-center font-bold">
                          {t("register.continueWithGoogle")}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {Platform.OS === 'ios' && isAppleSignInAvailable && (
                      <AppleAuthentication.AppleAuthenticationButton
                        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                        cornerRadius={8}
                        style={{ width: '100%', height: 44, marginTop: 10 }}
                        onPress={onAppleLogin}
                        disabled={loading}
                      />
                    )}
                  </View>
                </>
              )}
            </Formik>

            <View className="flex-row items-center justify-center space-x-2 px-6 ">
              <Text className="text-lg text-gray-400">
                {t("register.alreadyHaveAccount")}
              </Text>
              <Text
                className="text-secondary text-lg font-semibold"
                onPress={() => setShow("Login")}
              >
                {t("register.signIn")}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Short Version Terms Modal */}
        <Modal visible={showShortTermsModal} transparent animationType="fade" onRequestClose={() => setShowShortTermsModal(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 24, width: '100%', maxHeight: '80%' }}>
              <Text className="text-xl font-bold text-gray-800 mb-4 text-center">
                {t("register.termsShortTitle")}
              </Text>
              <ScrollView className="mb-6">
                <Text className="text-gray-600 text-base leading-6">
                  {t("register.termsShortDesc")}
                </Text>
              </ScrollView>
              <View className="space-y-3">
                <TouchableOpacity
                  onPress={() => {
                    setTermsAccepted(true);
                    setShowShortTermsModal(false);
                  }}
                  className="bg-secondary rounded-lg py-3"
                >
                  <Text className="text-white text-center font-bold text-lg">
                    {t("register.confirmDelete") /* "I Agree" / Confirm */}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setShowShortTermsModal(false);
                    setShowFullTermsModal(true);
                  }}
                  className="border border-secondary rounded-lg py-3"
                >
                  <Text className="text-secondary text-center font-bold text-lg">
                    {t("register.readFullTerms")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowShortTermsModal(false)} className="py-2">
                  <Text className="text-gray-500 text-center font-semibold text-base">
                    {t("register.close")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Full Version Terms Modal */}
        <Modal visible={showFullTermsModal} transparent animationType="slide" onRequestClose={() => setShowFullTermsModal(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 24, width: '100%', maxHeight: '90%' }}>
              <Text className="text-xl font-bold text-gray-800 mb-4 text-center">
                {t("register.termsFullTitle")}
              </Text>
              <ScrollView className="mb-6">
                <Text className="font-bold text-gray-700 mt-2 text-base">{t("register.termsTitle")}</Text>
                <Text className="text-gray-500 text-sm mb-4">{t("register.termsEffectiveDate")}</Text>
                
                <Text className="font-semibold text-gray-700 mt-3 text-base">{t("register.termsSec1Title")}</Text>
                <Text className="text-gray-600 text-sm mb-3">{t("register.termsSec1Desc")}</Text>
                
                <Text className="font-semibold text-gray-700 mt-3 text-base">{t("register.termsSec2Title")}</Text>
                <Text className="text-gray-600 text-sm mb-3">{t("register.termsSec2Desc")}</Text>
                
                <Text className="font-semibold text-gray-700 mt-3 text-base">{t("register.termsSec3Title")}</Text>
                <Text className="text-gray-600 text-sm mb-3">{t("register.termsSec3Desc")}</Text>
                
                <Text className="font-semibold text-gray-700 mt-3 text-base">{t("register.termsSec4Title")}</Text>
                <Text className="text-gray-600 text-sm mb-3">{t("register.termsSec4Desc")}</Text>
                
                <Text className="font-semibold text-gray-700 mt-3 text-base">{t("register.termsSec5Title")}</Text>
                <Text className="text-gray-600 text-sm mb-3">{t("register.termsSec5Desc")}</Text>
                
                <Text className="font-semibold text-gray-700 mt-3 text-base">{t("register.termsSec6Title")}</Text>
                <Text className="text-gray-600 text-sm mb-3">{t("register.termsSec6Desc")}</Text>
                
                <Text className="font-semibold text-gray-700 mt-3 text-base">{t("register.termsSec7Title")}</Text>
                <Text className="text-gray-600 text-sm mb-3">{t("register.termsSec7Desc")}</Text>
                
                <Text className="font-semibold text-gray-700 mt-3 text-base">{t("register.termsSec8Title")}</Text>
                <Text className="text-gray-600 text-sm mb-3">{t("register.termsSec8Desc")}</Text>

                <Text className="font-semibold text-gray-700 mt-3 text-base">{t("register.termsSec9Title")}</Text>
                <Text className="text-gray-600 text-sm mb-3">{t("register.termsSec9Desc")}</Text>
                
                <Text className="font-semibold text-gray-700 mt-3 text-base">{t("register.termsSec10Title")}</Text>
                <Text className="text-gray-600 text-sm mb-4">{t("register.termsSec10Desc")}</Text>
              </ScrollView>
              <View className="flex-row space-x-3">
                <TouchableOpacity
                  onPress={() => {
                    setTermsAccepted(true);
                    setShowFullTermsModal(false);
                  }}
                  className="flex-1 bg-secondary rounded-lg py-3"
                >
                  <Text className="text-white text-center font-bold text-lg">
                    {t("register.termsAccept")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setShowFullTermsModal(false);
                    setShowShortTermsModal(true);
                  }}
                  className="border border-gray-400 rounded-lg py-3 px-4"
                >
                  <Text className="text-gray-600 text-center font-bold text-lg">
                    {t("register.termsBack")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

