# CaixaFácil - Sistema de Gestão de Máquinas

Micro SaaS mobile para gestão financeira de máquinas de entretenimento (música, sinuca, urso, jogos).

## Funcionalidades

- **Dashboard** - Visão geral do negócio
- **Clientes** - Cadastro e gestão de clientes
- **Máquinas** - Cadastro de máquinas com controle de moedas
- **Tipos de Máquina** - Configuração de tipos (música, sinuca, etc.)
- **Leituras** - Registro de leituras com cálculo automático
- **Pagamentos** - Controle de pagamentos
- **Usuários** - Gestão de usuários com níveis de acesso
- **Extração por Foto** - OCR automático com IA

## Tecnologias

- Next.js 16
- TypeScript
- Prisma ORM
- PostgreSQL (Vercel Postgres)
- Tailwind CSS
- shadcn/ui

---

## Deploy no Vercel

### Passo 1: Importar Repositório

1. Acesse [vercel.com/new](https://vercel.com/new)
2. Importe o repositório `hscopes-hash/caixafacil`
3. Clique em **Import**

### Passo 2: Criar Banco PostgreSQL

1. No Vercel, vá em **Storage** → **Create Database**
2. Selecione **Postgres**
3. Nome do banco: `caixafacil-db`
4. Região: **São Paulo (gru1)** ou a mais próxima
5. Clique em **Create**

### Passo 3: Conectar Banco ao Projeto

1. Após criar o banco, clique em **Connect to Project**
2. Selecione o projeto `caixafacil`
3. O Vercel injetará automaticamente as variáveis de ambiente:
   - `POSTGRES_PRISMA_URL` (connection pooling)
   - `POSTGRES_URL_NON_POOLING` (conexão direta)

### Passo 4: Deploy

1. Clique em **Deploy**
2. Aguarde o build completar
3. As migrations serão executadas automaticamente

### Passo 5: Criar Dados Iniciais

Após o deploy, acesse a URL do seu projeto e:
1. A aplicação mostrará "Nenhuma empresa cadastrada"
2. Clique em **Criar dados de demonstração** para popular o banco

---

## Desenvolvimento Local

```bash
# Instalar dependências
bun install

# Configurar variáveis de ambiente
# Crie um arquivo .env com:
# POSTGRES_PRISMA_URL="postgresql://usuario:senha@localhost:5432/caixafacil"
# POSTGRES_URL_NON_POOLING="postgresql://usuario:senha@localhost:5432/caixafacil"

# Gerar Prisma Client
bun run db:generate

# Criar banco e tabelas
bun run db:push

# Iniciar servidor
bun run dev
```

---

## Estrutura do Projeto

```
src/
├── app/
│   ├── api/          # Rotas da API
│   ├── page.tsx      # Página principal
│   └── layout.tsx    # Layout global
├── components/       # Componentes UI (shadcn/ui)
├── lib/              # Utilitários e Prisma Client
└── stores/           # Estado global (Zustand)

prisma/
├── schema.prisma     # Schema do banco PostgreSQL
└── migrations/       # Migrations
```

---

## Comandos Úteis

```bash
# Gerar Prisma Client
bun run db:generate

# Criar migration
bun run db:migrate

# Deploy de migrations (produção)
bun run db:migrate:deploy

# Visualizar banco (Prisma Studio)
bun run db:studio

# Push direto (desenvolvimento)
bun run db:push
```

---

## Licença

Privado - Todos os direitos reservados
