# AstraHub - Waha ↔ Typebot + Quepasa ↔ Chatwoot

**Sistema completo de integração entre WhatsApp e plataformas de automação/atendimento:**
- **Waha → Typebot**: Automação de conversas com fluxos inteligentes
- **Quepasa → Chatwoot**: Gerenciamento de atendimento multiagente

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.2-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Swarm-blue.svg)](https://docs.docker.com/engine/swarm/)

---

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Funcionalidades](#-funcionalidades)
- [Stack Tecnológica](#-stack-tecnológica)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação](#-instalação)
- [Configuração](#-configuração)
- [Uso](#-uso)
- [API Endpoints](#-api-endpoints)
- [Deploy em Produção](#-deploy-em-produção)
- [Arquitetura](#-arquitetura)
- [Desenvolvimento](#-desenvolvimento)
- [Testes](#-testes)
- [Troubleshooting](#-troubleshooting)

**📚 Documentação Adicional:**
- [API.md](API.md) - Documentação completa da API REST

---

## 🎯 Visão Geral

O **AstraHub** é uma solução completa que oferece duas integrações poderosas:

### 🤖 Waha → Typebot (Automação)

- **Conectar** sessões do WhatsApp (via Waha) com fluxos conversacionais do Typebot
- **Automatizar** respostas usando IA e fluxos personalizados
- **Escalar** atendimento com bots inteligentes
- **Monitorar** todas as interações em tempo real

### 👥 Quepasa → Chatwoot (Atendimento Humano)

- **Conectar** números do WhatsApp (via Quepasa) com o Chatwoot
- **Gerenciar** conversas com atendimento multiagente
- **Organizar** tickets e departamentos
- **Integrar** com CRM e outras ferramentas
- **Relatórios** e métricas de atendimento

### Como funciona?

**Waha-Typebot:**
1. Configure credenciais Waha e Typebot
2. Liste sessões ativas do WhatsApp
3. Vincule sessão a fluxo Typebot
4. Mensagens são processadas automaticamente
5. Respostas enviadas via WhatsApp

**Quepasa-Chatwoot:**
1. Configure credenciais Quepasa e Chatwoot
2. Crie mapeamento de número WhatsApp
3. Configure integração automática
4. Receba mensagens no Chatwoot
5. Agentes respondem através da plataforma

---

## ✨ Funcionalidades

### Painel de Administração

- ✅ **Dashboard** com métricas em tempo real
  - Total de sessões ativas
  - Integrações configuradas
  - Mensagens processadas
  - Atividade recente (24h)

- ✅ **Gerenciamento de Sessões**
  - Listagem de todas as sessões Waha
  - Status em tempo real (CONNECTED/DISCONNECTED)
  - Busca e filtros
  - Envio de mensagens de teste

- ✅ **Configuração de Integrações**
  - Vincular sessões a fluxos do Typebot
  - Suporte a múltiplas integrações
  - Ativar/desativar integrações
  - Configuração individual de API keys

- ✅ **Logs e Monitoramento**
  - Histórico completo de eventos
  - Filtros por sessão, direção e provedor
  - Visualização de payloads JSON
  - Paginação inteligente

- ✅ **Configurações do Sistema**
  - Configuração centralizada de Waha e Typebot
  - Teste de conexão em tempo real
  - Endpoints parametrizáveis
  - Validação de formulários

### Backend API

- ✅ **RESTful API** completa com TypeScript
- ✅ **Autenticação** via Bearer token
- ✅ **Validação** com Zod schemas
- ✅ **Logging** estruturado com Pino
- ✅ **Health checks** para monitoramento
- ✅ **Error handling** robusto
- ✅ **Rate limiting** e segurança

### Integrações

**Waha-Typebot:**
- ✅ **Waha Client** com retry automático
- ✅ **Typebot Client** com suporte a sessões
- ✅ **Webhooks** para recebimento de mensagens
- ✅ **Adaptadores** configuráveis para diferentes versões
- ✅ **Timeouts** e tratamento de erros

**Quepasa-Chatwoot:**
- ✅ **Quepasa Client** completo com todas as APIs
- ✅ **Chatwoot Client** para gerenciamento de conversas
- ✅ **QR Code** dinâmico para conectar WhatsApp
- ✅ **Sincronização** automática de conexões
- ✅ **Webhooks bidirecionais** (Quepasa ↔ Chatwoot)
- ✅ **Cache de contatos** e conversas
- ✅ **Idempotência** de mensagens
- ✅ **Suporte a mídias**: imagens, vídeos, áudios, documentos, PTT
- ✅ **Buttons e respostas rápidas**
- ✅ **Perfil de contatos** com foto
- ✅ **Status de entrega** e leitura

---

## 🛠 Stack Tecnológica

### Backend

- **Runtime:** Node.js 20 (Alpine)
- **Framework:** Express 4.18
- **Linguagem:** TypeScript 5.3
- **Database:** PostgreSQL 16
- **ORM:** Prisma 5.8
- **Validação:** Zod 3.22
- **HTTP Client:** Axios 1.6
- **Logging:** Pino 8.17
- **Security:** Helmet 7.1, CORS

### Frontend

- **Framework:** React 18.2
- **Build Tool:** Vite 5.0
- **Linguagem:** TypeScript 5.3
- **Routing:** React Router DOM 6.21
- **State:** Zustand 4.4
- **Styling:** TailwindCSS 3.4
- **Icons:** Lucide React
- **Notifications:** React Hot Toast
- **HTTP Client:** Axios 1.6

### DevOps

- **Containerização:** Docker (multi-stage builds)
- **Orquestração:** Docker Swarm
- **Proxy Reverso:** Traefik (external)
- **SSL:** Let's Encrypt (via Traefik)
- **CI/CD:** GitHub Actions (opcional)

---

## 📦 Pré-requisitos

- **Docker** 20.10+ com Swarm habilitado
- **Docker Compose** 3.8+
- **Traefik** configurado na rede `network_public`
- **Node.js** 20+ (apenas para desenvolvimento local)
- **PostgreSQL** 16 (incluído no stack)

### Serviços Externos

**Para Waha-Typebot:**
- **Waha API** configurada e acessível
- **Typebot** configurado com fluxos criados

**Para Quepasa-Chatwoot:**
- **Quepasa** servidor configurado e rodando
- **Chatwoot** instância ativa (cloud ou self-hosted)

---

## 🚀 Instalação

### Opção 1: Deploy Rápido com Docker Swarm (Recomendado)

```bash
# Clone o repositório
git clone https://github.com/AstraOnlineWeb/astrahub.git
cd astrahub

# Configure as variáveis de ambiente
cp .env.example .env
nano .env  # Edite com suas configurações

# Build das imagens
make build

# Deploy no Swarm
make deploy

# Verifique o status
make status
```

### Opção 2: Desenvolvimento Local

```bash
# Instale as dependências
make install

# Configure o ambiente
cp api/.env.example api/.env
cp web/.env.example web/.env

# Configure o banco de dados (use Docker ou local)
docker run -d \
  --name integrador-db \
  -e POSTGRES_DB=integrador \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:16-alpine

# Execute as migrations
cd api && npm run migrate:dev

# Inicie o desenvolvimento
make dev
```

Acesse:
- **Frontend:** http://localhost:5173 (AstraHub Web)
- **API:** http://localhost:3000 (AstraHub API)
- **Health:** http://localhost:3000/health

---

## ⚙️ Configuração

### Variáveis de Ambiente

#### Root `.env` (para Docker Swarm)

```bash
# Docker & Deployment
DOCKER_REGISTRY=              # Opcional: seu registry privado
VERSION=latest

# Database
POSTGRES_PASSWORD=SuaSenhaSegura123!

# Application
ADMIN_TOKEN=seu-token-secreto-seguro

# Waha Configuration
WAHA_HOST=https://waha.seudominio.com.br
WAHA_API_KEY=sua-api-key-waha
WAHA_API_BASE_PATH=/api

# Typebot Configuration
TYPEBOT_HOST=https://typebot.seudominio.com.br
TYPEBOT_FLOW_ID=             # Opcional: fluxo padrão
TYPEBOT_API_KEY=             # Opcional: API key
TYPEBOT_API_BASE_PATH=/api/v1

# Quepasa Configuration
QUEPASA_URL=https://quepasa.seudominio.com.br
QUEPASA_USER=admin@example.com    # Email admin do Quepasa
QUEPASA_PASSWORD=senha-admin      # Senha admin do Quepasa

# System Configuration
SYSTEM_BASE_URL=https://astrahub.seudominio.com.br

# Logging
LOG_LEVEL=info
```

#### API `.env` (para desenvolvimento local)

```bash
NODE_ENV=development
PORT=3000
ADMIN_TOKEN=seu-token-local

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/integrador?schema=public

WAHA_HOST=https://waha.seudominio.com.br
WAHA_API_KEY=sua-api-key
WAHA_API_BASE_PATH=/api

TYPEBOT_HOST=https://typebot.seudominio.com.br
TYPEBOT_API_BASE_PATH=/api/v1

QUEPASA_URL=https://quepasa.seudominio.com.br
QUEPASA_USER=admin@example.com
QUEPASA_PASSWORD=senha-admin

SYSTEM_BASE_URL=http://localhost:3000

CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=debug
```

#### Web `.env` (para desenvolvimento local)

```bash
VITE_API_URL=http://localhost:3000
```

---

## 📖 Uso

### 1. Acesse o Painel

Navegue até `https://astrahub.seudominio.com.br` (produção) ou `http://localhost:5173` (dev)

### 2. Faça Login

Use o token configurado em `ADMIN_TOKEN`

### 3. Configure o Sistema

1. Vá em **Configurações**
2. Preencha:
   - Host e API Key da Waha
   - Host e configurações do Typebot
3. Clique em **Testar Conexão**
4. Salve as configurações

### 4. Vincule uma Sessão

1. Vá em **Sessões**
2. Clique em **Vincular ao Typebot** na sessão desejada
3. Preencha:
   - ID do fluxo do Typebot
   - (Opcional) Host customizado
   - (Opcional) API Key específica
4. Confirme

### 5. Monitore

- **Dashboard:** visão geral das métricas
- **Logs:** eventos detalhados de cada interação

---

## 📡 API Endpoints

### Públicos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/health` | Health check |
| POST | `/api/webhooks/waha` | Webhook para mensagens da Waha |

### Protegidos (requer `Authorization: Bearer TOKEN`)

#### Settings

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/settings` | Listar configurações |
| POST | `/api/settings` | Atualizar configurações |
| GET | `/api/settings/:key` | Obter configuração específica |

#### Waha

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/waha/test` | Testar conexão Waha |
| GET | `/api/waha/sessions` | Listar sessões |
| GET | `/api/waha/sessions/:id` | Obter sessão específica |
| POST | `/api/messages/test` | Enviar mensagem teste |

#### Mappings

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/mappings` | Listar mapeamentos |
| POST | `/api/mappings` | Criar mapeamento |
| GET | `/api/mappings/:id` | Obter mapeamento |
| PATCH | `/api/mappings/:id` | Atualizar mapeamento |
| DELETE | `/api/mappings/:id` | Deletar mapeamento |
| GET | `/api/mappings/session/:sessionId` | Listar por sessão |

#### Logs & Metrics

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/logs` | Listar logs (paginado) |
| GET | `/api/logs/:id` | Obter log específico |
| GET | `/api/metrics` | Obter métricas do sistema |

#### Quepasa

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/quepasa/test` | Testar conexão Quepasa |
| POST | `/api/quepasa/qr` | Obter QR code para conectar |
| GET | `/api/quepasa/status/:mappingId` | Status da conexão |
| GET | `/api/quepasa/info/:mappingId` | Info da conexão |
| POST | `/api/quepasa/disconnect/:mappingId` | Desconectar sessão |
| POST | `/api/quepasa/sync` | Sincronizar bots do servidor |

#### Quepasa Mappings

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/quepasa-mappings` | Listar mapeamentos |
| POST | `/api/quepasa-mappings` | Criar mapeamento |
| GET | `/api/quepasa-mappings/:id` | Obter mapeamento |
| PATCH | `/api/quepasa-mappings/:id` | Atualizar mapeamento |
| DELETE | `/api/quepasa-mappings/:id` | Deletar mapeamento |
| POST | `/api/quepasa-mappings/:id/setup` | Configurar integração Chatwoot |

#### Webhooks

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/webhooks/quepasa/:token` | Receber mensagens do Quepasa |
| POST | `/api/webhooks/chatwoot/:mappingId` | Receber mensagens do Chatwoot |

### Exemplos

```bash
# Health check
curl https://astrahub.seudominio.com.br/health

# Listar sessões
curl -H "Authorization: Bearer seu-token" \
  https://astrahub.seudominio.com.br/api/waha/sessions

# Criar mapeamento
curl -X POST \
  -H "Authorization: Bearer seu-token" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "default",
    "typebotFlowId": "cm123abc",
    "typebotHost": "https://typebot.io"
  }' \
  https://astrahub.seudominio.com.br/api/mappings
```

### Documentação Completa da API

Para detalhes completos sobre todos os endpoints, autenticação, códigos de resposta, exemplos em múltiplas linguagens e troubleshooting, consulte:

**📘 [API.md](API.md) - Documentação Completa da API REST**

---

## 🐳 Deploy em Produção

### Pré-requisitos

1. **Docker Swarm inicializado**

```bash
docker swarm init
```

2. **Rede Traefik criada**

```bash
docker network create --driver=overlay network_public
```

3. **Traefik rodando** com labels configuradas para Let's Encrypt

### Deploy

```bash
# 1. Clone o repositório
git clone https://github.com/AstraOnlineWeb/astrahub.git
cd astrahub

# 2. Configure .env
cp .env.example .env
nano .env

# 3. Build das imagens
docker build -t astrahub-api:latest ./api
docker build -t astrahub-web:latest ./web

# 4. Deploy
docker stack deploy -c stack.yml astrahub

# 5. Verifique
docker stack ps astrahub
docker service logs -f astrahub_api
```

### Verificação

```bash
# Status dos serviços
docker stack services astrahub

# Logs
make logs        # API
make logs-web    # Frontend
make logs-db     # Database

# Health checks
curl https://astrahub.seudominio.com.br/health
```

### Atualização

```bash
# Rebuild e redeploy
make update

# Ou manualmente:
make build
make deploy
```

---

## 🏗 Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                         Traefik                              │
│         (SSL, Load Balancing, Routing)                       │
└────────┬────────────────────────────────┬───────────────────┘
         │                                │
         │ /                              │ /api
         │                                │
┌────────▼─────────┐             ┌────────▼──────────┐
│                  │             │                   │
│  Frontend (Web)  │────────────▶│   Backend (API)   │
│                  │  API Calls  │                   │
│  - React + Vite  │             │  - Express + TS   │
│  - TailwindCSS   │             │  - Prisma ORM     │
│  - Nginx         │             │  - Pino Logging   │
│                  │             │  - Clients:       │
│                  │             │    • Waha         │
│                  │             │    • Typebot      │
│                  │             │    • Quepasa      │
│                  │             │    • Chatwoot     │
└──────────────────┘             └─────────┬─────────┘
                                           │
                                           │ SQL
                                           │
                                 ┌─────────▼─────────┐
                                 │                   │
                                 │  PostgreSQL 16    │
                                 │                   │
                                 │  - app_settings   │
                                 │  - session_map... │
                                 │  - quepasa_map... │
                                 │  - event_logs     │
                                 │  - chatwoot_*     │
                                 │                   │
                                 └───────────────────┘

External APIs:
┌─────────────┐      ┌──────────────┐      ┌─────────────┐      ┌──────────────┐
│    Waha     │◀────▶│   Typebot    │      │   Quepasa   │◀────▶│  Chatwoot    │
│  (WhatsApp) │      │  (Chatbot)   │      │  (WhatsApp) │      │ (Atendimento)│
└─────────────┘      └──────────────┘      └─────────────┘      └──────────────┘
```

### Fluxo de Mensagens

**Waha-Typebot (Automação):**
```
1. WhatsApp → Waha → Webhook → API (/webhooks/waha)
2. API → Consulta SessionMapping no DB
3. API → Envia mensagem ao Typebot
4. Typebot → Processa e retorna resposta
5. API → Envia resposta via Waha
6. Waha → WhatsApp → Usuário
7. API → Registra evento no EventLog
```

**Quepasa-Chatwoot (Atendimento Humano):**
```
1. WhatsApp → Quepasa → Webhook → API (/webhooks/quepasa/:token)
2. API → Consulta QuepasaMapping no DB
3. API → Cria/Atualiza Contact no Chatwoot
4. API → Cria/Localiza Conversation no Chatwoot
5. API → Envia mensagem ao Chatwoot
6. Agente responde → Chatwoot → Webhook → API (/webhooks/chatwoot/:mappingId)
7. API → Envia resposta via Quepasa
8. Quepasa → WhatsApp → Usuário
9. API → Registra eventos no EventLog
```

---

## 💻 Desenvolvimento

### Estrutura do Projeto

```
astrahub/
├── api/                      # Backend
│   ├── src/
│   │   ├── clients/         # Waha & Typebot clients
│   │   ├── db/              # Prisma client & migrations
│   │   ├── middlewares/     # Auth, error handling
│   │   ├── routes/          # API endpoints
│   │   ├── utils/           # Helpers & logger
│   │   ├── config.ts        # Configuration
│   │   └── index.ts         # Entry point
│   ├── prisma/
│   │   └── schema.prisma    # Database schema
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── web/                      # Frontend
│   ├── src/
│   │   ├── components/      # Reusable components
│   │   ├── pages/           # Route pages
│   │   ├── services/        # API client
│   │   ├── hooks/           # Custom hooks
│   │   ├── types/           # TypeScript types
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── vite.config.ts
│
├── stack.yml                 # Docker Swarm stack
├── Makefile                  # Build & deploy commands
├── .env.example              # Environment template
└── README.md
```

### Comandos de Desenvolvimento

```bash
# Instalar dependências
make install

# Desenvolvimento
make dev              # API + Web em paralelo
cd api && npm run dev # Apenas API
cd web && npm run dev # Apenas Web

# Build
make build            # Docker images
cd api && npm run build  # TypeScript build
cd web && npm run build  # Vite build

# Database
cd api && npm run migrate:dev    # Criar migration
cd api && npm run migrate        # Aplicar migrations
cd api && npm run generate       # Gerar Prisma client
cd api && npm run seed           # Seed inicial

# Testes
make test
cd api && npm test

# Linting & Formatting
cd api && npm run lint
cd api && npm run format
cd web && npm run lint
cd web && npm run format

# Limpar
make clean
```

### Adicionando Novos Endpoints

1. **Crie a rota** em `api/src/routes/`

```typescript
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.get('/meu-endpoint', authMiddleware, async (req, res, next) => {
  try {
    // sua lógica
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
```

2. **Registre no `index.ts`**

```typescript
import meuRouter from './routes/meu.routes';
app.use('/api', meuRouter);
```

3. **Adicione ao cliente frontend** em `web/src/services/api.ts`

```typescript
export const meuEndpoint = async () => {
  const response = await api.get('/meu-endpoint');
  return response.data;
};
```

---

## 🧪 Testes

### Backend

```bash
cd api
npm test                 # Rodar todos os testes
npm test -- --coverage   # Com coverage
npm test health.test     # Teste específico
```

### Frontend

```bash
cd web
npm test
```

### Testes de Integração

```bash
# Health check
curl http://localhost:3000/health

# Listar sessões (requer token)
curl -H "Authorization: Bearer seu-token" \
  http://localhost:3000/api/waha/sessions
```

---

## 📱 Quepasa: Funcionalidades Detalhadas

O **Quepasa** é uma API REST para WhatsApp que oferece controle total sobre mensagens e conexões. Ele se diferencia por:

### Recursos Principais

#### 1. Envio de Mensagens

**Texto Simples:**
```bash
curl -X POST "https://quepasa.../send" \
  -H "X-QUEPASA-TOKEN: seu-token" \
  -H "X-QUEPASA-CHATID: 5561999999999" \
  -d '{"text": "Olá!"}'
```

**Texto com Resposta (Reply):**
```bash
curl -X POST "https://quepasa.../send" \
  -H "X-QUEPASA-TOKEN: seu-token" \
  -H "X-QUEPASA-CHATID: 5561999999999" \
  -d '{"text": "Respondendo...", "inreply": "message-id-original"}'
```

**Botões (Buttons):**
```bash
curl -X POST "https://quepasa.../send" \
  -H "X-QUEPASA-TOKEN: seu-token" \
  -H "X-QUEPASA-CHATID: 5561999999999" \
  -d '{"text": "Escolha uma opção $buttons:[Sim, Não, Talvez]"}'
```

#### 2. Envio de Mídias

**Por URL (Recomendado):**
```bash
curl -X POST "https://quepasa.../send" \
  -H "X-QUEPASA-TOKEN: seu-token" \
  -H "X-QUEPASA-CHATID: 5561999999999" \
  -d '{"url": "https://example.com/image.jpg"}'
```
- Quepasa baixa e envia automaticamente
- Suporta: JPG, PNG, PDF, MP4, MP3, OGG, etc.

**Por Base64:**
```bash
curl -X POST "https://quepasa.../send" \
  -H "X-QUEPASA-TOKEN: seu-token" \
  -H "X-QUEPASA-CHATID: 5561999999999" \
  -d '{
    "content": "data:image/jpeg;base64,/9j/4AAQ...",
    "mime": "image/jpeg",
    "filename": "foto.jpg"
  }'
```

**Áudio PTT (Push-to-Talk):**
```bash
curl -X POST "https://quepasa.../sendbinary/5561999999999" \
  -H "X-QUEPASA-TOKEN: seu-token" \
  -F "data=@audio.oga" \
  -F "ptt=true" \
  -F "duration=17"
```
- Formato: OGG Opus (codecs=opus)
- PTT aparece como mensagem de voz no WhatsApp
- Duração em segundos (opcional)

#### 3. Gerenciamento de Conexões

**QR Code para Conectar:**
```bash
curl "https://quepasa.../scan" \
  -H "X-QUEPASA-USER: admin@example.com" \
  -H "X-QUEPASA-TOKEN: seu-token" \
  --output qrcode.png
```

**Status da Conexão:**
```bash
curl "https://quepasa.../command?action=status" \
  -H "X-QUEPASA-TOKEN: seu-token"
```
Retorna: `ready`, `connecting`, `disconnected`, etc.

**Informações da Conexão:**
```bash
curl "https://quepasa.../info" \
  -H "X-QUEPASA-TOKEN: seu-token"
```
Retorna: número conectado, versão WhatsApp, bateria, etc.

**Desconectar (Logout):**
```bash
curl -X DELETE "https://quepasa.../info" \
  -H "X-QUEPASA-TOKEN: seu-token"
```

#### 4. Webhooks

**Configurar Webhook:**
```bash
curl -X POST "https://quepasa.../webhook" \
  -H "X-QUEPASA-TOKEN: seu-token" \
  -d '{
    "url": "https://astrahub.../api/webhooks/quepasa/token",
    "forwardinternal": true,
    "trackid": "minha-conexao"
  }'
```

**Payload Recebido (Webhook):**
```json
{
  "id": "message-id",
  "timestamp": 1234567890,
  "type": "text",
  "fromMe": false,
  "participant": "5561999999999@s.whatsapp.net",
  "text": "Mensagem do cliente",
  "chat": {
    "id": "5561999999999@s.whatsapp.net",
    "title": "Nome do Contato"
  }
}
```

#### 5. Recursos Adicionais

**Verificar Números no WhatsApp:**
```bash
curl -X POST "https://quepasa.../isonwhatsapp" \
  -H "X-QUEPASA-TOKEN: seu-token" \
  -d '["5561999999999", "5561888888888"]'
```
Retorna lista de números registrados.

**Foto de Perfil:**
```bash
curl "https://quepasa.../picinfo/5561999999999" \
  -H "X-QUEPASA-TOKEN: seu-token"
```

**Download de Mídia:**
```bash
curl "https://quepasa.../download/message-id" \
  -H "X-QUEPASA-TOKEN: seu-token" \
  --output arquivo.jpg
```

**Listar Todas as Conexões (Admin):**
```bash
curl "https://quepasa.../health" \
  -H "X-QUEPASA-USER: admin@example.com" \
  -H "X-QUEPASA-PASSWORD: senha"
```

### Tipos de Mídia Suportados

| Categoria | Formatos | Uso |
|-----------|----------|-----|
| **Imagens** | JPG, PNG, GIF, WEBP, BMP | Fotos, prints, memes |
| **Vídeos** | MP4, AVI, MOV, WMV, MKV, WEBM | Vídeos curtos/longos |
| **Áudios** | MP3, OGG, WAV, M4A, AAC, OPUS | Músicas, gravações |
| **Documentos** | PDF, DOC, DOCX, XLS, XLSX, PPT, TXT, CSV | Contratos, planilhas |
| **Compactados** | ZIP, RAR | Múltiplos arquivos |

### Integração com Chatwoot

O sistema integra automaticamente:

1. **Mensagens Recebidas**: Quepasa → API → Chatwoot
   - Cria contato se não existir
   - Cria/reabre conversa
   - Anexa mídias
   - Mantém contexto

2. **Mensagens Enviadas**: Chatwoot → API → Quepasa
   - Suporta texto, imagens, áudios, documentos
   - Preserva formatação markdown
   - Envia como PTT quando aplicável
   - Marca mensagens como entregues

3. **Recursos Especiais**:
   - Cache de contatos (evita requisições repetidas)
   - Idempotência de mensagens (evita duplicação)
   - Reabertura automática de tickets fechados (opcional)
   - Exibição de nome do agente nas mensagens (opcional)
   - Suporte a grupos do WhatsApp (opcional)

### Configuração no Painel

**1. Configurar Quepasa:**
- Vá em **Configurações**
- Preencha URL, usuário e senha do Quepasa
- Teste conexão

**2. Criar Mapeamento:**
- Vá em **Quepasa → Chatwoot**
- Clique em **Novo Mapeamento**
- Preencha:
  - Nome amigável
  - URL do Chatwoot
  - API Token do Chatwoot
  - Account ID do Chatwoot

**3. Conectar WhatsApp:**
- O sistema gera token único automaticamente
- Clique no botão QR Code
- Escaneie com WhatsApp
- Aguarde status "ready"

**4. Configurar Integração:**
- Clique no botão **Configurar Integração**
- O sistema automaticamente:
  - Cria inbox no Chatwoot
  - Configura webhooks bidirecionais
  - Ativa o mapeamento

**5. Pronto!**
- Mensagens recebidas aparecem no Chatwoot
- Agentes respondem pelo Chatwoot
- Respostas são enviadas via Quepasa → WhatsApp

---

## 🐛 Troubleshooting

### Problemas Comuns

#### 1. Erro de conexão com o banco de dados

```bash
# Verifique se o PostgreSQL está rodando
docker service ls | grep astrahub_db

# Veja os logs
docker service logs astrahub_db

# Verifique a DATABASE_URL
echo $DATABASE_URL
```

#### 2. Webhook não está recebendo mensagens

- Verifique se o webhook está configurado na Waha
- Confirme que a URL está acessível externamente
- Veja os logs: `make logs`

#### 3. Typebot não responde

- Teste a conexão manual:
  ```bash
  curl -X POST https://typebot.io/api/v1/typebots/SEU_FLOW_ID/startChat \
    -H "Content-Type: application/json" \
    -d '{"message": "teste"}'
  ```
- Verifique o flowId e apiKey
- Confirme o endpoint no Typebot

#### 4. Traefik não roteia corretamente

```bash
# Verifique as labels
docker service inspect astrahub_web --pretty

# Veja os logs do Traefik
docker service logs traefik_traefik

# Confirme a rede
docker network inspect network_public
```

#### 5. Build falha

```bash
# Limpe e reconstrua
make clean
make install
make build
```

#### 6. Quepasa não conecta (QR Code não funciona)

- Verifique se Quepasa URL está acessível
- Confirme que usuário/senha admin estão corretos
- Teste manualmente:
  ```bash
  curl https://quepasa.../health \
    -H "X-QUEPASA-USER: admin@example.com" \
    -H "X-QUEPASA-PASSWORD: senha"
  ```
- Verifique se token do mapeamento está correto
- Tente desconectar e reconectar

#### 7. Mensagens não chegam no Chatwoot

- Verifique se webhook do Quepasa está configurado:
  - URL: `https://astrahub.../api/webhooks/quepasa/{token}`
- Confirme que mapeamento está ativo
- Veja os logs: `make logs` e procure por erros de webhook
- Teste enviar mensagem manual pelo WhatsApp
- Verifique se inbox ID no Chatwoot está correto

#### 8. Respostas do Chatwoot não chegam no WhatsApp

- Verifique se webhook do Chatwoot está configurado:
  - URL: `https://astrahub.../api/webhooks/chatwoot/{mappingId}`
- Confirme que API Token do Chatwoot está correto
- Veja logs do Chatwoot para verificar se webhook está sendo chamado
- Teste com `curl` enviando payload de teste

### Logs Úteis

```bash
# Logs em tempo real
make logs              # API
make logs-web          # Frontend
make logs-db           # Database

# Logs de um serviço específico
docker service logs -f astrahub_api

# Inspecionar serviço
docker service ps astrahub_api
docker service inspect astrahub_api
```

---

## 📝 Licença

Este projeto está licenciado sob a **GNU Affero General Public License v3.0 (AGPLv3)**.

### O que isso significa?

A AGPLv3 é uma licença de software livre copyleft que garante:

✅ **Liberdade de uso:** Você pode usar este software para qualquer propósito, incluindo comercial
✅ **Liberdade de estudo:** Você pode estudar como o programa funciona e adaptá-lo às suas necessidades
✅ **Liberdade de distribuição:** Você pode redistribuir cópias para ajudar outras pessoas
✅ **Liberdade de modificação:** Você pode melhorar o programa e distribuir suas melhorias

### Requisitos importantes da AGPLv3

⚠️ **Copyleft forte:** Se você modificar e distribuir este software, deve disponibilizar o código-fonte sob a mesma licença
⚠️ **Cláusula de rede (Network Use):** Se você executar uma versão modificada em um servidor e permitir que outros a usem pela rede, você deve disponibilizar o código-fonte modificado
⚠️ **Preservação de avisos:** Você deve manter todos os avisos de copyright e licença intactos

### Por que AGPLv3?

Esta licença foi escolhida para:

1. **Garantir que melhorias retornem à comunidade:** Qualquer modificação ou extensão deve ser compartilhada
2. **Proteger contra uso SaaS fechado:** Mesmo quando usado como serviço web, o código deve ser aberto
3. **Manter o software livre:** Previne apropriação proprietária do código

### Compatibilidade

A AGPLv3 é compatível com:
- GPL v3
- Outros projetos AGPLv3
- Bibliotecas com licenças permissivas (MIT, Apache 2.0, BSD)

**Atenção:** A AGPLv3 NÃO é compatível com GPL v2 ou licenças proprietárias.

### Texto completo da licença

Veja o arquivo [LICENSE](LICENSE) para o texto completo da GNU Affero General Public License v3.0.

Para mais informações: https://www.gnu.org/licenses/agpl-3.0.html

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Add: MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

---

## 📞 Suporte e Comunidade

### 🛠️ Suporte Profissional

**Precisa de ajuda para melhorar, customizar ou implementar o projeto?**

📱 **WhatsApp**: [+55 61 9 9687-8959](https://wa.me/5561996878959)

💼 Temos uma equipe especializada para:
- ✅ Customizações e melhorias
- ✅ Implementação e deploy completo
- ✅ Configuração de arquitetura SaaS
- ✅ Integração com outras APIs
- ✅ Desenvolvimento de features específicas
- ✅ Suporte técnico dedicado
- ✅ Consultoria em automação WhatsApp
- ✅ Treinamento e documentação

### 👥 Comunidade

**Junte-se à nossa comunidade:**
- 💬 [Grupo WhatsApp](https://chat.whatsapp.com/LMa44csoeoS9gMjamMpbOK) - Tire dúvidas, compartilhe experiências e receba atualizações
- 🐛 [GitHub Issues](https://github.com/AstraOnlineWeb/astrahub/issues) - Reporte bugs e sugira melhorias

---

## 🎉 Agradecimentos

**APIs WhatsApp:**
- [Waha](https://waha.devlike.pro/) - WhatsApp HTTP API completa
- [Quepasa](https://github.com/nocodeleaks/quepasa) - WhatsApp API REST com multidevice

**Plataformas:**
- [Typebot](https://typebot.io/) - Open-source chatbot builder
- [Chatwoot](https://chatwoot.com/) - Open-source customer engagement platform

**Infraestrutura:**
- [Traefik](https://traefik.io/) - Cloud-native proxy e load balancer

---

**Desenvolvido com ❤️ para automação e atendimento via WhatsApp**
