# Roadmap — Angola Localiza (site)

Estado a 30/09/2026. "Feito" quer dizer que existe no site e no Supabase;
o que só se prova num telemóvel real está indicado.

- [x] Schema SQL/PostGIS, Auth, RLS e MFA para o pessoal
- [x] Mapa/GPS, Código Postal Digital, QR Codes
- [x] Pesquisa (função `pesquisa`) e cartão público (`?endereco=`)
- [x] Favoritos, histórico e fila sem rede (igual à app: `create_favorite`)
- [x] Entregas: criação (destino sempre com morada), preço por país, PIN no
      servidor, rastreio público, provas em `delivery-proofs`
- [x] Estafetas: disponível/indisponível; Admin revê candidaturas de motorista
- [x] Levantamento de campo e validação (fotos em `field-photos/<id>/`)
- [x] Verificação de identidade (cidadão: 4 estados; pessoal: BI + vídeo)
- [x] Admin: bandas de preço por país, auditoria, convites, links de adesão
- [x] API pública e chaves de API
- [x] Testes automáticos no navegador (`tests/smoke.mjs`)
- [ ] Mover o `spatial_ref_sys` do PostGIS (precisa do suporte do Supabase)
- [ ] Testes E2E contra um Supabase de teste (hoje o Supabase é simulado)

Nunca declarar uma parte "concluída em produção" sem confirmação real no telemóvel.
