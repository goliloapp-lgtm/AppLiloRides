import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from "react-native";
import Toast from "react-native-toast-message";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Formik } from "formik";
import * as yup from "yup";
import { loginUser, reactivateUserAccount } from "../../lib/auth";
import { useGoogleAuth } from "../../lib/googleAuth";
import { useAppleAuth } from "../../lib/appleAuth"; // Import useAppleAuth
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { useTranslation } from "../../hooks/useTranslation";
import * as AppleAuthentication from 'expo-apple-authentication'; // Import AppleAuthentication

import { KeyboardAvoidingView, Platform } from "react-native";

export default function Login(props) {
  const { setShow } = props;
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [disabledEmail, setDisabledEmail] = useState(null); // for reactivation
  const [reactivating, setReactivating] = useState(false);
  const { user, signIn } = useGoogleAuth();
  const { signInWithApple } = useAppleAuth(); // Use Apple Auth hook
  const { t } = useTranslation("auth");

  const [isAppleSignInAvailable, setIsAppleSignInAvailable] = useState(false); // State for Apple Sign-In availability

  useEffect(() => {
    // Check if Apple Sign-In is available on component mount
    async function checkAppleSignInAvailability() {
      if (Platform.OS === 'ios') {
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        console.log('[Login.js] Apple Sign-In available on this device:', isAvailable);
        setIsAppleSignInAvailable(isAvailable);
      }
    }
    checkAppleSignInAvailability();
  }, []);

  const onLogin = async (values) => {
    try {
      setLoading(true);

      const result = await loginUser(values.email, values.password);

      if (!result.success) {
        if (result.errorCode === 'auth/google-linked-account') {
          Alert.alert(
            "Cuenta Vinculada a Google",
            "Esta cuenta usa 'Continuar con Google'. ¿Cómo quieres proceder?",
            [
              {
                text: "Continuar con Google",
                onPress: () => signIn(),
              },
              {
                text: "Restablecer Contraseña",
                onPress: async () => {
                  setLoading(true);
                  const resetResult = await resetPassword(values.email);
                  if (resetResult.success) {
                    Toast.show({
                      type: 'success',
                      text1: "Se ha enviado un correo para restablecer tu contraseña.",
                    });
                  } else {
                    Toast.show({
                      type: 'error',
                      text1: resetResult.error,
                    });
                  }
                  setLoading(false);
                },
              },
              {
                text: "Cancelar",
                style: "cancel",
              },
            ]
          );
        } else if (result.error?.includes('disabled') || result.errorCode === 'auth/user-disabled') {
          // Account is disabled → offer reactivation
          setDisabledEmail(values.email);
          Toast.show({
            type: 'error',
            text1: t('login.accountDisabled'),
          });
        } else {
          // Original behavior for other errors
          Toast.show({
            type: "error",
            text1: result.error,
          });
        }
        setLoading(false);
        return;
      }
      // Obtener el uuid del usuario autenticado
      const auth = getAuth();
      const uuid = auth.currentUser?.uid;
      if (uuid) {
        const db = getFirestore();
        const userRef = doc(db, "users", uuid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          if (!userData.isActive) {
            Toast.show({
              type: "error",
              text1: t("login.accountDisabled"),
            });

            setLoading(false);
            return;
          }
          // Si isActive es true, puedes continuar
        }
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("login.unexpectedError"),
      });
    } finally {
      setLoading(false);
    }
  };

  // Apple Login handler
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

  const getLoginValidationSchema = () => {
    return yup.object().shape({
      email: yup
        .string()
        .email(t("validation.emailInvalid"))
        .required(t("validation.emailRequired")),
      password: yup
        .string()
        .required(t("validation.passwordRequired"))
        .min(6, t("validation.passwordMinLength")),
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <View className="flex-1">
        <View className="h-1/3 w-full relative mt-0 pt-0" pointerEvents="box-none">
          <Image
            source={{
              uri: `https://firebasestorage.googleapis.com/v0/b/lilo-23fef.firebasestorage.app/o/Welcome-fondo.png?alt=media&token=de171027-14e1-47d4-b179-54ea536097df`,
            }}
            className="absolute inset-0 w-full h-full"
            resizeMode="contain"
            style={{ zIndex: 0, alignSelf: "center", marginTop: -23 }}
          />
          <Text
            className="text-gray-700 font-bold text-3xl absolute bottom-16 left-6"
            style={{ zIndex: 1 }}
          >
            {t("login.title")}
          </Text>
        </View>
        <ScrollView 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        >
          <View className="p-6">
            <Formik
              initialValues={{ email: "", password: "" }}
              validateOnMount={true}
              validationSchema={getLoginValidationSchema()}
              onSubmit={(values) => onLogin(values)}
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
                        {t("login.email")}
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
                          placeholder={t("login.email")}
                          onChangeText={handleChange("email")}
                          onBlur={handleBlur("email")}
                          value={values.email}
                          autoCapitalize="none"
                          keyboardType="email-address"
                        />
                      </View>
                      {errors.email && touched.email && (
                        <Text className="text-red-500 text-sm">{errors.email}</Text>
                      )}
                    </View>

                    {/* Contraseña */}
                    <View style={{ gap: 8 }}>
                      <Text className="text-black text-lg font-semibold">
                        {t("login.password")}
                      </Text>
                      <View className="bg-gray-100 rounded-lg p-3 flex-row items-center space-x-3 shadow-md relative">
                        <Feather name="lock" size={24} color="gray" />
                        <TextInput
                          placeholderTextColor={"#000000"}
                          className="flex-1 text-black ml-2"
                          onChangeText={handleChange("password")}
                          onBlur={handleBlur("password")}
                          value={values.password}
                          placeholder={t("login.password")}
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
                  </View>

                  <View style={{ gap: 16, marginTop: 32 }}>
                    <TouchableOpacity
                      onPress={handleSubmit}
                      disabled={loading || !isValid}
                    >
                      <View
                        className={`${
                          loading || !isValid ? "bg-gray-400" : "bg-secondary"
                        } w-full rounded-lg py-3`}
                      >
                        <Text className="text-white text-xl text-center font-bold">
                          {loading ? t("login.loading") : t("login.login")}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <View className="flex-row items-center justify-center space-x-2 px-6">
                      <View className="h-[1px] bg-gray-400 w-1/2" />
                      <Text className="text-black">{t("login.or")}</Text>
                      <View className="h-[1px] bg-gray-400 w-1/2" />
                    </View>
                    <TouchableOpacity
                      onPress={signIn}
                    >
                      <View className="bg-white flex-row space-x-3 items-center justify-center w-full border border-gray-400 rounded-lg py-3">
                        <Image
                          source={{
                            uri: `https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/2048px-Google_%22G%22_logo.svg.png`,
                          }}
                          className="h-5 w-5"
                        />
                        <Text className="text-black text-xl text-center font-bold">
                          {t("login.continueWithGoogle")}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {/* Apple Sign-In Button */}
                    {Platform.OS === 'ios' && isAppleSignInAvailable && (
                      <AppleAuthentication.AppleAuthenticationButton
                        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                        cornerRadius={8}
                        style={{ width: '100%', height: 44, marginTop: 0 }}
                        onPress={onAppleLogin}
                        disabled={loading}
                      />
                    )}
                  </View>
                </>
              )}
            </Formik>
            {/* ── Reactivation Banner ───────────────────────────────── */}
            {disabledEmail && (
              <View style={{ backgroundColor: '#FEF3C7', borderRadius: 12, padding: 16, marginTop: 8 }}>
                <Text style={{ color: '#92400E', fontWeight: 'bold', textAlign: 'center', marginBottom: 4 }}>
                  {t('login.accountDisabled')}
                </Text>
                <TouchableOpacity
                  disabled={reactivating}
                  onPress={async () => {
                    setReactivating(true);
                    const result = await reactivateUserAccount(disabledEmail);
                    setReactivating(false);
                    if (result.success) {
                      setDisabledEmail(null);
                      Toast.show({ type: 'success', text1: t('login.reactivateSuccess') });
                    } else {
                      Toast.show({ type: 'error', text1: result.error ?? t('login.reactivateError') });
                    }
                  }}
                >
                  <View style={{ backgroundColor: reactivating ? '#D1D5DB' : '#F59E0B', borderRadius: 8, paddingVertical: 10, marginTop: 8 }}>
                    <Text style={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}>
                      {reactivating ? t('login.reactivating') : t('login.reactivate')}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}


            <View className="flex-row items-center justify-center space-x-2 px-6 mt-8">
              <Text className="text-lg text-gray-400">{t("login.forgotPassword")}</Text>
              <Text
                className="text-secondary text-lg font-semibold"
                onPress={() => setShow("Password")}
              >
                {t("login.recoverPassword")}
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
