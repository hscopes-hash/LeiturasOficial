# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

---

## [v2.25.10.31] - 2026-04-24

v2.25.10.31 - Fix: build command removido prisma db push (schema gerenciado pelo sync-schema em runtime)
v2.25.10.30 - Fix: chat IA cores corrigidas (bolhas visiveis) + parser JSON melhorado (fallback para texto cru)
v2.25.10.29 - Fix: chat IA bolhas com texto preto sobre fundo escuro (agora branco sobre amber)
v2.25.10.28 - Refactor: renomeado Despesa para Debito em todo o codebase (Prisma, API, UI)

## [v2.25.10.9] - 2026-04-21

v2.25.10.9 - Feat: fluxo de pagamento pratico — 2 cliques ate o MercadoPago (Assinar → Pagar no MercadoPago)
v2.25.10.9 - Feat: banner de feedback apos retorno do pagamento (success/pending/failure) com polling automatico
v2.25.10.9 - Feat: polling a cada 3s por 60s para detectar ativacao via webhook apos pagamento
v2.25.10.9 - Security: webhook agora verifica assinatura HMAC-SHA256 (x-signature) do MercadoPago
v2.25.10.9 - Fix: webhook usa upsert para pagamentos (protege contra duplicidade de notificacao)
v2.25.10.9 - Refactor: MercadoPagoCheckout simplificado de 900+ linhas para 60 linhas (helper function)
v2.25.10.9 - Fix: removido onSuccess callback dead code e showMPCheckout state inutil

## [v2.25.10.8] - 2026-04-21

v2.25.10.8 - Fix definitivo: checkout removido Brick embutido, agora usa redirect direto ao site do MercadoPago
v2.25.10.8 - O Payment Brick (formulario embutido) nunca funcionou corretamente (SW, Brave, Chrome, SDK)
v2.25.10.8 - Nova abordagem: cria preferencia via API e redireciona para o checkout hospedado do MP (100% confiavel)
v2.25.10.8 - Componente simplificado de 900+ linhas para ~260 linhas (sem SDK, sem Brick, sem iframes)
v2.25.10.8 - Checkout funciona em qualquer navegador (Brave, Chrome, Firefox, Safari, mobile)

## [v2.25.10.7] - 2026-04-21

v2.25.10.7 - Fix critico: Public Key e Access Token agora buscam da empresa do usuario (nao de qualquer empresa)
v2.25.10.7 - Fix: removido next/script que causava renderizacao de HTML cru na tela
v2.25.10.7 - Fix: SDK carrega via document.createElement dentro do effect (sem Fragment)

## [v2.25.10.6] - 2026-04-21

v2.25.10.6 - Fix: Brick reescrito — SDK agora carrega via next/script (mais confiavel)
v2.25.10.6 - Fix: removido rAF complexo, volta ao setTimeout(500ms) simples
v2.25.10.6 - Fix: validacao de Public Key vazia antes de tentar criar o Brick
v2.25.10.6 - Fix: logging detalhado no console para debug (preferenceId, publicKey, container)

## [v2.25.10.5] - 2026-04-20

v2.25.10.5 - Fix: Brave browser detectado — redireciona direto pro checkout externo
v2.25.10.5 - Tela explicativa com 3 opcoes: checkout externo, desativar Shields, trocar navegador
v2.25.10.5 - Botao "Tentar Brick (Shield OFF)" para quem desativou as protecoes do Brave

## [v2.25.10.4] - 2026-04-20

v2.25.10.4 - Fix: SDK do MP volta a URL limpa (sem cache-bust/crossOrigin que bloqueavam cookies)
v2.25.10.4 - Fix: timeout do Brick aumentado de 15s para 30s (mobile pode ser mais lento)

## [v2.25.10.3] - 2026-04-20

v2.25.10.3 - Fix: crash "Cannot read properties of undefined (reading 'then')" no rAF do container

## [v2.25.10.2] - 2026-04-20

