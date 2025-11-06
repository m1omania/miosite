import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UX Audit Service",
  description: "Автоматический UX-аудит сайтов",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}


