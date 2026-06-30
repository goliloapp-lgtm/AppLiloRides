import React, { useState, useEffect } from "react";
import { View, Text, Image, TouchableOpacity, Platform, ScrollView } from "react-native";
import { useGoogleAuth } from "../../lib/googleAuth";
import { useAppleAuth } from "../../lib/appleAuth";
import * as AppleAuthentication from 'expo-apple-authentication';
import Toast from "react-native-toast-message";
import { useTranslation } from "../../hooks/useTranslation";
import Login from "./Login";
import Register from "./Register";
import Password from "./Password";

export default function Auth() {
  const [show, setShow] = useState("Auth");
  
  
  return (
    <View className="flex-1 min-h-screen bg-gray-100 ">
      {show === "Auth" && <AuthForm setShow={setShow} />}
      {show === "Login" && <Login setShow={setShow} />}
      {show === "Register" && <Register setShow={setShow} />}
      {show === "Password" && <Password setShow={setShow} />}
    </View>
  );
}

function AuthForm(props) {
  const { user, loading: googleLoading, signIn: googleSignIn } = useGoogleAuth();
  const { signInWithApple } = useAppleAuth();
  const [loading, setLoading] = useState(false);
  const [isAppleSignInAvailable, setIsAppleSignInAvailable] = useState(false);
  const { setShow } = props;
  const { t } = useTranslation("auth");

  useEffect(() => {
    async function checkAppleSignInAvailability() {
      if (Platform.OS === 'ios') {
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        console.log('[Auth.js] Apple Sign-In available on this device:', isAvailable);
        setIsAppleSignInAvailable(isAvailable);
      }
    }
    checkAppleSignInAvailability();
  }, []);

  const onAppleLogin = async () => {
    setLoading(true);
    try {
      const result = await signInWithApple();
      if (result && !result.success && result.error) {
        Toast.show({
          type: 'error',
          text1: result.error,
        });
      }
    } catch (e) {
      console.error('Unexpected error in onAppleLogin:', e);
      Toast.show({
        type: 'error',
        text1: 'An error occurred. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const onGoogleLogin = async () => {
    setLoading(true);
    try {
      await googleSignIn();
    } catch (e) {
      console.error('Unexpected error in onGoogleLogin:', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView 
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
      className="bg-gray-100"
    >
      <View className="flex-1">
        <Image
          source={{
            uri: `https://firebasestorage.googleapis.com/v0/b/lilo-23fef.firebasestorage.app/o/IMG-Auth-logo-azul.png?alt=media&token=f83c00e2-014c-430a-8145-88115dfddf78`,
          }}
          className="h-80 w-full"
          resizeMode="contain"
        />
        <View className="p-6 flex-1 justify-between pb-8">
          <View className="mb-6 space-y-2">
            <Text className="font-bold text-black text-3xl text-center">
              {t("auth.welcome")}
            </Text>
            <Text className="text-gray-400 text-xl text-center">
              {t("auth.signUpOrLogin")}
            </Text>
          </View>
          <View className="space-y-3 mb-6">
            <TouchableOpacity onPress={() => setShow("Register")} disabled={loading}>
              <View className="bg-secondary w-full rounded-lg py-3">
                <Text className="text-white text-xl text-center font-bold">
                  {t("auth.signUp")}
                </Text>
              </View>
            </TouchableOpacity>
            <View className="flex-row items-center justify-center space-x-2 px-6">
              <View className="h-[1px] bg-gray-400 w-1/2" />
              <Text className="text-black">{t("login.or")}</Text>
              <View className="h-[1px] bg-gray-400 w-1/2" />
            </View>
            <TouchableOpacity onPress={onGoogleLogin} disabled={loading}>
              <View className="bg-white flex-row space-x-3 items-center justify-center w-full border border-gray-400 rounded-lg py-3">
                <Image
                  source={{
                    uri: `https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/2048px-Google_%22G%22_logo.svg.png`,
                  }}
                  className="h-5 w-5"
                />
                <Text className="text-black text-xl text-center font-bold">
                  {t("auth.signUpWithGoogle")}
                </Text>
              </View>
            </TouchableOpacity>
            {Platform.OS === 'ios' && isAppleSignInAvailable && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={8}
                style={{ width: '100%', height: 44, marginTop: 16 }}
                onPress={onAppleLogin}
                disabled={loading}
              />
            )}
          </View>
          <View className="flex-row items-center justify-center space-x-2 px-6 ">
            <Text className="text-lg text-gray-400">
              {t("auth.alreadyHaveAccount")}
            </Text>
            <Text
              className="text-secondary text-lg font-semibold"
              onPress={() => setShow("Login")}
            >
              {t("auth.logIn")}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
