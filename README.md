# Angola Localiza

Plataforma de localização, endereçamento digital (Código Postal Digital) e logística para Angola.

## Estrutura do monorepo

```
apps/
  web/         Next.js + TypeScript (site público, cartão de endereço, painel institucional)
  mobile/      React Native + Expo + TypeScript (app principal, offline-first)
  admin/       Painel institucional (pode ser rota dentro de web/ ou app separada — decidir na Fase de UI)
  backend/     Lógica de negócio pesada que não cabe bem em Edge Functions (jobs, imports/exports, PostalCodeService)
    src/modules/  Um módulo por domínio (auth, addresses, postal-codes, deliveries, field, sync, ...)
packages/
  shared-types/  Tipos TypeScript partilhados entre web, mobile e backend (schemas, DTOs)
  ui/            Design system reutilizável (Button, Input, Map, AddressCard, QRCodeCard, StatusBadge, ...)
supabase/
  migrations/    Migrations SQL versionadas (schema + PostGIS + índices + RLS)
  functions/     Edge Functions (Deno) — ex: geração de Código Postal Digital, geocoding proxy
docs/            Arquitetura, decisões técnicas, runbooks
.github/workflows/  CI/CD (lint, testes, migrations, deploy)
```

## Stack

- **Frontend web:** Next.js + TypeScript
- **Mobile:** React Native + Expo + TypeScript, SQLite offline-first
- **Backend/lógica de negócio:** Supabase Edge Functions (Deno) para o essencial; serviço Node/NestJS à parte só se/quando a lógica não couber em Edge Functions (ex: jobs pesados de import/export)
- **Base de dados:** Supabase (PostgreSQL + PostGIS)
- **Auth:** Supabase Auth (access/refresh token nativo, MFA para admins)
- **Storage:** Supabase Storage (fotos de entregas, cartões exportados, placas)
- **CI/CD:** GitHub Actions

Ver `docs/ARQUITETURA.md` para as decisões detalhadas e justificação de cada escolha.

## Setup local

```bash
# 1. Instalar dependências (quando os package.json existirem em cada app)
npm install

# 2. Configurar Supabase local
npx supabase init
npx supabase start

# 3. Aplicar migrations
npx supabase db push

# 4. Copiar variáveis de ambiente
cp environment.example .env
```

## Estado do projeto

Fase atual: **Fase 0/1 — arquitetura e estrutura do repositório.**
Ver `docs/ROADMAP.md` para a ordem completa das fases.
