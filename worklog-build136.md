---
Task ID: 1
Agent: Main Agent
Task: Build 136 - Chat IA como item selecionavel no plano de assinatura (recChatIA)

Work Log:
- Analisou estrutura completa de planos SaaS no sistema
- Adicionou campo recChatIA (Boolean) ao schema PlanoSaaS no Prisma
- Gerou Prisma client atualizado
- Atualizou plan-enforcement.ts: FeatureType, PlanInfo, checkFeature com recChatIA
- Mudou /api/chat-ia/route.ts de recIA para recChatIA na verificacao de plano
- Atualizou /api/meu-plano para retornar recChatIA no response
- Atualizou /api/planos-saas (POST) e /api/planos-saas/[id] (PUT) para recChatIA
- Atualizou /api/seed/planos-saas: Starter+ com recChatIA=true, Gratuito=false
- Adicionou migration ALTER TABLE em sync-schema para BDs existentes
- Atualizou GestaoPlanosSaaS.tsx, admin/page.tsx e page.tsx
- Deploy bem-sucedido em Vercel (v2.28.0.136)

Stage Summary:
- Chat IA agora e um recurso independente (recChatIA) no plano de assinatura
- Starter, Profissional, Empresarial e Enterprise tem Chat IA liberado por padrao
- Gratuito nao tem Chat IA
- Super admin tem acesso garantido ao Chat IA (bypass na UI)
- Tab Chat IA so aparece se recChatIA=true ou usuario e super admin
- Commit: 97ff3d4, Deploy: https://caixafacil-inky.vercel.app
