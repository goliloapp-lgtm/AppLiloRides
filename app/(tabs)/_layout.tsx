import { Tabs } from "expo-router";
import Entypo from "@expo/vector-icons/Entypo";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName = 'home';
          let IconComponent = Entypo;

          if (route.name === 'home') {
            iconName = 'home';
          } else if (route.name === 'history') {
            iconName = 'history';
            IconComponent = FontAwesome5 as any;
          } else if (route.name === 'profile') {
            iconName = 'user-circle';
            IconComponent = FontAwesome5 as any;
          }

          return <IconComponent name={iconName as any} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2B9DD9',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#f3f4f6',
        }
      })}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="history" options={{ title: "History" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
