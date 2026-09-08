# Arquitetura — Angola Localiza

## 1. Decisões arquiteturais

O documento técnico mestre original especifica NestJS + PostgreSQL/PostGIS + Redis + BullMQ + S3
como um monolito modular autogerido. Adaptando para GitHub + Supabase, mantemos os mesmos
princípios (Clean Architecture, separação de módulos, type safety) mas trocamos a infraestrutura:

| Peça do documento original | Decisão para Supabase | Justificação |
|---|---|---|
| PostgreSQL + PostGIS auto-gerido | Supabase Database (Postgres + PostGIS incluído) | Mesma engine, sem gerir infraestrutura; migrations continuam a ser SQL puro e versionado |
| Auth NestJS custom + MFA | Supabase Auth | Já implementa access/refresh token, MFA (TOTP), RLS integrado com `auth.uid()` |
| S3-compatible storage | Supabase Storage | API compatível, políticas de acesso via RLS |
| NestJS como backend único | Dividido em: RLS/Postgres functions (regras simples) + Supabase Edge Functions (lógica de negócio, ex: `PostalCodeService`) + serviço Node à parte só se necessário | Evita manter um servidor sempre ligado para lógica que cabe em funções serverless; mantém opção de "sair" do Supabase se um módulo crescer demais |
| Redis (cache) | Adiado — Postgres + Supabase cache/CDN chegam para o MVP | Introduzir Redis só quando houver medição real de necessidade (evita complexidade prematura) |
| BullMQ (filas) | Supabase `pg_cron` + tabela `sync_operations`/`imports` como fila, ou worker externo (Railway/Fly.io) para jobs pesados de import/export | BullMQ exige Redis dedicado; para volume inicial, fila em Postgres é suficiente e mais simples de operar |
| RBAC custom | Row Level Security (RLS) por tabela + tabela `organization_members` com `role` | RLS aplica as regras diretamente na base de dados, reduzindo risco de bypass pela API |

Este é um ponto de possível impacto permanente nos dados: a escolha entre "fila em Postgres" vs
"BullMQ+Redis" não é definitiva — se o volume de imports crescer muito, migramos para um worker com
fila dedicada sem alterar o schema de `imports`/`import_errors`. Recomendo começar simples (Postgres)
e medir antes de adicionar Redis.

## 2. Diagrama de arquitetura (visão geral)

```mermaid
flowchart TB
    subgraph Clientes
        WEB[Next.js Web]
        MOBILE[React Native + Expo<br/>SQLite offline]
        ADMIN[Painel institucional]
    end

    subgraph Supabase
        AUTH[Supabase Auth<br/>access/refresh + MFA]
        DB[(PostgreSQL + PostGIS<br/>RLS por tabela)]
        STORAGE[Supabase Storage<br/>fotos, cartões, placas]
        EDGE[Edge Functions<br/>PostalCodeService, Geocoding proxy]
        REALTIME[Realtime<br/>sync de entregas/field]
    end

    subgraph Externo
        WORKER[Worker externo opcional<br/>imports/exports pesados]
        MAPPROVIDER[MapProvider / GeocodingProvider<br/>abstração sobre fornecedor externo]
    end

    WEB --> AUTH
    MOBILE --> AUTH
    ADMIN --> AUTH
    WEB --> DB
    MOBILE -. sync quando online .-> DB
    ADMIN --> DB
    WEB --> EDGE
    MOBILE --> EDGE
    EDGE --> DB
    EDGE --> MAPPROVIDER
    DB --> STORAGE
    DB --> REALTIME
    DB -. jobs pesados .-> WORKER
    WORKER --> DB
