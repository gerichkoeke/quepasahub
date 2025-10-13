# Integrador API

Backend API para integração Waha-Typebot.

## Stack

- Node.js 20
- Express 4.18
- TypeScript 5.3
- Prisma 5.8 (PostgreSQL 16)
- Pino (logging)
- Zod (validation)

## Desenvolvimento

```bash
# Instalar dependências
npm install

# Gerar Prisma client
npm run generate

# Rodar migrations
npm run migrate:dev

# Desenvolvimento
npm run dev

# Build
npm run build

# Produção
npm start

# Testes
npm test
```

## Estrutura

```
src/
├── clients/          # Waha & Typebot API clients
├── db/               # Prisma client & seed
├── middlewares/      # Auth, error handling
├── routes/           # API endpoints
├── utils/            # Logger, helpers
├── config.ts         # Configuration
└── index.ts          # Entry point
```

## Variáveis de Ambiente

Veja `.env.example` para todas as variáveis disponíveis.

## API Endpoints

### Públicos
- `GET /health` - Health check

### Protegidos (Bearer token)
- `GET /api/settings` - Configurações
- `GET /api/waha/sessions` - Sessões Waha
- `POST /api/mappings` - Criar integração
- `GET /api/logs` - Event logs
- `GET /api/metrics` - Métricas

Veja documentação completa no README raiz.
