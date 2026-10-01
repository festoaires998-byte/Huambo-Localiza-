// Testes do site num navegador verdadeiro (Chromium, via Playwright).
// O Supabase é simulado: nenhum pedido sai para a internet.
// Correr: node tests/smoke.mjs
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const UID = 'aaaaaaaa-0000-4000-8000-000000000001';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const TOKEN = `${b64({ alg: 'HS256' })}.${b64({ sub: UID, email: 't@exemplo.ao' })}.x`;
const MAU = '<img src=x onerror="window.__xss=1">';

const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const servidor = http.createServer(async (req, res) => {
  const nome = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
  try {
    const dados = await readFile(path.join(RAIZ, nome));
    res.writeHead(200, { 'Content-Type': tipos[path.extname(nome)] || 'application/octet-stream' });
    res.end(dados);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${servidor.address().port}/`;

const browser = await chromium.launch(process.env.PLAYWRIGHT_BROWSERS_PATH ? {} : {});
const pedidos = [];
let respostaStorage = { status: 200, body: { Key: 'ok' } };
let respostaMudarPais = null;
let estadoMotorista = { application: null, profile: null };

async function abrir(query = '') {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  // Tudo o que não é o próprio site é simulado ou bloqueado.
  await page.route((url) => !url.href.startsWith(BASE), async (route) => {
    const u = new URL(route.request().url());
    const corpo = route.request().postData();
    pedidos.push({ url: u.href, corpo });
    const json = (o, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(o) });
    if (u.pathname.endsWith('/functions/v1/deliveries') && u.searchParams.get('action') === 'track') {
      return json({ tracking_code: 'AL-TESTE1', status: 'IN_TRANSIT', destination_area: MAU, history: [{ status: 'CREATED', created_at: '2026-09-30T10:00:00Z' }, { status: MAU, created_at: '2026-09-30T11:00:00Z' }] });
    }
    if (u.pathname.endsWith('/functions/v1/pesquisa') && u.searchParams.get('action') === 'cartao') {
      return json({ found: true, address: { postal_code: 'HB-01', plus_code: null, house_number: '12', reference: MAU, rua: 'Rua A', quadra: 'Q1' } });
    }
    if (u.pathname.endsWith('/functions/v1/pesquisa')) {
      return json({ tipo: 'texto', resultados: [{ tipo: 'morada', id: 'm1', titulo: MAU, subtitulo: 'Rua X', latitude: null, longitude: null, codigo_postal: 'X', plus_code: null }] });
    }
    if (u.pathname.endsWith('/functions/v1/citizen-verify') && u.searchParams.get('action') === 'submit') {
      return json({ ok: true, status: 'PENDING_REVIEW' });
    }
    if (u.pathname.endsWith('/functions/v1/citizen-verify') && u.searchParams.get('action') === 'status') {
      return json({ citizen_id_verified: false, citizen_id_status: 'PENDING_REVIEW' });
    }
    if (u.pathname.endsWith('/functions/v1/apagar-conta')) {
      return JSON.parse(corpo).confirmacao.trim().toUpperCase() === 'APAGAR' ? json({ ok: true }) : json({ error: 'CONFIRMACAO_EM_FALTA' }, 400);
    }
    if (u.pathname.endsWith('/rest/v1/user_country_profiles')) return json([{ country_code: 'AO' }]);
    if (u.pathname.endsWith('/rest/v1/rpc/mudar_pais_da_conta')) {
      return respostaMudarPais ? json(respostaMudarPais.body, respostaMudarPais.status) : json(JSON.parse(corpo).p_pais);
    }
    if (u.pathname.endsWith('/functions/v1/driver-kyc') && u.searchParams.get('action') === 'status') return json(estadoMotorista);
    if (u.pathname.endsWith('/functions/v1/driver-kyc') && u.searchParams.get('action') === 'set_online') return json({ ok: true, online: JSON.parse(corpo).online });
    if (u.pathname.startsWith('/storage/v1/object/')) return json(respostaStorage.body, respostaStorage.status);
    if (u.pathname.endsWith('/functions/v1/signing-keys')) return json({ ok: true });
    if (u.pathname.endsWith('/functions/v1/sync')) {
      const ops = JSON.parse(corpo).operations;
      return json({ results: ops.map((o) => ({ operation_id: o.operation_id, status: 'FAILED', error: 'recusada no teste' })) });
    }
    if (u.hostname.endsWith('supabase.co')) return json({});
    return route.abort();
  });
  await page.goto(BASE + 'index.html' + query);
  await page.waitForLoadState('load');
  return { page, erros, context };
}

let falhas = 0;
async function teste(nome, fn) {
  try { await fn(); console.log('✓', nome); }
  catch (e) { falhas++; console.error('✗', nome, '\n ', e.message); }
}

await teste('a página abre sem erros de JavaScript', async () => {
  const { page, erros, context } = await abrir();
  await page.waitForTimeout(500);
  assert.deepEqual(erros, []);
  await context.close();
});

await teste('esc() e urlSegura()', async () => {
  const { page, context } = await abrir();
  const r = await page.evaluate(() => [esc('<a href="x">\'&'), esc(null), urlSegura('javascript:alert(1)'), urlSegura('https://a/b?c=1&d=2')]);
  assert.deepEqual(r, ['&lt;a href=&quot;x&quot;&gt;&#39;&amp;', '', '', 'https://a/b?c=1&amp;d=2']);
  await context.close();
});

await teste('ids de operação são sempre UUID (também sem crypto.randomUUID)', async () => {
  const { page, context } = await abrir();
  const ids = await page.evaluate(() => { const a = makeOperationId(); crypto.randomUUID = undefined; return [a, makeOperationId()]; });
  ids.forEach((id) => assert.match(id, UUID));
  await context.close();
});

await teste('rastreio público: mostra zona e histórico sem executar HTML', async () => {
  const { page, erros, context } = await abrir('?rastreio=AL-TESTE1');
  await page.waitForSelector('#rastreio-conteudo .card');
  const texto = await page.textContent('#rastreio-conteudo');
  assert.match(texto, /AL-TESTE1/);
  assert.match(texto, /Em trânsito/);
  assert.match(texto, /Criada/);
  assert.equal(await page.locator('#rastreio-conteudo img').count(), 0);
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  const track = pedidos.find((p) => p.url.includes('action=track'));
  assert.deepEqual(JSON.parse(track.corpo), { tracking_code: 'AL-TESTE1' });
  assert.deepEqual(erros, []);
  await context.close();
});

await teste('cartão público ?endereco= usa pesquisa?action=cartao', async () => {
  const { page, context } = await abrir('?endereco=HB-01');
  await page.waitForSelector('#endereco-conteudo .card');
  const texto = await page.textContent('#endereco-conteudo');
  assert.match(texto, /HB-01/);
  assert.match(texto, /Rua A · Quadra Q1 · nº 12/);
  assert.equal(await page.locator('#endereco-conteudo img').count(), 0);
  await context.close();
});

await teste('QR da autenticação em dois passos: imagem data: é mostrada como imagem', async () => {
  const { page, context } = await abrir();
  const r = await page.evaluate(() => {
    const box = document.createElement('div');
    desenharQrMfa(box, { qr_code: 'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg"></svg>', secret: 'S' });
    const um = box.querySelector('img') && box.querySelector('img').getAttribute('src').slice(0, 19);
    desenharQrMfa(box, { qr_code: '<svg onload="window.__xss=2"></svg>' });
    return [um, box.querySelector('svg'), window.__xss];
  });
  assert.deepEqual(r, ['data:image/svg+xml;', null, undefined]);
  await context.close();
});

await teste('entregaIdMorada só aceita UUID', async () => {
  const { page, context } = await abrir();
  const r = await page.evaluate(() => [entregaIdMorada({ address_id: 'CARD:abc' }), entregaIdMorada({}), entregaIdMorada({ address_id: 'aaaaaaaa-0000-4000-8000-000000000009' })]);
  assert.deepEqual(r, [null, null, 'aaaaaaaa-0000-4000-8000-000000000009']);
  await context.close();
});

await teste('fotos vão para a pasta da pessoa; recusa do servidor não finge que ficou guardada', async () => {
  const { page, context } = await abrir();
  await page.evaluate((t) => { window.session = { access_token: t, email: 't@exemplo.ao' }; }, TOKEN);
  respostaStorage = { status: 200, body: { Key: 'ok' } };
  const ok = await page.evaluate(() => uploadFotoComFallback(new Blob(['x'], { type: 'image/jpeg' }), 'delivery-proofs', 'pod/../x'));
  assert.equal(ok.ok, true);
  assert.match(ok.url, new RegExp(`^delivery-proofs/${UID}/pod-\\.\\.-x-[0-9a-f-]{36}\\.jpg$`));
  const enviado = pedidos.filter((p) => p.url.includes('/storage/v1/object/delivery-proofs/')).pop();
  assert.ok(enviado.url.includes(`/delivery-proofs/${UID}/`));
  respostaStorage = { status: 400, body: { message: 'mime type not supported' } };
  const recusa = await page.evaluate(() => uploadFotoComFallback(new Blob(['x']), 'field-photos', 'a'));
  assert.equal(recusa.ok, false);
  assert.match(recusa.erro, /recusou a foto \(mime type not supported\)/);
  assert.equal(recusa.marcador, undefined);
  respostaStorage = { status: 200, body: { Key: 'ok' } };
  await context.close();
});

await teste('fila sem rede: favorito vai como create_favorite, o aparelho é registado e a recusa fica visível', async () => {
  const { page, context } = await abrir();
  await page.evaluate((t) => {
    window.session = { access_token: t, email: 't@exemplo.ao' };
    window.lastLocation = { lat: -12.77, lng: 15.73, plus_code: '6GXX+XX', postal_code: null, accuracy: 4 };
    lastLocation = window.lastLocation;
    guardarFavoritoNaFila();
  }, TOKEN);
  const antes = pedidos.length;
  await page.evaluate(() => syncPendingOps());
  await page.waitForFunction(() => !isSyncing, null, { timeout: 5000 });
  const novos = pedidos.slice(antes);
  const iRegisto = novos.findIndex((p) => p.url.includes('signing-keys'));
  const iSync = novos.findIndex((p) => p.url.includes('/functions/v1/sync'));
  assert.ok(iSync > -1, 'a sync foi chamada');
  if (iRegisto > -1) assert.ok(iRegisto < iSync, 'regista o aparelho antes da sync');
  const op = JSON.parse(novos[iSync].corpo).operations[0];
  assert.equal(op.operation_type, 'create_favorite');
  assert.match(op.operation_id, UUID);
  assert.match(op.payload.address_id, UUID);
  assert.equal(op.payload.address.latitude, -12.77);
  const fila = await page.evaluate(() => getPendingOps());
  assert.equal(fila.length, 1);
  assert.equal(fila[0].ultimo_erro, 'recusada no teste');
  await context.close();
});

await teste('pesquisa usa a função pesquisa e escapa o resultado', async () => {
  const { page, context } = await abrir();
  await page.evaluate((t) => { window.session = { access_token: t, email: 't@exemplo.ao' }; }, TOKEN);
  await page.evaluate(() => {
    const i = document.getElementById('search-input');
    i.value = 'Rua X'; i.dispatchEvent(new Event('input'));
  });
  await page.waitForFunction(() => document.getElementById('search-results').textContent.includes('Rua X'), null, { timeout: 5000 });
  assert.equal(await page.locator('#search-results img').count(), 0);
  const p = pedidos.filter((x) => x.url.endsWith('/functions/v1/pesquisa')).pop();
  assert.deepEqual(JSON.parse(p.corpo), { query: 'Rua X' });
  assert.ok(!pedidos.some((x) => /functions\/v1\/(search|resolve-address|routing)(\?|$)/.test(x.url)));
  await context.close();
});

await teste('verificação simples: depois de enviar diz "em revisão", nunca "Verificado!"', async () => {
  const { page, context } = await abrir();
  await page.evaluate((t) => {
    window.session = { access_token: t, email: 't@exemplo.ao' };
    session = window.session;
    myRoles = [];
    cidadaoVerifUrls.frente = 'u/f.jpg'; cidadaoVerifUrls.verso = 'u/v.jpg'; cidadaoVerifUrls.selfie = 'u/s.jpg';
    const b = document.getElementById('btn-cidadao-verif-enviar');
    b.disabled = false; b.click();
  }, TOKEN);
  await page.waitForFunction(() => document.getElementById('cidadao-verif-status').textContent.includes('Em revisão'), null, { timeout: 5000 });
  const msg = await page.evaluate(() => document.getElementById('cidadao-verif-msg').textContent);
  assert.match(msg, /Fica em revisão/);
  assert.doesNotMatch(msg, /Verificado/);
  await context.close();
});

await teste('política de privacidade: página abre e o ecrã de entrada liga para ela', async () => {
  const { page, context } = await abrir();
  assert.equal(await page.getAttribute('#link-privacidade', 'href'), 'privacidade.html');
  const p = await context.newPage();
  const erros = [];
  p.on('pageerror', (e) => erros.push(String(e)));
  await p.goto(BASE + 'privacidade.html');
  assert.equal(await p.title(), 'Política de privacidade — Angola Localiza');
  const texto = await p.textContent('main');
  for (const parte of ['Que dados recolhemos', 'Com quem partilhamos', 'Durante quanto tempo', 'Os teus direitos', 'Apagar a conta', 'Conta → Apagar a minha conta', 'segundo plano']) {
    assert.ok(texto.includes(parte), `falta: ${parte}`);
  }
  assert.deepEqual(erros, []);
  await context.close();
});

await teste('apagar a conta: só com APAGAR; depois sai, limpa a fila deste navegador e avisa', async () => {
  const { page, context } = await abrir();
  await page.evaluate(({ t, uid }) => {
    window.session = { access_token: t, email: 't@exemplo.ao' };
    session = window.session;
    localStorage.setItem('al_pending_op_x', JSON.stringify({ operation_id: 'x', owner_user_id: uid, operation_type: 'create_favorite', payload: {} }));
    localStorage.setItem('al_pending_op_y', JSON.stringify({ operation_id: 'y', owner_user_id: 'outra-pessoa', operation_type: 'create_favorite', payload: {} }));
  }, { t: TOKEN, uid: UID });
  const escrever = (texto) => page.evaluate((t) => {
    const campo = document.getElementById('apagar-conta-confirmacao');
    campo.value = t; campo.dispatchEvent(new Event('input'));
    return document.getElementById('btn-apagar-conta').disabled;
  }, texto);
  assert.equal(await page.evaluate(() => document.getElementById('btn-apagar-conta').disabled), true);
  assert.equal(await escrever('apaga'), true);
  assert.equal(await escrever('apagar'), false);
  const antes = pedidos.length;
  await page.evaluate(() => document.getElementById('btn-apagar-conta').click());
  await page.waitForFunction(() => document.getElementById('auth-msg').textContent.includes('foi apagada'), null, { timeout: 5000 });
  const pedido = pedidos.slice(antes).find((p) => p.url.includes('/functions/v1/apagar-conta'));
  assert.deepEqual(JSON.parse(pedido.corpo), { confirmacao: 'apagar' });
  assert.equal(await page.evaluate(() => localStorage.getItem('al_pending_op_x')), null);
  assert.ok(await page.evaluate(() => localStorage.getItem('al_pending_op_y')), 'a fila de outra pessoa fica');
  assert.equal(await page.evaluate(() => session), null);
  await context.close();
});


// Abre o separador Conta com uma sessão e estes cargos.
async function abrirConta(cargos) {
  const aberto = await abrir();
  await aberto.page.evaluate(({ t, cargos }) => {
    window.session = { access_token: t, email: 't@exemplo.ao' };
    session = window.session;
    myRoles = cargos;
    contaCarregar(); cidadaoLoadStatus();
  }, { t: TOKEN, cargos });
  await aberto.page.waitForFunction(() => document.getElementById('pais-conta-valor').textContent === '🇦🇴 Angola', null, { timeout: 5000 });
  return aberto;
}
const seccoesVisiveis = (page) => page.evaluate(() => [...document.querySelectorAll('#panel-definicoes .conta-sub')]
  .filter((el) => el.closest('.card').style.display !== 'none').map((el) => el.textContent));

await teste('Conta: as mesmas secções e a mesma ordem da app', async () => {
  const { page, erros, context } = await abrirConta([]);
  assert.equal((await page.textContent('#tab-btn-definicoes')).trim(), '👤Conta');
  assert.deepEqual(await seccoesVisiveis(page), ['A tua conta', 'País da conta', 'Motorista', 'Verificação simples', 'Notificações', 'Sincronização', 'Neste navegador', 'Ajuda', 'Apagar a minha conta']);
  assert.equal(await page.textContent('#conta-email'), 't@exemplo.ao');
  assert.equal(await page.textContent('#conta-cargos'), 'Cidadão');
  assert.equal(await page.textContent('#btn-logout'), 'Sair');
  assert.equal(await page.getAttribute('#link-privacidade-conta', 'href'), 'privacidade.html');
  await page.waitForFunction(() => /^Angola Localiza, versão \d{4}-\d{2}-\d{2}$/.test(document.getElementById('conta-versao').textContent), null, { timeout: 5000 });
  assert.deepEqual(erros, []);
  await context.close();
});

await teste('Conta: o pessoal vê a identidade e os dois passos, não a verificação simples nem "Mudar de país"', async () => {
  const { page, context } = await abrirConta(['tecnico_campo']);
  assert.deepEqual(await seccoesVisiveis(page), ['A tua conta', 'País da conta', 'Motorista', 'Verificação de identidade', 'Verificação em dois passos', 'Notificações', 'Sincronização', 'Neste navegador', 'Ajuda', 'Apagar a minha conta']);
  assert.equal(await page.textContent('#conta-cargos'), 'Técnico de campo');
  assert.equal(await page.evaluate(() => document.getElementById('btn-mudar-pais').style.display), 'none');
  assert.match(await page.textContent('#pais-conta-pessoal'), /pede a um administrador/);
  await context.close();
});

await teste('país da conta: só muda depois do aviso e grava no servidor', async () => {
  respostaMudarPais = null;
  const { page, context } = await abrirConta([]);
  const clicar = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
  const pedidosPais = () => pedidos.filter((p) => p.url.includes('/rpc/mudar_pais_da_conta'));
  const antes = pedidosPais().length;
  await clicar('#btn-mudar-pais');
  const opcoes = await page.evaluate(() => [...document.querySelectorAll('#pais-conta-opcoes button')].map((b) => b.textContent));
  assert.deepEqual(opcoes, ['🇲🇿 Moçambique', '🇨🇻 Cabo Verde', '🇬🇼 Guiné-Bissau', '🇸🇹 São Tomé e Príncipe']);
  await clicar('#pais-conta-opcoes button[data-pais="MZ"]');
  assert.equal(await page.textContent('#pais-conta-pergunta'), 'Mudar para 🇲🇿 Moçambique?');
  assert.match(await page.textContent('#pais-conta-aviso'), /As moradas que já guardaste não mudam/);
  await clicar('#btn-pais-cancelar');
  assert.equal(pedidosPais().length, antes, 'cancelar não pede nada');
  await clicar('#btn-mudar-pais');
  await clicar('#pais-conta-opcoes button[data-pais="MZ"]');
  assert.equal(await page.textContent('#btn-pais-confirmar'), 'Sim, mudar para Moçambique');
  await clicar('#btn-pais-confirmar');
  await page.waitForFunction(() => document.getElementById('pais-conta-msg').textContent === 'País da conta mudado para Moçambique.', null, { timeout: 5000 });
  assert.deepEqual(JSON.parse(pedidosPais().pop().corpo), { p_pais: 'MZ' });
  assert.equal(await page.textContent('#pais-conta-valor'), '🇲🇿 Moçambique');
  assert.match(await page.textContent('#session-label'), /^MZ · /);
  await context.close();
});

await teste('país da conta: se o servidor recusar, mostra o erro e o país fica', async () => {
  respostaMudarPais = { status: 400, body: { message: 'MUDAR_PAIS_MOTORISTA: os motoristas pedem a um administrador' } };
  const { page, context } = await abrirConta([]);
  await page.evaluate(() => { document.getElementById('btn-mudar-pais').click(); document.querySelector('#pais-conta-opcoes button[data-pais="CV"]').click(); document.getElementById('btn-pais-confirmar').click(); });
  await page.waitForFunction(() => /És motorista/.test(document.getElementById('pais-conta-msg').textContent), null, { timeout: 5000 });
  assert.equal(await page.textContent('#pais-conta-valor'), '🇦🇴 Angola');
  respostaMudarPais = null;
  await context.close();
});

await teste('motorista: candidatura recusada mostra o motivo e o formulário; aprovada mostra a disponibilidade', async () => {
  estadoMotorista = { application: { status: 'REJECTED', rejection_reason: 'Carta ilegível', country_code: 'AO' }, profile: null };
  const { page, context } = await abrirConta([]);
  await page.evaluate(() => document.getElementById('btn-motorista-abrir').click());
  await page.waitForFunction(() => /Carta ilegível/.test(document.getElementById('motorista-estado').textContent), null, { timeout: 5000 });
  assert.equal(await page.evaluate(() => document.getElementById('motorista-form').style.display), 'block');
  assert.equal(await page.locator('#motorista-docs input[type=file]').count(), 5);
  await page.evaluate(() => document.getElementById('btn-motorista-enviar').click());
  assert.equal(await page.textContent('#motorista-msg'), 'Faltam documentos/fotografias obrigatórios.');

  estadoMotorista = { application: { status: 'APPROVED', country_code: 'AO' }, profile: { online: false } };
  await page.evaluate(() => motoristaCarregar());
  await page.waitForFunction(() => document.getElementById('btn-motorista-disponivel').style.display === 'block', null, { timeout: 5000 });
  assert.equal(await page.textContent('#btn-motorista-disponivel'), 'Ficar disponível');
  assert.equal(await page.evaluate(() => document.getElementById('motorista-form').style.display), 'none');
  await page.evaluate(() => document.getElementById('btn-motorista-disponivel').click());
  await page.waitForFunction(() => /Estás disponível/.test(document.getElementById('motorista-msg').textContent), null, { timeout: 5000 });
  const p = pedidos.filter((x) => x.url.includes('driver-kyc?action=set_online')).pop();
  assert.deepEqual(JSON.parse(p.corpo), { online: true });
  estadoMotorista = { application: null, profile: null };
  await context.close();
});

await browser.close();
servidor.close();
if (falhas) { console.error(`${falhas} teste(s) falharam`); process.exit(1); }
console.log('Todos os testes passaram.');