v2.25.10.2 - Fix critico: Service Worker interceptava e cacheava recursos do MercadoPago (iframes, JS, CSS) travando o Brick
v2.25.10.2 - Fix: SW agora ignora mercadopago.com, mercadolivre.com, mlstatic.com (passa direto pro navegador)
v2.25.10.2 - Fix: SDK do MP carrega com cache-bust (?v=timestamp) e crossOrigin=anonymous
v2.25.10.2 - Fix: container do Brick detectado via requestAnimationFrame em vez de setTimeout(300ms)
v2.25.10.2 - Fix: SDK reload automatico apos 5 minutos para evitar estado obsoleto

## [v2.25.10.1] - 2026-04-20

v2.25.10.1 - Build: versao exibida automaticamente em cada build (prebuild + build ID com versao)

## [v2.25.10.0] - 2026-04-20

v2.25.10.0 - Site comercial: landing page completa em /site (dark theme, amber/gold)
v2.25.10.0 - Landing page com Hero, Features, Planos, Depoimentos, FAQ e Footer
v2.25.10.0 - Layout dedicado para a landing page (meta tags SEO, OpenGraph)
v2.25.10.0 - Diretorio public/marketing/ criado para assets de divulgação
v2.25.10.0 - Merge da branch master para main (app completo + site comercial)

## [v2.25.8.2] - 2026-04-19

v2.25.8.2 - Fix: fetch travando no checkout (timeout Vercel + fallback externo)

## [v2.25.8.1] - 2026-04-19

v2.25.8.1 - Fix critico: container do Brick nao existia no DOM

## [v2.25.8.0] - 2026-04-19

v2.25.8.0 - Fix: tela de pagamento presa - mensagens de status detalhadas
v2.25.8.0 - Fix: status em tempo real + fallback para checkout externo

## [v2.25.7.0] - 2026-04-19

v2.25.7.0 - Fix: SDK do MercadoPago nao carregava - reescrito com script tag manual

## [v2.25.6.0] - 2026-04-19

v2.25.6.0 - Fix: app sempre inicia pela tela de login

## [v2.25.5.0] - 2026-04-19

v2.25.5.0 - Feat: API para limpar assinaturas de teste ativadas indevidamente
v2.25.5.0 - Fix: protecao extra - verificacao de valor e remocao de toast enganoso
v2.25.5.0 - Fix: impedir ativacao de plano sem pagamento aprovado (v2.25.4.0)

## [v2.25.3.0] - 2026-04-19

v2.25.3.0 - Fix: reescrever Payment Brick com next/script para evitar crash

## [v2.25.2.0] - 2026-04-19

v2.25.2.0 - Fix: corrigir inicialização do Payment Brick MercadoPago

## [v2.25.1.0] - 2026-04-19

v2.25.1.0 - Fix: centraliza credenciais MP e melhora erro de configuracao

## [v2.25.0.0] - 2026-04-19

v2.25.0.0 - Feat: checkout embutido com MercadoPago Payment Brick

## [v2.24.1.0] - 2026-04-19

v2.24.1.0 - Fix: corrige autenticacao por token em todas as rotas de API

## [v2.24.0.0] - 2026-04-19

v2.24.0.0 - Feat: sugestoes de planos BR para micro SaaS gestao financeira

## [v2.23.0.0] - 2026-04-19

v2.23.0.0 - Feat: gestao de planos SaaS incluida no CONFIG SAAS

## [v2.22.0.1] - 2026-04-19

v2.22.0.1 - Fix: melhorar tratamento de erro na API de status da assinatura

## [v2.22.0.0] - 2026-04-19

v2.22.0.0 - Feat: card do trial com data de inicio e dias restantes

## [v2.21.0.0] - 2026-04-19

v2.21.0.0 - Feat: armazenar API Key do Gemini separadamente por provedor

## [v2.19.0.2] - 2026-04-19

v2.19.0.2 - Build: card MercadoPago + CONFIG SAAS

## [v2.19.0.1] - 2026-04-19

v2.19.0.1 - Card MercadoPago na tela de Configuracoes (access token salvo no banco)

