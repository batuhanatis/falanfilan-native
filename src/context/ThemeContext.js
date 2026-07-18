import React, { createContext, useContext, useState } from "react";
import { THEMES } from "../theme/theme";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState("light");
  const c = THEMES[mode];
  return (
    <ThemeContext.Provider value={{ mode, setMode, c }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
