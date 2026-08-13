import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Home, Compass, Users, MessageCircle, User } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useUnread } from "../context/UnreadContext";
import HomeScreen from "../screens/HomeScreen";
import DiscoverScreen from "../screens/DiscoverScreen";
import TasteMateScreen from "../screens/TasteMateScreen";
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
      {/* ÖNEMLİ: Sekme başlıkları Türkçe/İngilizce karışıktı ("Discover", "Chat" ama "Ana Sayfa",
          "Profil") — TasteMate marka/özellik adı olduğu için İngilizce kalıyor, diğerleri Türkçe. */}
      <Tab.Screen name="Discover" component={DiscoverScreen}
        options={{ title: "Keşfet", tabBarIcon: ({ color, size }) => <Compass color={color} size={size} /> }} />
      <Tab.Screen name="TasteMate" component={TasteMateScreen}
        options={{ title: "TasteMate", tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }} />
      <Tab.Screen name="Chat" component={ChatStack}
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
