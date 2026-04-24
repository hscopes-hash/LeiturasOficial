import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Caixa Fácil - Gestão Inteligente de Máquinas de Entretenimento",
  description:
    "Sistema completo de gestão financeira para máquinas de entretenimento. Controle de leituras, máquinas, clientes e relatórios em tempo real.",
  keywords: [
    "Caixa Fácil",
    "caixafacil",
    "máquinas de entretenimento",
    "gestão",
    "sinuca",
    "música",
    "micro SaaS",
    "controle financeiro",
  ],
  openGraph: {
    title: "Caixa Fácil - Gestão Inteligente",
    description: "O sistema mais completo para gestão de máquinas de entretenimento",
    type: "website",
  },
};

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">{children}</div>
  );
}
