
import { View, TouchableOpacity } from "react-native";
import Entypo from "@expo/vector-icons/Entypo";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useNavigation } from "@react-navigation/native";

export default function Tabs(props) {
  const { tabActive, setTabActive } = props;

  const navigation = useNavigation();

  function goHome() {
    setTabActive("Home");
    navigation.navigate("Home");
  }
  function goHistory() {
    setTabActive("History");
    navigation.navigate("RecentRides");
  }
  function goMessage() {
    setTabActive("Message");
    navigation.navigate("Messages");
  }
  function goProfile() {
    setTabActive("Profile");
    navigation.navigate("Profile");
  }

  return (
    <View
      className="bg-white bottom-0 left-0 right-0 px-6"
    >
      <View className="bg-gray-800 my-3 w-full p-4 h-16 flex-row items-center justify-around rounded-full overflow-hidden">
        <TouchableOpacity onPress={() => goHome()}>
          <View
            className={
              tabActive === "Home"
                ? "bg-[#2B9DD9] h-10 w-10 rounded-full items-center justify-center"
                : "h-10 w-10 rounded-full items-center justify-center"
            }
          >
            <Entypo name="home" size={24} color="white" />
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => goHistory()}>
          <View
            className={
              tabActive === "History"
                ? "bg-[#2B9DD9] h-10 w-10 rounded-full items-center justify-center"
                : "h-10 w-10 rounded-full items-center justify-center"
            }
          >
            <FontAwesome5 name="history" size={24} color="white" />
          </View>
        </TouchableOpacity>
        {/* <TouchableOpacity onPress={() => goMessage()}>
          <View
            className={
              tabActive === "Message"
                ? "bg-[#2B9DD9] h-10 w-10 rounded-full items-center justify-center"
                : "h-10 w-10 rounded-full items-center justify-center"
            }
          >
            <MaterialIcons name="message" size={24} color="white" />
          </View>
        </TouchableOpacity> */}
        <TouchableOpacity onPress={() => goProfile()}>
          <View
            className={
              tabActive === "Profile"
                ? "bg-[#2B9DD9] h-10 w-10 rounded-full items-center justify-center"
                : "h-10 w-10 rounded-full items-center justify-center"
            }
          >
            <FontAwesome5 name="user-circle" size={24} color="white" />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}
