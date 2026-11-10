import React from "react";
import { NavigationContainer, DarkTheme, DefaultTheme, createNavigationContainerRef, getStateFromPath as defaultGetStateFromPath } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAppTheme } from "../context/ThemeContext";
import { trackScreen } from "../utils/analytics";
import MainTabs from "./MainTabs";
import TasteMateScreen from "../screens/TasteMateScreen";
import DetailScreenV2 from "../screens/DetailScreenV2";
import OtherProfileScreen from "../screens/OtherProfileScreen";
import SettingsScreen from "../screens/SettingsScreen";
import BlockedUsersScreen from "../screens/BlockedUsersScreen";
import BlendScreen from "../screens/BlendScreen";
import BlendLeaderboardScreen from "../screens/BlendLeaderboardScreen";
import TonightPlannerScreen from "../screens/TonightPlannerScreen";
import PremiumScreen from "../screens/PremiumScreen";
import WeeklyQuestsScreen from "../screens/WeeklyQuestsScreen";
import PellixPlayScreen from "../screens/PellixPlayScreen";
import DailyPosterPuzzleScreen from "../screens/DailyPosterPuzzleScreen";
import FriendBattleScreen from "../screens/FriendBattleScreen";
import PartyJoinScreen from "../screens/PartyJoinScreen";
import DiaryScreen from "../screens/DiaryScreen";
import RateTasteScreen from "../screens/RateTasteScreen";
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
import LiveRoomScreen from "../screens/LiveRoomScreen";
import TvPairScreen from "../screens/TvPairScreen";
import GlobalPopups from "../components/GlobalPopups";

const Stack = createNativeStackNavigator();
export const navigationRef = createNavigationContainerRef();

// Uygulama linklerinin (open.pellix.app/..., pellix://...) hangi ekrana açılacağı. Modül
// düzeyinde, çünkü ertelenmiş link (utils/deferredLink.js) de aynı yolu kullanıyor.
export function appStateFromPath(path, options) {
  // Story kartı linki: open.pellix.app/u/film/<id> (mağazadaki sürümler /u yolunu zaten
  // uygulama linki olarak tanıyor) ya da sayfanın denediği pellix://film/<id>. Elde yalnızca
  // kimlik var; Detail ekranı içeriği kendisi çekiyor (DetailScreenV2).
  // Ana ekran widget'ları: pellix://kesfet, pellix://widget/blend/<id>?ad=<isim>, pellix://widget/blendler.
  if (/^\/?kesfet(?:[/?]|$)/.test(path)) return { routes: [{ name: "MainTabs", state: { routes: [{ name: "Discover" }] } }] };
  const widgetBlendMatch = path.match(/^\/?widget\/blend\/(\d+)/);
  if (widgetBlendMatch) {
    const nameMatch = path.match(/[?&]ad=([^&]*)/);
    const friendName = nameMatch ? decodeURIComponent(nameMatch[1].replace(/\+/g, " ")) : "";
    return { routes: [{ name: "MainTabs" }, { name: "Blend", params: { friendId: Number(widgetBlendMatch[1]), friendName } }] };
  }
  if (/^\/?widget\/blendler/.test(path)) return { routes: [{ name: "MainTabs" }, { name: "BlendLeaderboard" }] };
  const filmMatch = path.match(/^\/?(?:u\/)?film\/(\d+)/);
  if (filmMatch) return { routes: [{ name: "MainTabs" }, { name: "Detail", params: { movie: { id: Number(filmMatch[1]) } } }] };
  // OTA uyumlu Party Link: mevcut binary zaten Android/iOS'ta /u app-link yolunu biliyor.
  // Bu özel alt yolu normal profil eşleşmesinden ÖNCE yakalıyoruz.
  // Oyun linkleri: open.pellix.app/u/oyun/<oyun> (paylaşılan oyun sonuçları) → o oyun.
  const gameMatch = path.match(/^\/?(?:u\/)?oyun\/([a-z0-9-]+)/);
  if (gameMatch) {
    if (gameMatch[1] === "afis-bulmacasi") return { routes: [{ name: "MainTabs" }, { name: "DailyPosterPuzzle" }] };
    const initialGame = { karakter: "character_quiz", replik: "who_said_it", "arkadasini-taniyor-musun": "friend_quiz", "taste-battle": "taste_battle" }[gameMatch[1]];
    return { routes: [{ name: "MainTabs" }, { name: "PellixPlay", params: initialGame ? { initialGame } : {} }] };
  }
  const partyAliasMatch = path.match(/^\/?u\/party\/([^/?]+)/);
  if (partyAliasMatch) return { routes: [{ name: "MainTabs" }, { name: "PartyJoin", params: { token: decodeURIComponent(partyAliasMatch[1]) } }] };
  const userMatch = path.match(/^\/?u\/([^/?]+)/);
  if (userMatch) return { routes: [{ name: "MainTabs" }, { name: "OtherProfile", params: { username: decodeURIComponent(userMatch[1]) } }] };
  const blendMatch = path.match(/^\/?blend\/([^/]+)\/([^/?]+)/);
  if (blendMatch) return { routes: [{ name: "MainTabs" }, { name: "OtherProfile", params: { username: decodeURIComponent(blendMatch[2]) } }] };
  const battleMatch = path.match(/^\/?battle\/([^/?]+)/);
  if (battleMatch) return { routes: [{ name: "MainTabs" }, { name: "FriendBattle", params: { battleId: decodeURIComponent(battleMatch[1]) } }] };
  // Canlı sohbet odası linki: open.pellix.app/oda/<kod> ya da pellix://oda/<kod>.
  const roomMatch = path.match(/^\/?oda\/([^/?]+)/);
  if (roomMatch) return { routes: [{ name: "MainTabs" }, { name: "LiveRoom", params: { code: decodeURIComponent(roomMatch[1]) } }] };
  // TV eşleştirme: TV'deki QR open.pellix.app/tv/<kod> açıyor, sayfa pellix://tv/<kod>'a yönlendiriyor.
  const tvMatch = path.match(/^\/?tv\/([^/?]+)/);
  if (tvMatch) return { routes: [{ name: "MainTabs" }, { name: "TvPair", params: { code: decodeURIComponent(tvMatch[1]) } }] };
  const partyMatch = path.match(/^\/?party\/([^/?]+)/);
  if (partyMatch) return { routes: [{ name: "MainTabs" }, { name: "PartyJoin", params: { token: decodeURIComponent(partyMatch[1]) } }] };
  return defaultGetStateFromPath(path, options);
}

