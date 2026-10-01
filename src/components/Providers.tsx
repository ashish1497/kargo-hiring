"use client";

import { AntdRegistry } from "@ant-design/nextjs-registry";
import { App, ConfigProvider } from "antd";

// Mirrors the CSS tokens in globals.css so antd components follow the same system.
export const TOKENS = {
  ink: "#111111",
  muted: "#7d7a72",
  rule: "#e8e4d8",
  paper: "#fffdf7",
  signal: "#15803d",
  coral: "#f25f4c",
  sun: "#ffd23f",
  sky: "#2563eb",
  alert: "#b8321f",
};

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AntdRegistry layer>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: TOKENS.signal,
            colorLink: TOKENS.sky,
            colorLinkHover: TOKENS.ink,
            colorText: TOKENS.ink,
            colorTextSecondary: TOKENS.muted,
            colorBorder: TOKENS.rule,
            colorBorderSecondary: TOKENS.rule,
            colorError: TOKENS.alert,
            colorSuccess: TOKENS.signal,
            colorBgLayout: TOKENS.paper,
            colorWarning: TOKENS.sun,
            borderRadius: 2,
            borderRadiusLG: 2,
            borderRadiusSM: 2,
            boxShadow: "none",
            boxShadowSecondary: "0 2px 8px rgba(0,0,0,0.08)",
            fontSize: 15,
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            fontFamilyCode: "var(--font-geist-mono), ui-monospace, monospace",
          },
          components: {
            Table: {
              headerBg: TOKENS.paper,
              headerColor: TOKENS.muted,
              headerSplitColor: "transparent",
              rowHoverBg: "#fbf6e6",
              borderColor: TOKENS.rule,
              cellPaddingBlock: 14,
            },
            Button: { primaryShadow: "none", defaultShadow: "none", fontWeight: 600, colorTextLightSolid: "#ffffff" },
            Segmented: { itemSelectedBg: TOKENS.ink, itemSelectedColor: "#ffffff", trackBg: "#f1ece0" },
            Upload: { colorFillAlter: "#ffffff" },
          },
        }}
      >
        <App>{children}</App>
      </ConfigProvider>
    </AntdRegistry>
  );
}
