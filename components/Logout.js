import React from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { logoutUser } from "../lib/auth";

export default function Logout({ navigation }) {
  const handleLogout = async () => {
    const result = await logoutUser();
    
    if (!result.success) {
      Alert.alert("Error", result.error || "There was an error signing out");
    }
    // AuthContext will handle the state change automatically
  };

  return (
    <View>
      <TouchableOpacity onPress={handleLogout}>
        <View className="p-2 bg-white rounded-full shadow-md">
          <Ionicons name="log-out-outline" size={20} color="black" />
        </View>
      </TouchableOpacity>
    </View>
  );
}