export default function RootNavigator() {
  const { c, mode } = useAppTheme();
  const navTheme = {
    ...(mode === "dark" ? DarkTheme : DefaultTheme),
    colors: { ...(mode === "dark" ? DarkTheme.colors : DefaultTheme.colors), background: c.bg, card: c.surface, text: c.text, border: c.border, primary: c.accent },
  };

  const linking = {
    prefixes: ["pellix://", "https://www.pellix.app", "https://pellix.app", "https://open.pellix.app"],
    config: { screens: { OtherProfile: "u/:userId", FriendBattle: "battle/:battleId", PartyJoin: "party/:token", LiveRoom: "oda/:code", TvPair: "tv/:code" } },
    getStateFromPath: appStateFromPath,
  };

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme} linking={linking} onReady={() => trackScreen(navigationRef.current?.getCurrentRoute()?.name)} onStateChange={() => trackScreen(navigationRef.current?.getCurrentRoute()?.name)}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="TasteMate" component={TasteMateScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="Detail" component={DetailScreenV2} options={{ presentation: "card" }} />
        <Stack.Screen name="OtherProfile" component={OtherProfileScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="SharedItem" component={SharedItemScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="LiveRoom" component={LiveRoomScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="TvPair" component={TvPairScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="ProfileChat" component={ChatConversationScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="Blend" component={BlendScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="BlendLeaderboard" component={BlendLeaderboardScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="TonightPlanner" component={TonightPlannerScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="Premium" component={PremiumScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="WeeklyQuests" component={WeeklyQuestsScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="PellixPlay" component={PellixPlayScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="DailyPosterPuzzle" component={DailyPosterPuzzleScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="FriendBattle" component={FriendBattleScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="PartyJoin" component={PartyJoinScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="Diary" component={DiaryScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="RateTaste" component={RateTasteScreen} options={{ presentation: "card" }} />
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
