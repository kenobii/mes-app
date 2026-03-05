# Dados Operacionais — MES

Sistema web para gestão e visualização da produção, substituindo o controle manual em planilhas. Permite registrar ordens de produção, etapas, pausas e acompanhar indicadores operacionais em tempo real.

## Funcionalidades

- **Dashboard** com KPIs de produção, eficiência por produto, tempo por etapa e timeline diária
- **Ordens de produção** com filtros por data, produto e status; exportação para CSV
- **Detalhamento por ordem** com etapas, pausas e tempos líquidos/brutos
- **Análise por etapa** com comparativo de metas vs. realizado
- **Gráfico de Gantt** com ocupação diária por operador
- **Cadastros** (admin): produtos, etapas, operadores e metas de tempo
- **Modo convidado**: acesso somente leitura sem necessidade de login

## Tecnologias

| Camada    | Tecnologia                              |
|-----------|-----------------------------------------|
| Frontend  | React 18, Tailwind CSS, Recharts, Vite  |
| Backend   | Node.js, Express                        |
| Banco     | SQLite via `node:sqlite` nativo         |
| Auth      | JWT (jsonwebtoken + bcryptjs)           |
| Deploy    | Railway (Nixpacks)                      |

## Estrutura do Projeto

```
mes-app/
├── backend/
│   ├── src/
│   │   ├── app.js                  # Servidor Express + rotas
│   │   ├── db/
│   │   │   ├── schema.sql          # Definição das tabelas
│   │   │   └── database.js         # Conexão SQLite
│   │   ├── middleware/
│   │   │   └── auth.js             # JWT, admin, guest
│   │   ├── repositories/           # Queries SQL
│   │   ├── routes/                 # Endpoints da API
│   │   └── services/
│   │       └── emailService.js     # Envio de senha temporária
│   ├── scripts/
│   │   └── migrate.js              # Importador do Excel histórico
│   └── data/
│       └── mes.db                  # Banco SQLite (não versionado)
└── frontend/
    └── src/
        ├── pages/                  # Dashboard, Ordens, Cadastros…
        ├── components/             # GanttChart, EditModal…
        ├── context/
        │   └── AuthContext.jsx     # Autenticação + modo convidado
        ├── hooks/
        │   └── useApi.js           # Hook de fetch
        └── api/
            └── client.js          # Wrapper HTTP
```

## Executar Localmente

### Primeira vez

```bash
# Instalar dependências
cd mes-app/backend && npm install
cd ../frontend && npm install

# Importar histórico do Excel para o banco
cd ../backend && npm run migrate
```

### Todo dia

```bash
# Terminal 1 — Backend (porta 3001)
cd mes-app/backend
npm run dev

# Terminal 2 — Frontend (porta 5173)
cd mes-app/frontend
npm run dev
```

Acesse: `http://localhost:5173`

> **Requisito:** Node.js v22+. O backend usa `node:sqlite` com a flag `--experimental-sqlite`.

## Variáveis de Ambiente

Crie `mes-app/backend/.env` (nunca commitar):

```env
JWT_SECRET=sua_chave_secreta_aqui
GMAIL_USER=seu@gmail.com
GMAIL_PASS=senha_de_app_gmail
```

`GMAIL_USER` e `GMAIL_PASS` são opcionais — usados apenas para envio de senha temporária ao criar operadores.

## API — Endpoints Principais

| Método | Endpoint                    | Descricao                       | Auth       |
|--------|-----------------------------|---------------------------------|------------|
| POST   | `/api/auth/login`           | Login com email e senha         | Publico    |
| GET    | `/api/auth/guest-token`     | Token de acesso como convidado  | Publico    |
| GET    | `/api/orders`               | Lista ordens (filtros por data) | Convidado+ |
| POST   | `/api/orders`               | Cria nova ordem                 | Usuario+   |
| PUT    | `/api/orders/:id`           | Atualiza ordem                  | Usuario+   |
| DELETE | `/api/orders/:id`           | Remove ordem                    | Usuario+   |
| GET    | `/api/dashboard/summary`    | KPIs gerais                     | Convidado+ |
| GET    | `/api/dashboard/by-stage`   | Tempo por etapa                 | Convidado+ |
| GET    | `/api/dashboard/efficiency` | Eficiencia por produto          | Convidado+ |
| POST   | `/api/products`             | Cria produto                    | Admin      |
| POST   | `/api/operators`            | Cria operador                   | Admin      |

## Perfis de Acesso

| Perfil        | Visualizar | Criar/Editar ordens | Cadastros |
|---------------|:----------:|:-------------------:|:---------:|
| **Convidado** | sim        | nao                 | nao       |
| **Usuario**   | sim        | sim                 | nao       |
| **Admin**     | sim        | sim                 | sim       |

## Deploy (Railway)

O deploy e automatico via push para a branch `main`. O Railway executa:

1. `npm install --include=dev --prefix frontend` — instala dependencias incluindo Vite
2. `npm run build --prefix frontend` — gera o build estatico em `frontend/dist`
3. `npm start` — inicia o backend, que serve o frontend estatico em producao

O banco de dados (`mes.db`) persiste em volume separado no Railway e **nao e afetado por novos deploys**.
