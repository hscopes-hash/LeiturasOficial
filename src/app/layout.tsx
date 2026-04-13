import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { ThemeProvider } from "next-themes";
import { PWARegister } from "@/components/pwa-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LeiturasOficial - Gestão de Máquinas",
  description: "Sistema de gestão financeira de máquinas de entretenimento. Micro SaaS para controle de leituras, máquinas e clientes.",
  keywords: ["LeiturasOficial", "máquinas", "entretenimento", "gestão", "leituras", "música", "sinuca"],
  authors: [{ name: "LeiturasOficial" }],
  icons: {
    icon: "/logo.svg",
    apple: "/icon-192.png",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "LeiturasOficial",
    description: "Sistema de gestão de máquinas de entretenimento",
    siteName: "LeiturasOficial",
    type: "website",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "Leituras",
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
        </ThemeProvider>
      </body>
    </html>
  );
}
