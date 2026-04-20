import {
  CheckCircle2,
  Zap,
  BarChart3,
  Smartphone,
  Shield,
  CreditCard,
  Users,
  TrendingUp,
  ChevronRight,
  Star,
  ArrowRight,
  Menu,
  X,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/* ─────────────────────────────────────────── NAVBAR ────────────────────── */
function Navbar() {
  return (
    <nav className="fixed top-0 z-50 w-full border-b border-amber-500/10 bg-[#0a0a0f]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-sm font-bold text-black">
            LO
          </div>
          <span className="text-lg font-bold text-white">LeiturasOficial</span>
        </div>

        <div className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm text-gray-400 transition-colors hover:text-amber-400">
            Funcionalidades
          </a>
          <a href="#plans" className="text-sm text-gray-400 transition-colors hover:text-amber-400">
            Planos
          </a>
          <a href="#faq" className="text-sm text-gray-400 transition-colors hover:text-amber-400">
            FAQ
          </a>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button
              variant="ghost"
              className="border border-amber-500/20 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
            >
              Entrar
            </Button>
          </Link>
          <Link href="/register">
            <Button className="bg-gradient-to-r from-amber-500 to-amber-600 font-semibold text-black hover:from-amber-400 hover:to-amber-500">
              Começar Grátis
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* ─────────────────────────────────────────── HERO ──────────────────────── */
function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-32">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/8 blur-[120px]" />
        <div className="absolute bottom-0 left-0 h-[400px] w-[600px] rounded-full bg-amber-600/5 blur-[100px]" />
        <div className="absolute right-0 top-1/3 h-[300px] w-[500px] rounded-full bg-orange-500/5 blur-[80px]" />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 text-center">
        <Badge
          className="mb-6 border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-amber-400"
        >
          <Zap className="mr-1 h-3.5 w-3.5" />
          Novo: Integração com Mercado Pago
        </Badge>

        <h1 className="mx-auto max-w-4xl text-4xl leading-tight font-extrabold tracking-tight md:text-6xl md:leading-tight">
          Controle suas{" "}
          <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 bg-clip-text text-transparent">
            máquinas de entretenimento
          </span>{" "}
          de forma inteligente
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-400 md:text-xl">
          O sistema mais completo para gestão financeira de máquinas. Acompanhe
          leituras, clientes, receitas e pagamentos em tempo real, direto do
          seu celular.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="/register">
            <Button
              size="lg"
              className="h-13 w-full bg-gradient-to-r from-amber-500 to-amber-600 px-8 text-base font-semibold text-black shadow-lg shadow-amber-500/25 transition-all hover:from-amber-400 hover:to-amber-500 hover:shadow-amber-500/40 sm:w-auto"
            >
              Começar Grátis
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
          <a href="#features">
            <Button
              size="lg"
              variant="outline"
              className="h-13 w-full border-gray-700 px-8 text-base text-gray-300 hover:border-amber-500/40 hover:bg-amber-500/5 hover:text-amber-400 sm:w-auto"
            >
              Ver Funcionalidades
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </a>
        </div>

        {/* Trust badges */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm text-gray-500">
          <div className="flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-amber-500/60" />
            <span>Dados seguros</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Smartphone className="h-4 w-4 text-amber-500/60" />
            <span>Funciona no celular</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CreditCard className="h-4 w-4 text-amber-500/60" />
            <span>Pagamento via Mercado Pago</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Star className="h-4 w-4 text-amber-500/60" />
            <span>Suporte dedicado</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────── FEATURES ─────────────────────── */
const features = [
  {
    icon: BarChart3,
    title: "Dashboard em Tempo Real",
    description:
      "Visualize receitas, despesas e lucros de todas as suas máquinas em um único painel com gráficos interativos e atualizações instantâneas.",
  },
  {
    icon: TrendingUp,
    title: "Controle de Leituras",
    description:
      "Registre e gerencie as leituras de cada máquina com histórico completo. Acompanhe a performance individual e identifique as mais rentáveis.",
  },
  {
    icon: Users,
    title: "Gestão de Clientes",
    description:
      "Cadastre clientes, controle aluguéis e pagamentos. Tenha visibilidade total sobre os contratos ativos e inadimplências.",
  },
  {
    icon: CreditCard,
    title: "Pagamentos Online",
    description:
      "Integração nativa com Mercado Pago para cobranças automáticas. Seus clientes pagam pelo app e o sistema registra tudo.",
  },
  {
    icon: Smartphone,
    title: "Acesso Mobile",
    description:
      "Interface responsiva otimizada para uso no celular. Cadastre leituras e gerencie máquinas estando na rua ou no salão.",
  },
  {
    icon: Shield,
    title: "Seguro e Confiável",
    description:
      "Seus dados protegidos com criptografia e backup automático. Sistema disponível 24/7 em servidores dedicados na Vercel.",
  },
];

function Features() {
  return (
    <section id="features" className="relative py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center">
          <Badge
            variant="outline"
            className="mb-4 border-amber-500/30 text-amber-400"
          >
            Funcionalidades
          </Badge>
          <h2 className="text-3xl font-bold md:text-4xl">
            Tudo que você precisa para{" "}
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              gerenciar suas máquinas
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-gray-400">
            Ferramentas poderosas projetadas para simplificar o controle
            financeiro do seu negócio de máquinas de entretenimento.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <div
              key={i}
              className="group relative rounded-2xl border border-gray-800/50 bg-gradient-to-b from-gray-900/50 to-gray-950/50 p-6 transition-all duration-300 hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/5"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 text-amber-400 transition-colors group-hover:from-amber-500/30 group-hover:to-amber-600/20">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-white">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-gray-400">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────── PLANS ────────────────────────── */
const plans = [
  {
    name: "Starter",
    price: "Grátis",
    period: "",
    description: "Para começar a testar o sistema",
    features: [
      "Até 5 máquinas",
      "Dashboard básico",
      "Registro de leituras",
      "Suporte por e-mail",
      "1 usuário",
    ],
    cta: "Começar Grátis",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "R$ 49",
    period: "/mês",
    description: "Para operadores que precisam de controle total",
    features: [
      "Máquinas ilimitadas",
      "Dashboard completo",
      "Relatórios avançados",
      "Integração Mercado Pago",
      "Gestão de clientes",
      "Suporte prioritário",
      "Usuários ilimitados",
    ],
    cta: "Assinar Pro",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "R$ 149",
    period: "/mês",
    description: "Para redes e grandes operadores",
    features: [
      "Tudo do Pro",
      "Multi-locais",
      "API de integração",
      "Relatórios personalizados",
      "Gerente de conta dedicado",
      "SLA garantido",
      "Treinamento incluso",
    ],
    cta: "Falar com Vendas",
    highlighted: false,
  },
];

function Plans() {
  return (
    <section id="plans" className="relative py-24">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/4 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="text-center">
          <Badge
            variant="outline"
            className="mb-4 border-amber-500/30 text-amber-400"
          >
            Planos e Preços
          </Badge>
          <h2 className="text-3xl font-bold md:text-4xl">
            Escolha o plano{" "}
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              ideal para você
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-gray-400">
            Comece grátis e evolua conforme seu negócio cresce. Sem surpresas,
            sem fidelidade.
          </p>
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {plans.map((plan, i) => (
            <div
              key={i}
              className={`relative rounded-2xl border p-8 transition-all duration-300 ${
                plan.highlighted
                  ? "border-amber-500/50 bg-gradient-to-b from-amber-500/10 via-gray-900/80 to-gray-950/80 shadow-xl shadow-amber-500/10"
                  : "border-gray-800/50 bg-gradient-to-b from-gray-900/50 to-gray-950/50 hover:border-gray-700"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-semibold text-black">
                    Mais Popular
                  </Badge>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                <p className="mt-1 text-sm text-gray-500">{plan.description}</p>
              </div>

              <div className="mb-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-white">
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="text-gray-500">{plan.period}</span>
                )}
              </div>

              <Link href="/register" className="block">
                <Button
                  className={`w-full font-semibold ${
                    plan.highlighted
                      ? "bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:from-amber-400 hover:to-amber-500"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white"
                  }`}
                  size="lg"
                >
                  {plan.cta}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>

              <ul className="mt-8 space-y-3">
                {plan.features.map((feature, j) => (
                  <li key={j} className="flex items-center gap-3 text-sm text-gray-400">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-amber-500" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────── SOCIAL PROOF ───────────────────── */
function SocialProof() {
  const testimonials = [
    {
      name: "Carlos Silva",
      role: "Operador de Sinucas - SP",
      text: "O LeiturasOficial transformou meu controle. Antes eu usava planilha e perdia dados. Agora tenho tudo no celular, em tempo real.",
      rating: 5,
    },
    {
      name: "Marcos Oliveira",
      role: "Dono de Salão de Jogos - RJ",
      text: "A integração com Mercado Pago foi um divisor de águas. Meus clientes pagam pelo app e eu vejo tudo no dashboard.",
      rating: 5,
    },
    {
      name: "Ana Santos",
      role: "Gerente de Máquinas - MG",
      text: "Comecei com o plano grátis e em um mês já upgradei para o Pro. O suporte é excelente e o sistema muito intuitivo.",
      rating: 5,
    },
  ];

  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center">
          <Badge
            variant="outline"
            className="mb-4 border-amber-500/30 text-amber-400"
          >
            Depoimentos
          </Badge>
          <h2 className="text-3xl font-bold md:text-4xl">
            Quem usa,{" "}
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              recomenda
            </span>
          </h2>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="rounded-2xl border border-gray-800/50 bg-gradient-to-b from-gray-900/50 to-gray-950/50 p-6"
            >
              <div className="mb-4 flex gap-0.5">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star
                    key={j}
                    className="h-4 w-4 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>
              <p className="mb-6 text-sm leading-relaxed text-gray-400">
                &ldquo;{t.text}&rdquo;
              </p>
              <div>
                <p className="text-sm font-semibold text-white">{t.name}</p>
                <p className="text-xs text-gray-500">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────── FAQ ────────────────────────── */
const faqs = [
  {
    q: "O LeiturasOficial é gratuito?",
    a: "Sim! O plano Starter é totalmente gratuito e permite cadastrar até 5 máquinas com todas as funcionalidades básicas. Você pode usar pelo tempo que quiser sem pagar nada. Os planos pagos são para quem precisa de recursos avançados como relatórios detalhados, integração com Mercado Pago e gestão de clientes.",
  },
  {
    q: "Como funciona o pagamento via Mercado Pago?",
    a: "O LeiturasOficial integra-se nativamente com o Mercado Pago. Seus clientes podem pagar aluguéis e compras diretamente pelo sistema. O pagamento é processado de forma segura e automaticamente registrado no financeiro do seu negócio. Você acompanha tudo em tempo real pelo dashboard.",
  },
  {
    q: "Funciona no celular?",
    a: "Sim! O sistema é totalmente responsivo e otimizado para uso em smartphones e tablets. Você pode cadastrar leituras, gerenciar máquinas e acompanhar receitas estando na rua, no salão ou em qualquer lugar. Funciona direto no navegador, sem precisar instalar nada.",
  },
  {
    q: "Meus dados estão seguros?",
    a: "Absolutamente. Utilizamos criptografia de ponta a ponta e servidores dedicados na Vercel. Seus dados são backup automaticamente e o sistema conta com redundância para garantir disponibilidade 24/7. Além disso, oferecemos autenticação segura para proteger o acesso à sua conta.",
  },
  {
    q: "Posso cancelar a qualquer momento?",
    a: "Sim! Não há fidelidade ou multa por cancelamento. Você pode cancelar seu plano pago a qualquer momento e voltar para o plano grátis. Seus dados serão mantidos por 90 dias caso decida voltar. Simplificado e sem burocracia.",
  },
  {
    q: "Quais tipos de máquinas posso cadastrar?",
    a: "Você pode cadastrar qualquer tipo de máquina de entretenimento: sinucas, mesas de bilhar, jogos eletrônicos, fliperamas, máquinas de skill, tocadores de música (jukebox), danceterias e muitos outros. O sistema é flexível e se adapta ao seu tipo de negócio.",
  },
];

function FAQ() {
  return (
    <section id="faq" className="relative py-24">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <Badge
            variant="outline"
            className="mb-4 border-amber-500/30 text-amber-400"
          >
            FAQ
          </Badge>
          <h2 className="text-3xl font-bold md:text-4xl">
            Perguntas{" "}
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              Frequentes
            </span>
          </h2>
        </div>

        <div className="mt-12">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="border-gray-800/50"
              >
                <AccordionTrigger className="text-left text-sm font-medium text-gray-300 hover:text-amber-400">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-gray-500">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────── CTA ──────────────────────────── */
function CTA() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-gray-900 to-gray-950 p-12 text-center md:p-20">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-0 h-[300px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/15 blur-[100px]" />
          </div>

          <div className="relative">
            <h2 className="text-3xl font-bold md:text-5xl">
              Pronto para{" "}
              <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                transformar
              </span>{" "}
              seu negócio?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-gray-400">
              Junte-se a centenas de operadores que já controlam suas máquinas
              de forma inteligente. Comece grátis hoje.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/register">
                <Button
                  size="lg"
                  className="h-13 bg-gradient-to-r from-amber-500 to-amber-600 px-8 text-base font-semibold text-black shadow-lg shadow-amber-500/25 transition-all hover:from-amber-400 hover:to-amber-500 hover:shadow-amber-500/40"
                >
                  Criar Conta Grátis
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-13 border-gray-700 px-8 text-base text-gray-300 hover:border-amber-500/40 hover:bg-amber-500/5 hover:text-amber-400"
                >
                  Já tenho conta
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────── FOOTER ────────────────────────── */
function Footer() {
  return (
    <footer className="border-t border-gray-800/50 bg-[#06060a]">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-sm font-bold text-black">
                LO
              </div>
              <span className="text-lg font-bold text-white">
                LeiturasOficial
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-gray-500">
              Sistema completo de gestão para máquinas de entretenimento.
              Simplifique seu controle financeiro.
            </p>
          </div>

          {/* Produto */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
              Produto
            </h4>
            <ul className="space-y-3 text-sm text-gray-500">
              <li>
                <a href="#features" className="transition-colors hover:text-amber-400">
                  Funcionalidades
                </a>
              </li>
              <li>
                <a href="#plans" className="transition-colors hover:text-amber-400">
                  Planos
                </a>
              </li>
              <li>
                <a href="#faq" className="transition-colors hover:text-amber-400">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Empresa */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
              Empresa
            </h4>
            <ul className="space-y-3 text-sm text-gray-500">
              <li>
                <span className="transition-colors hover:text-amber-400 cursor-pointer">
                  Sobre
                </span>
              </li>
              <li>
                <span className="transition-colors hover:text-amber-400 cursor-pointer">
                  Contato
                </span>
              </li>
              <li>
                <span className="transition-colors hover:text-amber-400 cursor-pointer">
                  Termos de Uso
                </span>
              </li>
            </ul>
          </div>

          {/* Contato */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
              Contato
            </h4>
            <ul className="space-y-3 text-sm text-gray-500">
              <li>suporte@leiturasoficial.com</li>
              <li>WhatsApp: (11) 99999-9999</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-gray-800/50 pt-8 md:flex-row">
          <p className="text-xs text-gray-600">
            &copy; {new Date().getFullYear()} LeiturasOficial. Todos os direitos
            reservados.
          </p>
          <p className="text-xs text-gray-600">
            Feito com dedicação para operadores de máquinas de entretenimento.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ──────────────────────────────────────── PAGE ─────────────────────────── */
export default function SitePage() {
  return (
    <>
      <Navbar />
      <Hero />
      <Features />
      <Plans />
      <SocialProof />
      <FAQ />
      <CTA />
      <Footer />
    </>
  );
}