## [v2.19.0.0] - 2026-04-19

v2.19.0.0 - Sistema de faturamento SaaS com MercadoPago: planos, checkout, webhook, assinaturas
v2.19.0.0 - Merge: integração completa do sistema de pagamentos recorrentes

## [v2.18.3.9] - 2026-04-18

v2.18.3.9 - Mensagens de erro amigaveis para erros do Zhipu GLM (1305, 1301, 1004)

## [v2.18.3.8] - 2026-04-18

v2.18.3.8 - Espacos no titulo Data Hora para alinhar com valor

## [v2.18.3.7] - 2026-04-18

v2.18.3.7 - Alinhamento perfeito dos titulos acima dos valores na tarja vermelha usando measureText

## [v2.18.3.6] - 2026-04-18

v2.18.3.6 - Reduz tamanho da fonte da tarja vermelha para caber na largura da foto

## [v2.18.3.5] - 2026-04-18

v2.18.3.5 - Extrato enviado como imagem junto com as fotos em unico share

## [v2.18.3.4] - 2026-04-18

v2.18.3.4 - Correcao de versao (estava em 2.18.3.0 ha 3 deploys)

## [v2.18.3.0] - 2026-04-18

v2.18.3.0 - Fix: duas etapas automaticas - fotos + texto do extrato
v2.18.3.0 - Fix: fluxo corrigido para enviar fotos + extrato
v2.18.3.0 - Fix: fotos + extrato enviados juntos em unico share
v2.18.3.0 - Fix: extrato agora enviado apos as fotos (com retorno do share)
v2.18.3.0 - Foto processada armazenada diretamente no card da maquina

## [v2.18.2.0] - 2026-04-17

v2.18.2.0 - Extrato enviado ao grupo WhatsApp: fotos com tarja primeiro + separador + texto
v2.18.2.0 - Envio extrato WhatsApp: fotos com tarja primeiro + separador + texto
v2.18.2.0 - Origem no lote alterada para LOTE
v2.18.2.0 - Campo Origem tambem aplicado no lote (CAMERA)
v2.18.2.0 - Miniatura da foto com tarja no lugar do icone + campo Origem na tarja
v2.18.2.0 - Removida dependencia de variaveis de ambiente para IA

## [v2.18.1.0] - 2026-04-14

v2.18.1.0 - Configuracao de IA visivel somente ao Super Admin

## [v2.18.0.0] - 2026-04-14

v2.18.0.0 - Simplificacao para plano pago: remove fallback, delay reduzido

## [v2.17.1.0] - 2026-04-14

v2.17.1.0 - Fix: auto-retry em erros de rate limit e formato invalido + timeout na extracao manual

## [v2.12.5.0] - 2026-04-13

v2.12.5.0 - Style: tarja vermelha menor e fonte reduzida

## [v2.12.4.0] - 2026-04-13

v2.12.4.0 - Fix: prompt IA simplificado - busca valores apos os rotulos

## [v2.12.3.0] - 2026-04-13

v2.12.3.0 - Fix: prompt IA mais robusto para ler displays com rotulos customizados

## [v2.12.2.0] - 2026-04-13

v2.12.2.0 - Fix: prompt da IA agora respeita nomes customizados dos displays

## [v2.12.1.0] - 2026-04-13

v2.12.1.0 - Fix: API Keys da empresa enviadas e usadas nos endpoints de IA

## [v2.12.0.0] - 2026-04-13

v2.12.0.0 - Feat: API Keys salvas por provedor no cadastro da empresa

## [v2.11.1.3] - 2026-04-12

v2.11.1.3 - Chore: atualiza versao

## [v2.11.1.2] - 2026-04-12

v2.11.1.2 - Chore: atualiza versao

## [v2.11.1.1] - 2026-04-12

v2.11.1.1 - Chore: atualiza versao

## [v2.11.1.0] - 2026-04-12

v2.11.1.0 - Chore: atualiza versao

## [v2.11.0.5] - 2026-04-12

