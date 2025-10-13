# API Documentation - AstraHub

Documentação completa da API REST do sistema AstraHub.

---

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Autenticação](#autenticação)
- [Base URL](#base-url)
- [Códigos de Resposta](#códigos-de-resposta)
- [Endpoints](#endpoints)
  - [Health Check](#health-check)
  - [Settings](#settings)
  - [Waha](#waha)
  - [Typebot](#typebot)
  - [Session Mappings](#session-mappings)
  - [Quepasa](#quepasa)
  - [Quepasa Mappings](#quepasa-mappings)
  - [Logs](#logs)
  - [Metrics](#metrics)
  - [Webhooks](#webhooks)
- [Exemplos de Integração](#exemplos-de-integração)
- [Rate Limiting](#rate-limiting)
- [Erros Comuns](#erros-comuns)

---

## Visão Geral

A API do AstraHub é uma API REST que permite:

- **Gerenciar configurações** globais do sistema
- **Integrar Waha com Typebot** para automação de conversas
- **Integrar Quepasa com Chatwoot** para atendimento humano
- **Monitorar eventos** e logs em tempo real
- **Receber webhooks** de todas as plataformas

### Características

- ✅ **RESTful**: Usa verbos HTTP padrão (GET, POST, PATCH, DELETE)
- ✅ **JSON**: Todas as requisições e respostas em JSON
- ✅ **Autenticação**: Bearer token para endpoints protegidos
- ✅ **Validação**: Schemas Zod para validação robusta
- ✅ **Logs**: Logging estruturado com Pino
- ✅ **Error Handling**: Mensagens de erro claras e consistentes

---

## Autenticação

Todos os endpoints (exceto `/health` e webhooks) requerem autenticação via **Bearer Token**.

### Como Autenticar

Inclua o header `Authorization` em todas as requisições:

```bash
Authorization: Bearer seu-token-aqui
```

### Exemplo

```bash
curl -X GET https://integrador.seudominio.com.br/api/settings \
  -H "Authorization: Bearer seu-token-secreto"
```

### Configurar Token

O token é definido na variável de ambiente `ADMIN_TOKEN` no arquivo `.env`:

```bash
ADMIN_TOKEN=seu-token-secreto-seguro
```

### Resposta de Erro (401 Unauthorized)

```json
{
  "error": "Unauthorized",
  "message": "Token de autenticação inválido ou ausente"
}
```

---

## Base URL

**Produção:**
```
https://astrahub.seudominio.com.br
```

**Desenvolvimento Local:**
```
http://localhost:3000
```

Todos os endpoints são prefixados com `/api` (exceto `/health`).

---

## Códigos de Resposta

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | OK | Requisição bem-sucedida |
| 201 | Created | Recurso criado com sucesso |
| 400 | Bad Request | Dados inválidos ou faltando |
| 401 | Unauthorized | Token ausente ou inválido |
| 404 | Not Found | Recurso não encontrado |
| 500 | Internal Server Error | Erro no servidor |

### Formato de Erro Padrão

```json
{
  "error": "Nome do erro",
  "message": "Descrição detalhada do erro",
  "details": {} // Opcional: detalhes adicionais
}
```

---

## Endpoints

### Health Check

#### `GET /health`

Verifica se o servidor está online e conectado ao banco de dados.

**Autenticação:** ❌ Não requerida

**Resposta de Sucesso (200):**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-13T10:30:00.000Z",
  "uptime": 3600,
  "database": "connected"
}
```

**Exemplo:**
```bash
curl https://astrahub.seudominio.com.br/health
```

---

### Settings

Gerenciamento de configurações globais do sistema.

#### `GET /api/settings`

Lista todas as configurações (API keys são mascaradas).

**Autenticação:** ✅ Requerida

**Resposta (200):**
```json
{
  "waha_host": "https://waha.seudominio.com.br",
  "waha_api_key": "***",
  "typebot_host": "https://typebot.seudominio.com.br",
  "quepasa_url": "https://quepasa.seudominio.com.br",
  "quepasa_user": "admin@example.com",
  "quepasa_password": "***"
}
```

#### `GET /api/settings/:key`

Obtém uma configuração específica.

**Parâmetros:**
- `key` (string): Chave da configuração

**Resposta (200):**
```json
{
  "key": "waha_host",
  "value": "https://waha.seudominio.com.br"
}
```

#### `POST /api/settings`

Atualiza uma ou mais configurações.

**Body:**
```json
{
  "waha_host": "https://waha.example.com",
  "waha_api_key": "nova-api-key"
}
```

**Resposta (200):**
```json
{
  "updated": ["waha_host", "waha_api_key"],
  "count": 2
}
```

**Exemplo:**
```bash
curl -X POST https://astrahub.seudominio.com.br/api/settings \
  -H "Authorization: Bearer seu-token" \
  -H "Content-Type: application/json" \
  -d '{
    "waha_host": "https://waha.example.com",
    "waha_api_key": "nova-api-key"
  }'
```

---

### Waha

Gerenciamento de sessões Waha (WhatsApp API).

#### `GET /api/waha/test`

Testa conexão com Waha.

**Autenticação:** ✅ Requerida

**Resposta (200):**
```json
{
  "success": true,
  "message": "Conexão com Waha estabelecida com sucesso"
}
```

#### `GET /api/waha/sessions`

Lista todas as sessões Waha disponíveis.

**Resposta (200):**
```json
[
  {
    "id": "default",
    "status": "CONNECTED",
    "me": {
      "id": "5561996878959@s.whatsapp.net",
      "pushName": "Meu Nome"
    }
  }
]
```

#### `GET /api/waha/sessions/:id`

Obtém detalhes de uma sessão específica.

**Parâmetros:**
- `id` (string): ID da sessão

**Resposta (200):**
```json
{
  "id": "default",
  "status": "CONNECTED",
  "me": {
    "id": "5561996878959@s.whatsapp.net",
    "pushName": "Meu Nome"
  }
}
```

---

### Typebot

Não há endpoints específicos de Typebot. A integração é feita através dos Session Mappings.

---

### Session Mappings

Gerenciamento de integrações Waha → Typebot.

#### `GET /api/mappings`

Lista todos os mapeamentos.

**Query Params (opcionais):**
- `active` (boolean): Filtrar por status ativo/inativo
- `sessionId` (string): Filtrar por sessão

**Resposta (200):**
```json
[
  {
    "id": "uuid-1234",
    "sessionId": "default",
    "typebotFlowId": "cm123abc",
    "typebotHost": "https://typebot.io",
    "active": true,
    "createdAt": "2025-10-13T10:00:00.000Z"
  }
]
```

#### `POST /api/mappings`

Cria um novo mapeamento Waha → Typebot.

**Body:**
```json
{
  "sessionId": "default",
  "typebotFlowId": "cm123abc",
  "typebotHost": "https://typebot.io",
  "typebotApiKey": "opcional-api-key",
  "active": true
}
```

**Resposta (201):**
```json
{
  "id": "uuid-1234",
  "sessionId": "default",
  "typebotFlowId": "cm123abc",
  "typebotHost": "https://typebot.io",
  "active": true,
  "createdAt": "2025-10-13T10:00:00.000Z"
}
```

#### `PATCH /api/mappings/:id`

Atualiza um mapeamento existente.

**Parâmetros:**
- `id` (string): ID do mapeamento

**Body (todos os campos opcionais):**
```json
{
  "typebotFlowId": "novo-flow-id",
  "active": false
}
```

**Resposta (200):**
```json
{
  "id": "uuid-1234",
  "sessionId": "default",
  "typebotFlowId": "novo-flow-id",
  "active": false,
  "updatedAt": "2025-10-13T11:00:00.000Z"
}
```

#### `DELETE /api/mappings/:id`

Deleta um mapeamento.

**Resposta (200):**
```json
{
  "success": true,
  "message": "Mapeamento deletado com sucesso"
}
```

---

### Quepasa

Gerenciamento de conexões Quepasa (WhatsApp API REST).

#### `GET /api/quepasa/test`

Testa conexão com servidor Quepasa.

**Autenticação:** ✅ Requerida

**Resposta (200):**
```json
{
  "success": true,
  "message": "Quepasa service is available and configured"
}
```

#### `POST /api/quepasa/qr`

Obtém QR Code para conectar WhatsApp.

**Body:**
```json
{
  "mappingId": "uuid-do-mapeamento"
}
```

**Resposta (200):**
```
Content-Type: image/png
[Binary PNG data]
```

**Exemplo:**
```bash
curl -X POST https://astrahub.seudominio.com.br/api/quepasa/qr \
  -H "Authorization: Bearer seu-token" \
  -H "Content-Type: application/json" \
  -d '{"mappingId": "uuid-1234"}' \
  --output qrcode.png
```

#### `GET /api/quepasa/status/:mappingId`

Verifica status da conexão Quepasa.

**Parâmetros:**
- `mappingId` (string): ID do mapeamento

**Resposta (200):**
```json
{
  "success": true,
  "status": "ready"
}
```

**Status possíveis:**
- `ready` - Conectado
- `connecting` - Conectando
- `waiting_scan` - Aguardando scan do QR
- `disconnected` - Desconectado
- `not_configured` - Não configurado

#### `GET /api/quepasa/info/:mappingId`

Obtém informações da conexão.

**Resposta (200):**
```json
{
  "success": true,
  "server": {
    "wid": "5561996878959@s.whatsapp.net",
    "platform": "android",
    "battery": 95,
    "connected": true
  }
}
```

#### `POST /api/quepasa/disconnect/:mappingId`

Desconecta sessão WhatsApp (logout).

**Resposta (200):**
```json
{
  "success": true,
  "message": "Conexão desconectada com sucesso"
}
```

#### `POST /api/quepasa/sync`

Sincroniza conexões do servidor Quepasa com o banco de dados.

**Resposta (200):**
```json
{
  "total": 5,
  "imported": 0,
  "updated": 3,
  "skipped": 2,
  "deleted": 0,
  "errors": []
}
```

---

### Quepasa Mappings

Gerenciamento de integrações Quepasa → Chatwoot.

#### `GET /api/quepasa-mappings`

Lista todos os mapeamentos Quepasa.

**Query Params (opcionais):**
- `active` (boolean): Filtrar por status

**Resposta (200):**
```json
[
  {
    "id": "uuid-1234",
    "quepasaToken": "token-unico",
    "phoneNumber": "5561996878959",
    "name": "Atendimento Principal",
    "chatwootBaseUrl": "https://app.chatwoot.com",
    "chatwootInboxId": "123",
    "chatwootAccountId": "1",
    "active": true,
    "createdAt": "2025-10-13T10:00:00.000Z"
  }
]
```

#### `POST /api/quepasa-mappings`

Cria novo mapeamento Quepasa → Chatwoot.

**Body:**
```json
{
  "name": "Atendimento Principal",
  "phoneNumber": "5561996878959",
  "chatwootBaseUrl": "https://app.chatwoot.com",
  "chatwootApiToken": "seu-api-token",
  "chatwootAccountId": "1",
  "chatwootInboxName": "WhatsApp - Principal",
  "active": true
}
```

**Resposta (201):**
```json
{
  "id": "uuid-1234",
  "quepasaToken": "token-gerado-automaticamente",
  "phoneNumber": "5561996878959",
  "name": "Atendimento Principal",
  "chatwootBaseUrl": "https://app.chatwoot.com",
  "chatwootInboxId": "pending",
  "chatwootAccountId": "1",
  "active": true,
  "createdAt": "2025-10-13T10:00:00.000Z"
}
```

#### `PATCH /api/quepasa-mappings/:id`

Atualiza mapeamento existente.

**Body (todos os campos opcionais):**
```json
{
  "name": "Novo Nome",
  "active": false
}
```

**Resposta (200):**
```json
{
  "id": "uuid-1234",
  "name": "Novo Nome",
  "active": false,
  "updatedAt": "2025-10-13T11:00:00.000Z"
}
```

#### `DELETE /api/quepasa-mappings/:id`

Deleta mapeamento.

**Resposta (200):**
```json
{
  "success": true,
  "message": "Mapeamento deletado com sucesso"
}
```

#### `POST /api/quepasa-mappings/:id/setup`

Configura integração completa com Chatwoot (cria inbox, configura webhooks).

**Resposta (200):**
```json
{
  "success": true,
  "inboxId": "123",
  "webhookUrl": "https://integrador.../api/webhooks/quepasa/token-unico",
  "message": "Integração Chatwoot configurada com sucesso"
}
```

---

### Logs

Consulta de logs e eventos do sistema.

#### `GET /api/logs`

Lista logs com paginação.

**Query Params (opcionais):**
- `page` (number): Página (padrão: 1)
- `limit` (number): Itens por página (padrão: 50, max: 100)
- `sessionId` (string): Filtrar por sessão
- `direction` (string): `in` ou `out`
- `provider` (string): `waha`, `typebot`, `quepasa`, `chatwoot`
- `peer` (string): Número do contato

**Resposta (200):**
```json
{
  "logs": [
    {
      "id": "uuid-1234",
      "direction": "in",
      "provider": "waha",
      "sessionId": "default",
      "peer": "5561996878959@s.whatsapp.net",
      "payload": {
        "text": "Olá!",
        "timestamp": 1634123456
      },
      "createdAt": "2025-10-13T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "pages": 3
  }
}
```

#### `GET /api/logs/:id`

Obtém um log específico com payload completo.

**Resposta (200):**
```json
{
  "id": "uuid-1234",
  "direction": "in",
  "provider": "waha",
  "sessionId": "default",
  "peer": "5561996878959@s.whatsapp.net",
  "payload": {
    "text": "Olá!",
    "timestamp": 1634123456,
    "fullPayload": "..."
  },
  "createdAt": "2025-10-13T10:30:00.000Z"
}
```

---

### Metrics

Métricas e estatísticas do sistema.

#### `GET /api/metrics`

Obtém métricas gerais.

**Resposta (200):**
```json
{
  "sessions": {
    "total": 5,
    "active": 3
  },
  "mappings": {
    "waha_typebot": 3,
    "quepasa_chatwoot": 2
  },
  "messages": {
    "last24h": 1523,
    "today": 892
  },
  "uptime": 86400
}
```

---

### Webhooks

Endpoints para receber webhooks das plataformas externas.

#### `POST /api/webhooks/waha`

Recebe mensagens da Waha.

**Autenticação:** ❌ Não requerida (webhook público)

**Headers esperados:**
- `Content-Type: application/json`

**Body (exemplo):**
```json
{
  "event": "message",
  "session": "default",
  "payload": {
    "id": "message-id",
    "timestamp": 1634123456,
    "from": "5561996878959@s.whatsapp.net",
    "body": "Olá!",
    "hasMedia": false
  }
}
```

**Resposta (200):**
```json
{
  "success": true,
  "processed": true
}
```

#### `POST /api/webhooks/quepasa/:token`

Recebe mensagens do Quepasa.

**Autenticação:** ❌ Não requerida (usa token na URL)

**Parâmetros:**
- `token` (string): Token único do mapeamento

**Body (exemplo):**
```json
{
  "id": "message-id",
  "timestamp": 1634123456,
  "type": "text",
  "fromMe": false,
  "participant": "5561996878959@s.whatsapp.net",
  "text": "Olá!",
  "chat": {
    "id": "5561996878959@s.whatsapp.net",
    "title": "Nome do Contato"
  }
}
```

**Resposta (200):**
```json
{
  "success": true,
  "processed": true
}
```

#### `POST /api/webhooks/chatwoot/:mappingId`

Recebe mensagens do Chatwoot.

**Autenticação:** ❌ Não requerida (webhook público)

**Parâmetros:**
- `mappingId` (string): ID do mapeamento

**Body (exemplo):**
```json
{
  "event": "message_created",
  "message_type": "outgoing",
  "conversation": {
    "id": 123
  },
  "sender": {
    "name": "Agente"
  },
  "content": "Resposta do agente",
  "attachments": []
}
```

**Resposta (200):**
```json
{
  "success": true,
  "sent": true,
  "quepasaMessageId": "message-id-quepasa"
}
```

---

## Exemplos de Integração

### Node.js / JavaScript

```javascript
const axios = require('axios');

const API_BASE = 'https://astrahub.seudominio.com.br';
const API_TOKEN = 'seu-token-secreto';

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Authorization': `Bearer ${API_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

// Listar sessões Waha
async function listWahaSessions() {
  const response = await client.get('/api/waha/sessions');
  return response.data;
}

// Criar mapeamento Waha → Typebot
async function createMapping(sessionId, typebotFlowId) {
  const response = await client.post('/api/mappings', {
    sessionId,
    typebotFlowId,
    typebotHost: 'https://typebot.io',
    active: true,
  });
  return response.data;
}

// Listar logs
async function getLogs(filters = {}) {
  const response = await client.get('/api/logs', { params: filters });
  return response.data;
}
```

### Python

```python
import requests

API_BASE = 'https://astrahub.seudominio.com.br'
API_TOKEN = 'seu-token-secreto'

headers = {
    'Authorization': f'Bearer {API_TOKEN}',
    'Content-Type': 'application/json',
}

# Listar sessões Waha
def list_waha_sessions():
    response = requests.get(f'{API_BASE}/api/waha/sessions', headers=headers)
    return response.json()

# Criar mapeamento Quepasa → Chatwoot
def create_quepasa_mapping(name, chatwoot_url, chatwoot_token):
    data = {
        'name': name,
        'chatwootBaseUrl': chatwoot_url,
        'chatwootApiToken': chatwoot_token,
        'chatwootAccountId': '1',
        'active': True,
    }
    response = requests.post(
        f'{API_BASE}/api/quepasa-mappings',
        headers=headers,
        json=data
    )
    return response.json()

# Obter métricas
def get_metrics():
    response = requests.get(f'{API_BASE}/api/metrics', headers=headers)
    return response.json()
```

### cURL

```bash
# Testar saúde do servidor
curl https://astrahub.seudominio.com.br/health

# Listar configurações
curl -H "Authorization: Bearer seu-token" \
  https://astrahub.seudominio.com.br/api/settings

# Criar mapeamento Waha → Typebot
curl -X POST \
  -H "Authorization: Bearer seu-token" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "default",
    "typebotFlowId": "cm123abc",
    "typebotHost": "https://typebot.io",
    "active": true
  }' \
  https://astrahub.seudominio.com.br/api/mappings

# Obter QR Code Quepasa
curl -X POST \
  -H "Authorization: Bearer seu-token" \
  -H "Content-Type: application/json" \
  -d '{"mappingId": "uuid-1234"}' \
  https://astrahub.seudominio.com.br/api/quepasa/qr \
  --output qrcode.png

# Listar logs com filtros
curl -H "Authorization: Bearer seu-token" \
  "https://astrahub.seudominio.com.br/api/logs?provider=quepasa&direction=in&limit=20"
```

---

## Rate Limiting

A API não implementa rate limiting atualmente, mas recomendamos:

- **Máximo 100 requisições por minuto** por IP
- **Webhooks:** sem limite (processamento assíncrono)

Em caso de uso intensivo, considere implementar cache no cliente.

---

## Erros Comuns

### 401 Unauthorized

**Causa:** Token ausente ou inválido

**Solução:**
```bash
# Verifique se o token está correto
curl -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  https://astrahub.seudominio.com.br/api/settings
```

### 400 Bad Request

**Causa:** Dados inválidos no body da requisição

**Exemplo de resposta:**
```json
{
  "error": "Validation Error",
  "details": [
    {
      "field": "sessionId",
      "message": "Required"
    }
  ]
}
```

**Solução:** Verifique o schema de validação e envie todos os campos obrigatórios.

### 404 Not Found

**Causa:** Recurso não encontrado (ID inválido)

**Solução:** Verifique se o ID do recurso está correto.

### 500 Internal Server Error

**Causa:** Erro interno do servidor

**Solução:**
1. Verifique os logs: `docker service logs astrahub_api`
2. Confirme que banco de dados está online
3. Verifique conectividade com APIs externas (Waha, Typebot, Quepasa, Chatwoot)

---

## Suporte

- **Issues:** [GitHub Issues](https://github.com/AstraOnlineWeb/astrahub/issues)
- **Logs:** `docker service logs astrahub_api`
- **Health Check:** `GET /health`

---

**Última atualização:** 2025-10-13
