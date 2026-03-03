# MES – Como Iniciar o Sistema

## Primeira execução (uma única vez)

```bash
# 1. Instalar dependências do backend
cd mes-app/backend
npm install

# 2. Importar o histórico do Excel para o banco de dados
npm run migrate

# 3. Instalar dependências do frontend
cd ../frontend
npm install
```

## Iniciar o sistema (todo dia)

Abra **dois terminais**:

**Terminal 1 – Backend (API):**
```bash
cd mes-app/backend
npm run dev
# → API rodando em http://localhost:3001
```

**Terminal 2 – Frontend:**
```bash
cd mes-app/frontend
npm run dev
# → App rodando em http://localhost:5173
```

Acesse: **http://localhost:5173**

---

## Comandos úteis

| Comando | O que faz |
|---|---|
| `npm run migrate` | Reimporta o Excel (apaga e recria o BD) |
| `npm run db:reset` | Apaga o banco sem reimportar |
| `npm run dev` | Inicia com hot-reload |

## Estrutura de pastas

```
mes-app/
├── backend/
│   ├── src/
│   │   ├── app.js              ← Express + rotas
│   │   ├── db/
│   │   │   ├── schema.sql      ← Definição das tabelas
│   │   │   └── database.js     ← Conexão SQLite (node:sqlite nativo)
│   │   └── routes/
│   │       ├── products.js     ← GET/POST /api/products
│   │       ├── operators.js    ← GET/POST /api/operators
│   │       ├── stages.js       ← GET/POST /api/stages
│   │       ├── orders.js       ← CRUD /api/orders + steps + pausas
│   │       └── dashboard.js    ← /api/dashboard/summary|by-stage|efficiency|timeline|daily
│   ├── scripts/
│   │   └── migrate.js          ← Importador do Excel
│   └── data/
│       └── mes.db              ← Banco SQLite (criado automaticamente)
└── frontend/
    └── src/
        ├── pages/
        │   ├── Dashboard.jsx   ← Gráficos + KPIs + Timeline
        │   ├── Orders.jsx      ← Lista de ordens com filtros
        │   ├── NewOrder.jsx    ← Formulário de nova ordem + etapas + pausas
        │   └── Cadastros.jsx   ← Gerenciar produtos, etapas, operadores
        ├── components/
        │   └── GanttChart.jsx  ← Timeline de ocupação
        ├── hooks/
        │   └── useApi.js       ← Hook de fetch
        └── api/
            └── client.js       ← Wrapper HTTP

```

## API – Endpoints principais

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/health` | Status da API |
| GET | `/api/orders?date_from=&date_to=` | Lista ordens |
| POST | `/api/orders` | Cria nova ordem |
| POST | `/api/orders/:id/steps` | Adiciona etapa à ordem |
| POST | `/api/orders/steps/:id/pauses` | Registra pausa em etapa |
| GET | `/api/dashboard/summary` | KPIs gerais |
| GET | `/api/dashboard/by-stage` | Tempo por etapa |
| GET | `/api/dashboard/efficiency` | Eficiência por produto |
| GET | `/api/dashboard/timeline` | Dados para Gantt |
| GET | `/api/dashboard/daily` | Produção diária |