v2.11.0.5 - Feat: mostrar tempo de resposta no teste de conexao (principal e reserva)

## [v2.11.0.4] - 2026-04-12

v2.11.0.4 - Refactor: simplificar tela de config - botao de teste dentro dos cards principal e reserva

## [v2.11.0.3] - 2026-04-12

v2.11.0.3 - Fix: API Key de reserva nao era usada para OpenRouter/Gemini no teste de conexao

## [v2.11.0.2] - 2026-04-12

v2.11.0.2 - Chore: bump version

## [v2.11.0.1] - 2026-04-12

v2.11.0.1 - Fix: corrigir nomes dos modelos OpenRouter para os disponiveis (gemma-4-31b, gemma-3-27b, nemotron-12b-vl)

## [v2.11.0.0] - 2026-04-12

v2.11.0.0 - Feat: adicionar OpenRouter como provedor de IA com modelos gratuitos (Gemini Flash, Qwen VL, Llama 4)

## [v2.10.0.10] - 2026-04-12

v2.10.0.10 - Fix: remover glm-4v-flash (descontinuado), manter glm-4.6v-flash como unico gratuito da Zhipu AI

## [v2.10.0.9] - 2026-04-12

v2.10.0.9 - Fix: adicionar modelos visuais corretos da Zhipu AI (glm-4.6v, glm-4.6v-flash) + glm-5v-turbo

## [v2.10.0.8] - 2026-04-12

v2.10.0.8 - Fix: atualizar modelos Zhipu AI - remover obsoletos (glm-4v-plus/4v/4v-long) e adicionar glm-5v-turbo

## [v2.10.0.7] - 2026-04-12

v2.10.0.7 - Revertido: usuario cadastra suas proprias API Keys nas Configuracoes
v2.10.0.7 - Campo de API Key com botao mostrar/ocultar (icone de olho)
v2.10.0.7 - Link dinamico para obter API Key conforme provedor selecionado (Gemini/Zhipu)
v2.10.0.7 - Formato Zhipu AI (id.secret) indicado visualmente quando necessario
v2.10.0.7 - Badge "Key personalizada" mostrada quando usuario informa API Key propria
v2.10.0.7 - GET/PUT /configuracoes agora salva e retorna todos 4 campos (apiKey + model x2)
v2.10.0.7 - Rota testar aceita API Key do formulario para teste sem salvar
v2.10.0.7 - Prioridade da API Key: formulario > banco > env var do sistema

## [v2.10.0.5] - 2026-04-11

v2.10.0.5 - Simplificacao das Configuracoes: removido campo de API Key da interface
v2.10.0.5 - Usuario agora seleciona apenas o modelo de IA (principal e reserva)
v2.10.0.5 - API Key obtida automaticamente do sistema baseada no provedor do modelo
v2.10.0.5 - Gemini usa LLM_API_KEY, GLM usa LLM_API_KEY_GLM (ou fallback para LLM_API_KEY)
v2.10.0.5 - Criada funcao getApiKeyForModel() em zhipu-auth.ts para selecao automatica
v2.10.0.5 - Todas as rotas de IA (extrair, identificar-lote, testar) usam API Key automatica
v2.10.0.5 - Frontend nao envia mais apiKey nas requisicoes

## [v2.10.0.4] - 2026-04-11

v2.10.0.4 - Quando nenhuma API Key informada pelo usuario, usa a padrao do sistema (env var LLM_API_KEY)
v2.10.0.4 - Logica unificada para principal e reserva: corpo > banco > variaveis de ambiente
v2.10.0.4 - Botao Testar Reserva sempre habilitado (usa config do sistema se nada foi preenchido)
v2.10.0.4 - Origem da API Key mostrada no log: formulario, DB ou sistema (env)

## [v2.10.0.3] - 2026-04-11

v2.10.0.3 - Corrigido botao Testar Reserva: agora so habilita quando API Key E modelo estao preenchidos
v2.10.0.3 - Mensagens de erro especificas indicando qual campo esta faltando (API Key ou modelo)

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
