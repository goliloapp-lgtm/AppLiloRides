import { View, Text, TouchableOpacity } from "react-native";

export default function CustomButton(props) {
  const { title, onPress, selectedDriver, isCancel, textClassName } = props;
  return (
    <TouchableOpacity onPress={onPress}>
      <View
        className={`px-4 rounded-lg py-2 flex-row items-center justify-center ${isCancel ? "bg-transparent border border-red-500" : "bg-secondary"}`}>
        {typeof title === 'string' ? (
          <Text className={isCancel ? "text-red-500 ":`text-white font-bold`}>
            {title}
          </Text>
        ) : (
          title // Render component directly
        )}
      </View>
    </TouchableOpacity>
  );
}
