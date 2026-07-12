import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wittybunch Payments",
  description: "Payment cockpit for Wittybunch sign-ups"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
