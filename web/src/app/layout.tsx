import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cropshift: what to plant and when",
  description:
    "Planting windows for crops in Pernambuco from 40 years of NASA POWER climate data, next to the official ZARC window and local yield history.",
};

export const viewport: Viewport = { themeColor: "#1d5f35", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="antialiased">
      <body className="flex min-h-dvh flex-col font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
