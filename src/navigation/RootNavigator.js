import React from "react";
import { NavigationContainer, DarkTheme, DefaultTheme, createNavigationContainerRef, getStateFromPath as defaultGetStateFromPath } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAppTheme } from "../context/ThemeContext";
import { trackScreen } from "../utils/analytics";
import MainTabs from "./MainTabs";
import TasteMateScreen from "../screens/TasteMateScreen";
import DetailScreen from "../screens/DetailScreenV2";
import DiaryScreen from "../screens/DiaryScreen";
import OtherProfileScreen from "../screens/OtherProfileScreen";
import SettingsScreen from "../screens/SettingsScreen";
import BlockedUsersScreen from "../screens/BlockedUsersScreen";
import BlendScreen from "../screens/BlendScreen";
import BlendLeaderboardScreen from "../screens/BlendLeaderboardScreen";
import PremiumScreen from "../screens/PremiumScreen";
import WeeklyQuestsScreen from "../screens/WeeklyQuestsScreen";
import PellixPlayScreen from "../screens/PellixPlayScreen";
import DailyPosterPuzzleScreen from "../screens/DailyPosterPuzzleScreen";
import InviteFriendScreen from "../screens/InviteFriendScreen";
import AllLikesScreen from "../screens/AllLikesScreen";
import WatchlistDetailScreen from "../screens/WatchlistDetailScreen";
import MatchPartyScreen from "../screens/MatchPartyScreen";
import FriendSearchScreen from "../screens/FriendSearchScreen";
import PersonScreen from "../screens/PersonScreen";
import GroupPartyScreen from "../screens/GroupPartyScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import FriendsListScreen from "../screens/FriendsListScreen";
import MyWatchlistsScreen from "../screens/MyWatchlistsScreen";
import ChatConversationScreen from "../screens/ChatConversationScreen";
import SharedItemScreen from "../screens/SharedItemScreen";
import GlobalPopups from "../components/GlobalPopups";

const Stack = createNativeStackNavigator();

export const navigationRef = createNavigationContainerRef();

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

  const linking = {
    prefixes: ["pellix://", "https://www.pellix.app", "https://pellix.app", "https://open.pellix.app"],
    config: {
      screens: {
        OtherProfile: "u/:userId",
      },
    },
    getStateFromPath: (path, options) => {
      const userMatch = path.match(/^\/?u\/([^/?]+)/);
      if (userMatch) {
        return {
          routes: [{ name: "MainTabs" }, { name: "OtherProfile", params: { username: decodeURIComponent(userMatch[1]) } }],
        };
      }
      const blendMatch = path.match(/^\/?blend\/([^/]+)\/([^/?]+)/);
      if (blendMatch) {
        return {
          routes: [{ name: "MainTabs" }, { name: "OtherProfile", params: { username: decodeURIComponent(blendMatch[2]) } }],
        };
      }
      return defaultGetStateFromPath(path, options);
    },
  };

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      linking={linking}
      onReady={() => trackScreen(navigationRef.current?.getCurrentRoute()?.name)}
      onStateChange={() => trackScreen(navigationRef.current?.getCurrentRoute()?.name)}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="TasteMate" component={TasteMateScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="Detail" component={DetailScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="Diary" component={DiaryScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="OtherProfile" component={OtherProfileScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="SharedItem" component={SharedItemScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="ProfileChat" component={ChatConversationScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="Blend" component={BlendScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="BlendLeaderboard" component={BlendLeaderboardScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="Premium" component={PremiumScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="WeeklyQuests" component={WeeklyQuestsScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="PellixPlay" component={PellixPlayScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="DailyPosterPuzzle" component={DailyPosterPuzzleScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="InviteFriend" component={InviteFriendScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="AllLikes" component={AllLikesScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="WatchlistDetail" component={WatchlistDetailScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="FriendSearch" component={FriendSearchScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="Person" component={PersonScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="GroupParty" component={GroupPartyScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="FriendsList" component={FriendsListScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="MyWatchlists" component={MyWatchlistsScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="MatchParty" component={MatchPartyScreen} options={{ presentation: "fullScreenModal" }} />
      </Stack.Navigator>
      <GlobalPopups />
    </NavigationContainer>
  );
}
