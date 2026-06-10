"use client";

import {
  createTheme,
  localStorageColorSchemeManager,
  MantineProvider,
} from "@mantine/core";
import { Notifications } from "@mantine/notifications";

import { OfflineStatusProvider } from "./components/offline-status-provider";
import { COLOR_SCHEME_STORAGE_KEY, DEFAULT_COLOR_SCHEME } from "./theme-config";

const theme = createTheme({
  primaryColor: "brand",
  primaryShade: { light: 6, dark: 5 },
  autoContrast: true,
  luminanceThreshold: 0.3,
  defaultRadius: "md",
  fontFamily:
    "Pretendard, Inter, SF Pro Text, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  fontSizes: {
    xs: "0.75rem",
    sm: "0.8125rem",
    md: "0.9375rem",
    lg: "1.0625rem",
    xl: "1.25rem",
  },
  headings: {
    fontFamily:
      "Pretendard, Inter, SF Pro Display, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    sizes: {
      h1: { fontSize: "2.25rem", lineHeight: "1.2" },
      h2: { fontSize: "1.5rem", lineHeight: "1.25" },
      h3: { fontSize: "1.25rem", lineHeight: "1.3" },
    },
  },
  colors: {
    brand: [
      "#edf3ff",
      "#d9e5ff",
      "#b7cdff",
      "#8caeff",
      "#668fee",
      "#345fdd",
      "#274dc4",
      "#1f3ea0",
      "#1c3587",
      "#192c6f",
    ],
  },
});

const colorSchemeManager = localStorageColorSchemeManager({
  key: COLOR_SCHEME_STORAGE_KEY,
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider
      theme={theme}
      defaultColorScheme={DEFAULT_COLOR_SCHEME}
      colorSchemeManager={colorSchemeManager}
    >
      <OfflineStatusProvider>
        <Notifications position="top-right" />
        {children}
      </OfflineStatusProvider>
    </MantineProvider>
  );
}
