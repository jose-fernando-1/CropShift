import type { Metadata, Viewport } from "next";
import "./globals.css";

const description =
  "Cropshift turns 40 years of NASA POWER climate data into planting windows for 11 crops across Pernambuco, Brazil, next to the official risk zoning and local yield history.";

export const metadata: Metadata = {
  title: "Cropshift: what to plant and when",
  description,
  openGraph: { title: "Cropshift: what to plant and when", description, type: "website" },
};

export const viewport: Viewport = { themeColor: "#1d5f35", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="antialiased">
      <body className="flex min-h-dvh flex-col font-sans">{children}</body>
    </html>
  );
}
