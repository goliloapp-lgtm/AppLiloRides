import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  View,
  Text,
  Image,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/context/AuthContext";
import { useProfile } from "../../lib/context/ProfileContext";
import { useTranslation } from "../../hooks/useTranslation";
import ProfileForm from "../../components/ProfileForm";
import {
  requestAccountDeletionCode,
  confirmAccountDeletion,
  logoutUser,
} from "../../lib/auth";
import ReactNativeModal from "react-native-modal";
import Toast from "react-native-toast-message";
import * as ImagePicker from "expo-image-picker";
import { uploadProfileImage } from "../../lib/storage";

export default function Profile() {
  const { user, setUser } = useAuth();
  const { t, i18n } = useTranslation("profile");

  const {
    profileData,
    loading: profileLoading,
    updateProfile,
    hasProfile,
    isFirstTime,
  } = useProfile();

  const handleProfileSubmit = async (values: any) => {
    return await updateProfile(values);
  };

  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const handleImagePick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsUploadingImage(true);
        const localUri = result.assets[0].uri;
        const newPhotoURL = await uploadProfileImage(localUri);

        setUser({
          ...user!,
          photoURL: newPhotoURL,
        });

        // Update Firestore user document for consistency
        await updateProfile({
          profilePhoto: newPhotoURL,
          photoURL: newPhotoURL,
        });

        Toast.show({
          type: "success",
          text1: t("messages.profileUpdated") || "Profile picture updated",
        });
      }
    } catch (error: any) {
      console.error("Image upload failed:", error);
      Toast.show({
        type: "error",
        text1: t("messages.unexpectedError") || "Failed to upload image",
        text2: error?.message || String(error),
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const [isDeletionModalVisible, setDeletionModalVisible] = useState(false);
  const [deletionCode, setDeletionCode] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteRequest = () => {
    Alert.alert(
      t("messages.deleteConfirmationTitle"),
      t("messages.deleteConfirmationDetail"),
      [
        { text: t("messages.cancel"), style: "cancel" },
        {
          text: t("messages.confirmDelete"),
          style: "destructive",
          onPress: async () => {
            try {
              setIsDeleting(true);
              const result = await requestAccountDeletionCode(
                i18n.language || "en",
              );
              if (result.success) {
                setDeletionModalVisible(true);
                Toast.show({
                  type: "info",
                  text1: t("messages.deletionCodeSent"),
                });
              } else {
                Toast.show({ type: "error", text1: result.error });
              }
            } catch (error) {
              Toast.show({
                type: "error",
                text1: t("messages.unexpectedError"),
              });
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  };

  const handleConfirmDeletion = async () => {
    if (!deletionCode || deletionCode.length < 6) {
      Toast.show({ type: "error", text1: "Please enter the 6-digit code" });
      return;
    }

    try {
      setIsDeleting(true);
      const result = await confirmAccountDeletion(user?.uid, deletionCode);
      if (result.success) {
        setDeletionModalVisible(false);
        Toast.show({
          type: "success",
          text1: t("messages.accountDeleted"),
        });
        await logoutUser();
      } else {
        Toast.show({ type: "error", text1: result.error });
      }
    } catch (error) {
      Toast.show({ type: "error", text1: t("messages.unexpectedError") });
    } finally {
      setIsDeleting(false);
    }
  };

  if (profileLoading) {
    return (
      <View className="bg-blue-400 px-6 min-h-screen justify-center items-center">
        <ActivityIndicator size="large" color="#2B9DD9" />
        <Text className="text-gray-600 mt-4 text-lg">{t("loading")}</Text>
      </View>
    );
  }

  return (
    <>
      <View className="flex-row bg-secondary items-center pt-12 justify-between px-3">
        <View className="flex-row items-center">
          <View className="h-14 w-14 rounded-lg">
            <Image
              source={{
                uri: `https://firebasestorage.googleapis.com/v0/b/lilo-23fef.firebasestorage.app/o/IMG-Auth-logo-white.png?alt=media&token=b7a62226-856a-4ef0-9924-758576334bf5`,
              }}
              className="h-full w-full"
            />
          </View>
          <Text className="text-white font-bold text-lg">{t("header")}</Text>
        </View>
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="bg-gray-100 px-6 pb-14">
            <View className="flex-row items-center justify-between mt-12 mb-5" />
            <View className="flex-row items-center justify-center mb-5">
              <View className="shadow-md border-4 border-white rounded-full relative">
                <TouchableOpacity
                  onPress={handleImagePick}
                  disabled={isUploadingImage}
                >
                  <Image
                    source={{
                      uri:
                        profileData?.profilePhoto ||
                        profileData?.photoURL ||
                        user?.photoURL ||
                        `https://firebasestorage.googleapis.com/v0/b/creative-feel-agency.appspot.com/o/lilo%2FIMG-Login-register.png?alt=media&token=51305e7e-443b-4057-9566-381f79f34851`,
                    }}
                    className="h-24 w-24 rounded-full"
                  />
                  <View className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-2 border-2 border-white">
                    <Ionicons name="camera" size={14} color="white" />
                  </View>
                  {isUploadingImage && (
                    <View className="absolute inset-0 bg-black/50 rounded-full justify-center items-center h-24 w-24">
                      <ActivityIndicator size="small" color="#ffffff" />
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {isFirstTime && (
              <View className="bg-blue-50 p-4 rounded-lg mb-5">
                <Text className="text-blue-800 text-center font-semibold">
                  {t("completeProfile")}
                </Text>
              </View>
            )}

            <ProfileForm
              profileData={profileData}
              userEmail={user?.email}
              onSubmit={handleProfileSubmit}
              hasProfile={hasProfile}
            />

            <TouchableOpacity
              onPress={async () => {
                const result = await logoutUser();
                if (!result.success) {
                  Alert.alert(
                    "Error",
                    result.error || "There was an error signing out",
                  );
                }
              }}
              className="mt-8 mb-5 items-center"
            >
              <Text className="text-red-500 text-lg font-bold">
                {t("Logout") || "Cerrar sesión"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ReactNativeModal
        isVisible={isDeletionModalVisible}
        onBackdropPress={() => !isDeleting && setDeletionModalVisible(false)}
        className="m-0 justify-end"
      >
        <View className="bg-white p-6 rounded-t-3xl min-h-[40%]">
          <Text className="text-2xl font-bold text-gray-800 mb-2">
            {t("messages.enterDeletionCode")}
          </Text>
          <Text className="text-gray-500 mb-6">
            {t("messages.deletionCodeInstructions")}
          </Text>

          <TextInput
            className="bg-gray-100 p-4 rounded-xl text-center text-2xl tracking-[10px] font-bold mb-6"
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            value={deletionCode}
            onChangeText={setDeletionCode}
            editable={!isDeleting}
          />

          <TouchableOpacity
            className={`py-4 rounded-xl items-center ${isDeleting ? "bg-gray-400" : "bg-red-500"}`}
            onPress={handleConfirmDeletion}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-lg">
                {t("messages.confirmDelete")}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className="mt-4 py-2 items-center"
            onPress={() => setDeletionModalVisible(false)}
            disabled={isDeleting}
          >
            <Text className="text-gray-500 font-semibold">
              {t("messages.cancel")}
            </Text>
          </TouchableOpacity>
        </View>
      </ReactNativeModal>
    </>
  );
}
