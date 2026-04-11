# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

---

## [v2.10.0.2] - 2026-04-11

v2.10.0.2 - Corrigido GLM/Zhipu AI: agora gera JWT correto a partir da API Key ({id}.{secret}) para autenticacao
v2.10.0.2 - Criado modulo zhipu-auth.ts com funcao generateZhipuToken() para gerar JWT HMAC-SHA256
v2.10.0.2 - Antes enviava API Key crua como Bearer, agora gera token JWT valido com expiracao de 1 hora
v2.10.0.2 - Adicionado timeout de 30s no teste de conexao e 60s nas chamadas com imagem
v2.10.0.2 - Mensagem de erro clara quando modelo excede o tempo de resposta

## [v2.10.0.1] - 2026-04-11

v2.10.0.1 - Corrigido botao Testar Conexao Reserva: agora usa valores do formulario antes de salvar no banco
v2.10.0.1 - Backend aceita valores do corpo da requisicao como prioridade sobre o banco de dados
v2.10.0.1 - Mesma correcao aplica ao teste de conexao principal

## [v2.10.0.0] - 2026-04-11

v2.10.0.0 - Fallback automatico de IA: quando a principal falha, usa a reserva automaticamente
v2.10.0.0 - Campos de IA Reserva: Token e Modelo separados para provedor diferente
v2.10.0.0 - Recomendacao visual: avisa se principal e reserva sao do mesmo provedor
v2.10.0.0 - Botao Testar Conexao Reserva independente para validar fallback
v2.10.0.0 - Rotas de IA (extrair e identificar-lote) tentam fallback em qualquer erro
v2.10.0.0 - Informacao de qual modelo foi usado (principal ou fallback) retornada na resposta
v2.10.0.0 - Todas as chamadas frontend enviam apiKeyFallback e modelFallback junto

## [v2.9.1.0] - 2026-04-11

v2.9.1.0 - Adicionados modelos GLM (Zhipu AI) ao menu de configurações de IA
v2.9.1.0 - Novos modelos: GLM-4V Flash (Rápido), GLM-4V Plus (Equilibrado), GLM-4V (Preciso), GLM-4V Long (Alta Resolução)
v2.9.1.0 - Dropdown organizado por provedor: Google Gemini e Zhipu AI (GLM)
v2.9.1.0 - Link de obtenção de API Key muda dinamicamente conforme o provedor selecionado
v2.9.1.0 - Rotas de IA (extrair, identificar-lote, testar) reescritas com suporte multi-provedor
v2.9.1.0 - Detecção automática de provedor pelo nome do modelo (glm-* = Zhipu AI, demais = Gemini)
v2.9.1.0 - GLM usa API OpenAI-compatible com Authorization Bearer no header
v2.9.1.0 - Gemini mantém formato original com API Key na URL
v2.9.1.0 - Mensagens de erro now mostram o link correto para cada provedor

## [v2.9.0.0] - 2026-04-11

v2.9.0.0 - Novo recurso: Configurações de IA Vision no menu lateral (somente ADMIN)
v2.9.0.0 - Campo para informar Token de IA (API Key) personalizado por empresa
v2.9.0.0 - Menu suspenso com modelos de IA alternativos (Gemini 2.5 Flash Lite, Flash, Pro, 2.0 Flash, 1.5 Flash, 1.5 Pro)
v2.9.0.0 - Se uma IA der problema, basta selecionar outra e continuar usando o app
v2.9.0.0 - Botão Testar Conexão para verificar se a API Key e modelo estão funcionando
v2.9.0.0 - Indicador de status: personalizada (verde), modelo personalizado (amarelo), padrão do sistema (cinza)
v2.9.0.0 - Configurações armazenadas por empresa no banco de dados (campos llmApiKey e llmModel)
v2.9.0.0 - Rotas de IA (extrair e identificar-lote) agora aceitam apiKey e model customizados via request body
v2.9.0.0 - Prioridade de configuração: empresa > variáveis de ambiente (fallback)

## [v2.8.1.0] - 2026-04-11

v2.8.1.0 - Corrigido processamento de lote: agora usa 2 passos separados para maior precisao
v2.8.1.0 - Passo 1: API identificar-lote focada apenas em identificar o codigo da maquina na etiqueta
v2.8.1.0 - Passo 2: API extrair (a mesma da extração manual) com nomeEntrada/nomeSaida do tipo da maquina
v2.8.1.0 - Corrigido bug: lote agora usa os campos personalizados de cada tipo de maquina (E/S, ENTRADA/SAIDA, etc.)
v2.8.1.0 - Adicionado tratamento de erros HTTP 429 (rate limit), 401, 403, 404 na API de identificacao
v2.8.1.0 - Ajustado delay entre fotos para 1 segundo (2 chamadas API por foto)
v2.8.1.0 - Melhorada contagem de resultados: processadas, nao encontradas e com erro

## [v2.8.0.0] - 2026-04-11

v2.8.0.0 - Novo recurso: Lancamento de Lote na Cobranca - tirar fotos em sequencia e processar automaticamente
v2.8.0.0 - Nova API /api/leituras/identificar-lote para identificar maquina pela etiqueta e extrair valores via IA
v2.8.0.0 - Modal de lote com lista de fotos enfileiradas e barra de progresso
v2.8.0.0 - IA identifica o codigo da maquina na foto e correlaciona com as maquinas do cliente
v2.8.0.0 - Valores extraidos em lote sao aplicados automaticamente nos campos da maquina correspondente

## [v2.7.1.1] - 2026-04-11

v2.7.1.1 - Corrigido envio de foto para grupo WhatsApp: fallback agora salva a foto automaticamente no dispositivo e copia a mensagem antes de abrir o grupo
v2.7.1.1 - Melhorada experiencia do Web Share API: removida verificacao dupla navigator.share && navigator.canShare
v2.7.1.1 - Ajustado delay na abertura do grupo WhatsApp para dar tempo ao download iniciar
v2.7.1.1 - Mensagens de toast mais claras instruindo o usuario sobre os proximos passos

## [v2.7.1.0] - 2026-04-11

v2.7.1.0 - Campo Grupo WhatsApp movido do cadastro de Maquina para o cadastro de Cliente
v2.7.1.0 - Corrigido envio de foto para WhatsApp: agora usa Web Share API para compartilhar a imagem junto com o texto
v2.7.1.0 - Fallback para navegadores sem suporte a Web Share: copia mensagem e abre link do grupo
v2.7.1.0 - Atualizado schema Prisma, APIs de clientes e maquinas para refletir nova posicao do campo whatsapp

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
