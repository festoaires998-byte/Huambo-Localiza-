# Roadmap — Angola Localiza (GitHub + Supabase)

Ordem de implementação, adaptada da secção 26 do documento técnico mestre.
Cada fase termina com o projeto ainda executável.

- [x] **Fase 0/1 — Arquitetura + estrutura do repositório** (este entregável)
- [ ] **Fase 2 — Schema SQL/PostGIS + migrations** (tabelas essenciais primeiro)
- [ ] **Fase 3 — Auth + RLS** (Supabase Auth, `organization_members`, políticas por tabela)
- [ ] **Fase 4 — Mapa/GPS** (abstrações `MapProvider`/`GeocodingProvider`)
- [ ] **Fase 5 — Código Postal Digital** (`PostalCodeService` como Edge Function, versionado)
- [ ] **Fase 6 — QR Codes** (público/privado/temporário/entrega, tokens seguros)
- [ ] **Fase 7 — Pesquisa** (código, ZIP, Plus Code, texto, coordenadas)
- [ ] **Fase 8 — Cartão de endereço + partilha** (link público `/a/{codigo}`)
- [ ] **Fase 9 — Favoritos/histórico**
- [ ] **Fase 10 — Offline/sync** (SQLite mobile + fila de sincronização)
- [ ] **Fase 11 — Entregas** (estados, proof of delivery)
- [ ] **Fase 12 — Field app** (levantamento offline, deteção de duplicados)
- [ ] **Fase 13 — Admin/RBAC** (estados de morada, auditoria)
- [ ] **Fase 14 — API pública/empresarial** (OpenAPI, API keys, rate limiting)
- [ ] **Fase 15 — Import/export** (CSV/XLSX/GeoJSON, jobs em background)
- [ ] **Fase 16 — Segurança** (checklist OWASP completo)
- [ ] **Fase 17 — Testes** (unit, integration, E2E, cenários offline/GPS/QR)
- [ ] **Fase 18 — Performance**
- [ ] **Fase 19 — Deployment** (GitHub Actions → Supabase + hosting do web/mobile)

Nunca declarar uma fase "concluída em produção" sem confirmação real de deployment.
