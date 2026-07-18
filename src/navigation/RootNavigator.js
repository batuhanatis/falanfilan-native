import React from "react";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAppTheme } from "../context/ThemeContext";
import MainTabs from "./MainTabs";
import DetailScreen from "../screens/DetailScreen";
import OtherProfileScreen from "../screens/OtherProfileScreen";
import SettingsScreen from "../screens/SettingsScreen";
import WatchlistDetailScreen from "../screens/WatchlistDetailScreen";
import MatchPartyScreen from "../screens/MatchPartyScreen";
import ComingSoonScreen from "../screens/ComingSoonScreen";

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { c, mode } = useAppTheme();

  const navTheme = {
    ...(mode === "dark" ? DarkTheme : DefaultTheme),
    colors: {
      ...(mode === "dark" ? DarkTheme.colors : DefaultTheme.colors),
      background: c.bg,
      card: c.surface,
      text: c.text,
      border: c.border,
      primary: c.accent,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="Detail" component={DetailScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="OtherProfile" component={OtherProfileScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="WatchlistDetail" component={WatchlistDetailScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="MatchParty" component={MatchPartyScreen} options={{ presentation: "fullScreenModal" }} />
        <Stack.Screen name="ComingSoon" component={ComingSoonScreen} options={{ presentation: "modal" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
