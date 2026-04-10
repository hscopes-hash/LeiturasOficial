import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { ThemeProvider } from "next-themes";

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
  },
  openGraph: {
    title: "LeiturasOficial",
    description: "Sistema de gestão de máquinas de entretenimento",
    siteName: "LeiturasOficial",
    type: "website",
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
        </ThemeProvider>
      </body>
    </html>
  );
}
