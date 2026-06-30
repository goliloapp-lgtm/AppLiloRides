import React, { useState, memo } from "react";
import { Formik } from "formik";
import { View, Text, TextInput, TouchableOpacity, Alert, Modal, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Feather from "@expo/vector-icons/Feather";
import Toast from "react-native-toast-message";
import * as yup from "yup";
import { getAuth, signOut } from "firebase/auth";
import { requestAccountDeletionCode, confirmAccountDeletion } from "../lib/auth";
import { useTranslation } from "../hooks/useTranslation";
import LanguageModal from "./LanguageModal";
import { UserProfile } from "../types";

interface ProfileFormProps {
  profileData: UserProfile | null;
  userEmail: string | null | undefined;
  onSubmit: (values: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  hasProfile: boolean;
}

const ProfileForm = memo(({ profileData, userEmail, onSubmit, hasProfile }: ProfileFormProps) => {
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation("profile");
  const { t: tAuth } = useTranslation("auth");
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  // Account deletion two-step state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteCode, setDeleteCode] = useState('');
  const [deletionRequested, setDeletionRequested] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Profile validation schema with translations - created dynamically
  const getProfileValidationSchema = () => {
    return yup.object().shape({
      firstName: yup.string().required(t("validation.firstNameRequired")),
      lastName: yup.string().required(t("validation.lastNameRequired")),
      email: yup
        .string()
        .email(t("validation.emailInvalid"))
        .required(t("validation.emailRequired")),
      phone: yup
        .string()
        .matches(/^[0-9+\-\s()]+$/, t("validation.phoneInvalid"))
        .min(10, t("validation.phoneMinLength")),
    });
  };

  const handleSubmitForm = async (values: any) => {
    try {
      setLoading(true);
      const result = await onSubmit(values);

      if (result.success) {
        Toast.show({
          type: "success",
          text1: t("messages.profileUpdated"),
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
        text1: t("messages.unexpectedError"),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Formik
      initialValues={{
        firstName: profileData?.firstName || "",
        lastName: profileData?.lastName || "",
        email: profileData?.email || userEmail || "",
        phone: profileData?.phone || "",
        isActive: true
      }}
      enableReinitialize={true}
      validateOnMount={true}
      validationSchema={getProfileValidationSchema()}
      onSubmit={handleSubmitForm}
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
          <View className="bg-white rounded-lg p-5 mb-5">
            <View className="space-y-2">
              <Text className="text-gray-400 text-lg font-bold">
                {t("form.firstName")}
              </Text>
              <View className="bg-gray-100 rounded-full py-3 px-5 flex-row items-center space-x-1 justify-between">
                <TextInput
                  className="flex-1"
                  placeholder={t("form.firstNamePlaceholder")}
                  placeholderTextColor="gray"
                  onChangeText={handleChange("firstName")}
                  onBlur={handleBlur("firstName")}
                  value={values.firstName}
                  autoCapitalize="words"
                  editable={!loading}
                />
                <Feather name="edit" size={24} color="gray" />
              </View>
              {errors.firstName && touched.firstName && (
                <Text className="text-red-500 text-sm ml-2">
                  {errors.firstName}
                </Text>
              )}
              <Text className="text-gray-400 text-lg font-bold">{t("form.lastName")}</Text>
              <View className="bg-gray-100 rounded-full py-3 px-5 flex-row items-center space-x-1 justify-between">
                <TextInput
                  className="flex-1"
                  placeholder={t("form.lastNamePlaceholder")}
                  placeholderTextColor="gray"
                  onChangeText={handleChange("lastName")}
                  onBlur={handleBlur("lastName")}
                  value={values.lastName}
                  autoCapitalize="words"
                  editable={!loading}
                />
                <Feather name="edit" size={24} color="gray" />
              </View>
              {errors.lastName && touched.lastName && (
                <Text className="text-red-500 text-sm ml-2">
                  {errors.lastName}
                </Text>
              )}
              <Text className="text-gray-400 text-lg font-bold">{t("form.email")}</Text>
              <View className="bg-gray-100 rounded-full py-3 px-5 flex-row items-center space-x-1 justify-between">
                <TextInput
                  className="flex-1"
                  placeholder={t("form.emailPlaceholder")}
                  placeholderTextColor="gray"
                  onChangeText={handleChange("email")}
                  onBlur={handleBlur("email")}
                  value={values.email}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading}
                />
                <Feather name="mail" size={24} color="gray" />
              </View>
              {errors.email && touched.email && (
                <Text className="text-red-500 text-sm ml-2">
                  {errors.email}
                </Text>
              )}
              <Text className="text-gray-400 text-lg font-bold">
                {t("form.phoneNumber")}
              </Text>
              <View className="bg-gray-100 rounded-full py-3 px-5 flex-row items-center space-x-1 justify-between">
                <TextInput
                  className="flex-1"
                  placeholder={t("form.phonePlaceholder")}
                  placeholderTextColor="gray"
                  onChangeText={handleChange("phone")}
                  onBlur={handleBlur("phone")}
                  value={values.phone}
                  autoCapitalize="none"
                  keyboardType="phone-pad"
                  editable={!loading}
                />
                <Feather name="phone" size={24} color="gray" />
              </View>
              {errors.phone && touched.phone && (
                <Text className="text-red-500 text-sm ml-2">
                  {errors.phone}
                </Text>
              )}
            </View>
          </View>
          <TouchableOpacity
            onPress={() => handleSubmit()}
            disabled={loading || !isValid}
          >
            <View
              className={`${
                loading || !isValid ? "bg-gray-400" : "bg-secondary"
              } w-full rounded-lg py-3 mb-3`}
            >
              <Text className="text-white text-xl text-center font-semibold">
                {loading
                  ? t("form.saving")
                  : hasProfile
                  ? t("form.updateProfile")
                  : t("form.createProfile")}
              </Text>
            </View>
          </TouchableOpacity>
          
          {/* Language Button */}
          <View className="bg-white rounded-xl shadow-sm mb-3">
            <TouchableOpacity
              onPress={() => setShowLanguageModal(true)}
              className="flex-row items-center p-4"
            >
              <Ionicons name="language-outline" size={24} color="#6B7280" />
              <Text className="flex-1 ml-4 text-gray-800 font-medium">
                {t("options.language")}
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Terms of Service Button */}
          <View className="bg-white rounded-xl shadow-sm mb-3">
            <TouchableOpacity
              onPress={() => setShowTermsModal(true)}
              className="flex-row items-center p-4"
            >
              <Ionicons name="document-text-outline" size={24} color="#6B7280" />
              <Text className="flex-1 ml-4 text-gray-800 font-medium">
                {t("options.termsOfService")}
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Delete Account Button */}
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                t("messages.deleteConfirmationTitle"),
                t("messages.deleteConfirmationDetail"),
                [
                  { text: t("messages.cancel"), style: "cancel" },
                  {
                    text: t("messages.confirmDelete"),
                    style: "destructive",
                    onPress: async () => {
                      setDeleteLoading(true);
                      const result = await requestAccountDeletionCode('en');
                      setDeleteLoading(false);
                      if (result.success) {
                        setDeletionRequested(true);
                        setShowDeleteModal(true);
                        Toast.show({
                          type: 'info',
                          text1: t("messages.deletionCodeSent"),
                        });
                      } else {
                        Toast.show({ type: 'error', text1: result.error });
                      }
                    },
                  },
                ]
              );
            }}
            disabled={loading || deleteLoading}
          >
            <View className="w-full rounded-full py-3">
              <Text className="text-red-400 text-sm text-center font-semibold">
                {deleteLoading ? t("form.deleting") : t("form.deleteAccount")}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Code entry Modal */}
          <Modal visible={showDeleteModal} transparent animationType="slide">
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
              <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 24, width: '100%' }}>
                <Text className="text-xl font-bold text-center mb-2">{t("messages.enterDeletionCode")}</Text>
                <Text className="text-gray-500 text-center mb-4">{t("messages.deletionCodeInstructions")}</Text>
                <TextInput
                  value={deleteCode}
                  onChangeText={setDeleteCode}
                  placeholder={t("messages.codePlaceholder")}
                  keyboardType="number-pad"
                  style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 18, textAlign: 'center', marginBottom: 16 }}
                />
                <TouchableOpacity
                  onPress={async () => {
                    const auth = getAuth();
                    const user = auth.currentUser;
                    if (!user || !deleteCode) return;
                    setDeleteLoading(true);
                    const result = await confirmAccountDeletion(user.uid, deleteCode);
                    setDeleteLoading(false);
                    if (result.success) {
                      setShowDeleteModal(false);
                      Toast.show({ type: 'success', text1: t("messages.accountDeleted") });
                      await signOut(auth);
                    } else {
                      Toast.show({ type: 'error', text1: result.error });
                    }
                  }}
                  disabled={deleteLoading || !deleteCode}
                >
                  <View className={`${deleteLoading || !deleteCode ? 'bg-gray-300' : 'bg-red-500'} rounded-full py-3 mb-3`}>
                    <Text className="text-white text-center font-bold">
                      {deleteLoading ? t("form.deleting") : t("messages.confirmDelete")}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setShowDeleteModal(false); setDeleteCode(''); }}>
                  <Text className="text-center text-gray-500">{t("messages.cancel")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Language Modal */}
          <LanguageModal
            visible={showLanguageModal}
            onClose={() => setShowLanguageModal(false)}
          />

          {/* Full Version Terms Modal */}
          <Modal visible={showTermsModal} transparent animationType="slide" onRequestClose={() => setShowTermsModal(false)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
              <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 24, width: '100%', maxHeight: '90%' }}>
                <Text className="text-xl font-bold text-gray-800 mb-4 text-center">
                  {t("options.termsOfService")}
                </Text>
                <ScrollView className="mb-6">
                  <Text className="font-bold text-gray-700 mt-2 text-base">{tAuth("register.termsTitle")}</Text>
                  <Text className="text-gray-500 text-sm mb-4">{tAuth("register.termsEffectiveDate")}</Text>
                  
                  <Text className="font-semibold text-gray-700 mt-3 text-base">{tAuth("register.termsSec1Title")}</Text>
                  <Text className="text-gray-600 text-sm mb-3">{tAuth("register.termsSec1Desc")}</Text>
                  
                  <Text className="font-semibold text-gray-700 mt-3 text-base">{tAuth("register.termsSec2Title")}</Text>
                  <Text className="text-gray-600 text-sm mb-3">{tAuth("register.termsSec2Desc")}</Text>
                  
                  <Text className="font-semibold text-gray-700 mt-3 text-base">{tAuth("register.termsSec3Title")}</Text>
                  <Text className="text-gray-600 text-sm mb-3">{tAuth("register.termsSec3Desc")}</Text>
                  
                  <Text className="font-semibold text-gray-700 mt-3 text-base">{tAuth("register.termsSec4Title")}</Text>
                  <Text className="text-gray-600 text-sm mb-3">{tAuth("register.termsSec4Desc")}</Text>
                  
                  <Text className="font-semibold text-gray-700 mt-3 text-base">{tAuth("register.termsSec5Title")}</Text>
                  <Text className="text-gray-600 text-sm mb-3">{tAuth("register.termsSec5Desc")}</Text>
                  
                  <Text className="font-semibold text-gray-700 mt-3 text-base">{tAuth("register.termsSec6Title")}</Text>
                  <Text className="text-gray-600 text-sm mb-3">{tAuth("register.termsSec6Desc")}</Text>
                  
                  <Text className="font-semibold text-gray-700 mt-3 text-base">{tAuth("register.termsSec7Title")}</Text>
                  <Text className="text-gray-600 text-sm mb-3">{tAuth("register.termsSec7Desc")}</Text>
                  
                  <Text className="font-semibold text-gray-700 mt-3 text-base">{tAuth("register.termsSec8Title")}</Text>
                  <Text className="text-gray-600 text-sm mb-3">{tAuth("register.termsSec8Desc")}</Text>

                  <Text className="font-semibold text-gray-700 mt-3 text-base">{tAuth("register.termsSec9Title")}</Text>
                  <Text className="text-gray-600 text-sm mb-3">{tAuth("register.termsSec9Desc")}</Text>
                  
                  <Text className="font-semibold text-gray-700 mt-3 text-base">{tAuth("register.termsSec10Title")}</Text>
                  <Text className="text-gray-600 text-sm mb-4">{tAuth("register.termsSec10Desc")}</Text>
                </ScrollView>
                <TouchableOpacity
                  onPress={() => setShowTermsModal(false)}
                  className="bg-secondary rounded-lg py-3"
                >
                  <Text className="text-white text-center font-bold text-lg">
                    {t("messages.cancel")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </>
      )}
    </Formik>
  );
});

ProfileForm.displayName = "ProfileForm";

export default ProfileForm;
