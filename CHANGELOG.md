# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

---

## [v2.7.0.0] - 2026-04-10

v2.7.0.0 - Criado painel administrativo SaaS completo em /admin
v2.7.0.0 - Dashboard SaaS com KPIs globais (empresas, MRR, alertas, novos cadastros)
v2.7.0.0 - Gestao de Empresas com CRUD completo, renovar assinatura, bloquear/desbloquear
v2.7.0.0 - View de detalhes da empresa (usuarios, maquinas, clientes)
v2.7.0.0 - Pagina de Planos com definicoes e distribuicao por plano
v2.7.0.0 - Ferramentas do Sistema (limpar orfaos, reset banco, seed demo)
v2.7.0.0 - API de Dashboard SaaS Global (/api/admin/saas-dashboard)
v2.7.0.0 - API de Renovar Assinatura (/api/empresas/gestao/[id]/renovar)
v2.7.0.0 - Sidebar responsiva com Sheet para mobile
v2.7.0.0 - Acesso restrito ao super admin (hscopes@gmail.com)

## [v2.6.0.0] - 2026-04-10

v2.6.0.0 - Adicionado seletor de tema claro/escuro no menu lateral
v2.6.0.0 - Preferência de tema salva automaticamente por operador (localStorage)
v2.6.0.0 - Convertida toda a interface para usar variáveis CSS tema-aware
v2.6.0.0 - Configurado ThemeProvider com next-themes no layout principal

## [v2.5.2.0] - 2025-03-25

v2.5.2.0 - Criado arquivo AGENTE.md com instruções padrão para novas sessões
v2.5.2.0 - Documentado fluxo de trabalho com Git, versionamento e ferramentas

## [v2.5.1.0] - 2025-03-25

v2.5.1.0 - Adicionados botões Imprimir e WhatsApp no relatório de Extrato
v2.5.1.0 - Função WhatsApp abre o app para encaminhar o relatório formatado

## [v2.5.0.3] - 2025-03-25

v2.5.0.3 - Criado arquivo CHANGELOG.md para documentar histórico de modificações
v2.5.0.3 - Formato de changelog: versão no início de cada linha de modificação

## [v2.5.0.2] - 2025-03-25

v2.5.0.2 - Relatório de Extrato: título alterado de "Relatório de Extrato" para "Extrato"
v2.5.0.2 - Tabela do Extrato simplificada para 4 colunas: Data, Cliente, Despesa, Cobrança
v2.5.0.2 - Adicionada linha de totais no final da tabela do Extrato

## [v2.5.0.1] - 2025-03-25

v2.5.0.1 - Título da página Cobrança alterado de "Leituras" para "Cobranças"
v2.5.0.1 - Título do painel alterado de "Despesa Extra" para "Despesa"
v2.5.0.1 - Título do modal de confirmação alterado de "Leituras Salvas!" para "Cobrança Salva!"
v2.5.0.1 - Adicionado campo Despesa no resumo após salvar cobrança
v2.5.0.1 - Cálculo do Líquido atualizado: Líquido = Cliente + Despesa
v2.5.0.1 - Correção de acentuação: "Liquido" → "Líquido", "Saidas" → "Saídas"

## [v2.5.0.0] - 2025-03-25

v2.5.0.0 - Adicionado relatório de Extrato com filtros por cliente e período
v2.5.0.0 - Adicionados campos despesa e valorDespesa na tabela de cobranças
v2.5.0.0 - Permitido salvar cobrança apenas com despesa (sem leituras)

## [v2.4.1.1] - 2025-03-24

v2.4.1.1 - Menu lateral: "Leituras" alterado para "Cobrança"
v2.4.1.1 - Correção: botão retornar com fundo vermelho e texto branco

## [v2.3.0.8] - 2025-03-24

v2.3.0.8 - Ícone da câmera fica verde após aplicar valores da foto
v2.3.0.8 - Removido botão "Só Salvar Foto" da janela de processamento

---

## Formato do Versionamento

- **MAJOR**: Mudanças significativas/incompatíveis
- **MINOR**: Novas funcionalidades (compatíveis)
- **PATCH**: Correções de bugs
- **BUILD**: Número do deploy (incrementado a cada deploy)
