import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { ThemeProvider } from "next-themes";
import { PWARegister } from "@/components/pwa-register";
import { KioskMode } from "@/components/kiosk-mode";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Caixa Fácil - Gestão de Máquinas",
  description: "Sistema de gestão financeira de máquinas de entretenimento. Micro SaaS para controle de leituras, máquinas e clientes.",
  keywords: ["Caixa Fácil", "caixafacil", "máquinas", "entretenimento", "gestão", "leituras", "música", "sinuca"],
  authors: [{ name: "Caixa Fácil" }],
  icons: {
    icon: "/logo.svg",
    apple: "/icon-192.png",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "Caixa Fácil",
    description: "Sistema de gestão de máquinas de entretenimento",
    siteName: "Caixa Fácil",
    type: "website",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "Caixa Fácil",
    "theme-color": "#1e3a5f",
    "msapplication-TileColor": "#1e3a5f",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
          <Toaster />
          <SonnerToaster position="top-center" richColors />
          <PWARegister />
          <KioskMode />
        </ThemeProvider>
      </body>
    </html>
  );
}
