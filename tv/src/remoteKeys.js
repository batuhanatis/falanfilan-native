import { useEffect } from "react";
import * as RN from "react-native";

// Kumanda tuşları: TV'de react-native-tvos'un olay dinleyicisi (tuş bırakılınca gelir; odak ise
// basıldığı anda hareket eder). Tarayıcı ön izlemesinde klavye okları aynı adlarla geliyor.
const WEB_KEYS = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", Enter: "select" };
function useWebKeys(handler) {
  useEffect(() => {
    const onKey = (e) => handler({ eventType: WEB_KEYS[e.key] || e.key });
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handler]);
}
export const useRemoteKeys = RN.useTVEventHandler || useWebKeys;
export const isKeyPress = (evt) => !!evt?.eventType && evt.eventType !== "focus" && evt.eventType !== "blur";
