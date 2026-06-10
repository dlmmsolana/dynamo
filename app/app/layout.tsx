import type { Metadata } from "next";
import TabNav from "@/components/TabNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dynamo — Liquidity Terminal",
  description: "Professional liquidity intelligence for Solana DeFi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <body
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg)",
          margin: 0,
        }}
      >
        <TabNav />
        <main style={{ flex: 1, overflowY: "auto" }}>{children}</main>
      </body>
    </html>
  );
}
