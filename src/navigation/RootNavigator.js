import React from "react";
import { NavigationContainer, DarkTheme, DefaultTheme, createNavigationContainerRef, getStateFromPath as defaultGetStateFromPath } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAppTheme } from "../context/ThemeContext";
import { trackScreen } from "../utils/analytics";
import MainTabs from "./MainTabs";
import TasteMateScreen from "../screens/TasteMateScreen";
import DetailScreen from "../screens/DetailScreen";
import OtherProfileScreen from "../screens/OtherProfileScreen";
import SettingsScreen from "../screens/SettingsScreen";
import BlockedUsersScreen from "../screens/BlockedUsersScreen";
import BlendScreen from "../screens/BlendScreen";
import BlendLeaderboardScreen from "../screens/BlendLeaderboardScreen";
import PremiumScreen from "../screens/PremiumScreen";
import WeeklyQuestsScreen from "../screens/WeeklyQuestsScreen";
import PellixPlayScreen from "../screens/PellixPlayScreen";
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
import GlobalPopups from "../components/GlobalPopups";

const Stack = createNativeStackNavigator();

// GlobalPopups gibi navigasyon ağacının DIŞINDAKİ bileşenlerin de sayfa değiştirebilmesi için
// (ör. bir MatchParty davetini kabul edince otomatik o ekrana gitmek) modül seviyesinde,
// dışa aktarılabilir bir navigasyon referansı kuruyoruz.
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

  // Deep linking: web'den (ör. https://www.pellix.app/u/username paylaşım sayfası) ya da
  // pellix:// özel şemasından VE open.pellix.app'teki paylaşım linklerinden gelen bağlantıları
  // doğru ekrana yönlendiriyor. "/u/:username" ve "/blend/:userA/:userB" (kullanıcı ADI taşıyan,
  // React Navigation'ın basit path eşleştirmesiyle AYNI ekrana farklı şekillerde bağlanamayan
  // iki farklı yapı) için elle bir çözümleyici (getStateFromPath) yazıyoruz — ikisi de sonunda
  // OtherProfile ekranına, "username" parametresiyle gidiyor (o ekran, kullanıcı adını sayısal
  // ID'ye kendisi çeviriyor).
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
        // Blend linki, tasarım gereği ikinci kullanıcının (paylaşımı yapan kişinin arkadaşının)
        // profiline açılıyor — oradan isteyen kendi Blend'ini başlatabiliyor.
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
        <Stack.Screen name="OtherProfile" component={OtherProfileScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="ProfileChat" component={ChatConversationScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="Blend" component={BlendScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="BlendLeaderboard" component={BlendLeaderboardScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="Premium" component={PremiumScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="WeeklyQuests" component={WeeklyQuestsScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="PellixPlay" component={PellixPlayScreen} options={{ presentation: "card" }} />
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
