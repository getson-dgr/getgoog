import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Search Mirror",
  description: "Live shared search display"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
