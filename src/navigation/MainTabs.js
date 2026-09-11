import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StackActions } from "@react-navigation/native";
import { Home, Compass, Users, MessageCircle, User } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useUnread } from "../context/UnreadContext";
import HomeScreen from "../screens/HomeScreenV2";
import DiscoverScreen from "../screens/DiscoverScreen";
import ActivityScreen from "../screens/ActivityScreen";
import ChatStack from "./ChatStack";
import ProfileScreen from "../screens/ProfileScreen";

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  const { c } = useAppTheme();
  const { totalUnread } = useUnread();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.dim,
        tabBarStyle: { backgroundColor: c.bg, borderTopColor: c.border },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen}
        options={{ title: "Ana Sayfa", tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      {/* Ana sekmeler kullanıcı niyetini doğrudan anlatıyor. Sosyal akış artık "Aktivite" gibi
          sistem/geçmiş çağrışımı yapan bir isim yerine "Sosyal" olarak konumlanıyor. */}
      <Tab.Screen name="Discover" component={DiscoverScreen}
        options={{ title: "Keşfet", tabBarIcon: ({ color, size }) => <Compass color={color} size={size} /> }} />
      <Tab.Screen name="Activity" component={ActivityScreen}
        options={{ title: "Sosyal", tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }} />
      <Tab.Screen
        name="Chat"
        component={ChatStack}
        listeners={({ navigation }) => ({
          tabPress: () => {
            // Sohbet sekmesi daha önce bir konuşmada bırakılmış olsa bile tab ikonuna basmak
            // her zaman nested stack'in köküne, yani tüm sohbetlerin listesine döner.
            const chatRoute = navigation.getState().routes.find((route) => route.name === "Chat");
            const chatStackKey = chatRoute?.state?.key;
            if (chatStackKey) {
              navigation.dispatch({ ...StackActions.popToTop(), target: chatStackKey });
            }
          },
        })}
        options={{
          title: "Sohbet",
          tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} />,
          tabBarBadge: totalUnread > 0 ? totalUnread : undefined,
          tabBarBadgeStyle: { backgroundColor: c.danger },
        }} />
      <Tab.Screen name="Profile" component={ProfileScreen}
        options={{ title: "Profil", tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tab.Navigator>
  );
}
