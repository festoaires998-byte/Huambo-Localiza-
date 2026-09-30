# Angola Localiza — site

Site (PWA) do Angola Localiza: endereçamento digital (Código Postal Digital),
mapa, entregas, levantamento de campo e painel de administração.
A app Android/iOS está no repositório **Angola-Localiza-2.2**; o site e a app
usam o **mesmo Supabase** e as **mesmas Edge Functions** (o código das funções
vive no repositório da app, em `supabase/functions/`).

## O que está neste repositório

```
index.html        O site inteiro (HTML + CSS + JavaScript, sem build)
sw.js             Service worker (funciona sem rede; mudar CACHE_NAME a cada versão)
version.json      Versão publicada (o site avisa quando há uma nova)
manifest.json     PWA (ícones, nome)
supabase/migrations/  Migrações antigas (as novas estão no repositório da app)
tests/smoke.mjs   Testes num navegador verdadeiro, com o Supabase simulado
docs/             Arquitetura e roadmap
.github/workflows/ci.yml            Verificações automáticas (ver abaixo)
.github/workflows/publish-pages.yml Publicação no GitHub Pages (a partir de main)
```

## Regras que o site segue (iguais às da app)

- **Fotos e documentos** vão sempre para a pasta de quem envia:
  `field-photos/<id>/…`, `delivery-proofs/<id>/…`, `kyc-artifacts/<id>/…`,
  `chat-media/<id>/…`. Os buckets são privados; o servidor devolve links
  temporários para ver os ficheiros.
- **Pesquisa**: função `pesquisa` (e `pesquisa?action=cartao` para o link
  público `?endereco=`). As funções antigas `search` e `resolve-address`
  estão desligadas.
- **Rastreio público** (`?rastreio=`): `deliveries?action=track`, sem sessão;
  só mostra o estado, as datas e a zona do destino.
- **Preços**: `pricing?action=quote` / `list_zones` / `admin_update_zone`
  (tabela `country_pricing_zones`, por país).
- **Rotas**: `geocode?action=optimize` (LocationIQ).
- **Sem rede**: a fila usa `create_favorite`, `create_delivery`,
  `field_submit`, `delivery_proof`; o navegador regista-se (`signing-keys`)
  antes de sincronizar. O código de rastreio e o PIN de uma entrega só
  existem depois de o servidor a criar.
- Todo o texto que vem do servidor passa por `esc()` antes de ir para a página.
- As funções são chamadas com a sessão (`cabecalhosFuncao()`), nunca só com a
  chave pública. **Nunca** usar a service role key no site.

## Verificações automáticas (CI)

- HTML válido e `node --check` em cada bloco `<script>`.
- Proíbe o uso das funções desligadas, links públicos para buckets privados
  e qualquer menção à service role key.
- `node tests/smoke.mjs`: abre o site no Chromium (Playwright) com o
  Supabase simulado e testa o rastreio, o cartão público, a pesquisa, os
  envios de fotos, a fila sem rede e a proteção contra HTML malicioso.

Para correr os testes localmente:

```bash
npm install --no-save playwright@1.56.1
npx playwright install chromium
node tests/smoke.mjs
```

Ver `docs/ROADMAP.md` para o estado de cada parte.
