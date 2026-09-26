// Angola Localiza - Service Worker
//
// IMPORTANTE PARA QUEM FOR ATUALIZAR ESTE FICHEIRO NO FUTURO:
// Sempre que publicares um novo index.html, muda o número aqui em baixo
// (ex.: 'v1' -> 'v2'). Sem isso, quem já tiver a app instalada fica preso
// à versão antiga para sempre, porque o telemóvel nunca mais volta a
// perguntar ao servidor se há algo novo.
const CACHE_NAME = 'angola-localiza-v2';

// Bibliotecas externas: mudam muito raramente, por isso podem ficar em
// cache "à vontade" (cache-first) sem risco de ficares preso numa versão antiga.
const BIBLIOTECAS_EXTERNAS = [
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jsqr/1.4.0/jsQR.js',
  'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/4.1.1/tesseract.min.js',
];

// Ficheiros do próprio site: o index.html é o mais importante de todos -
// é onde tudo o que construímos vive. Estes SÃO recarregados da rede
// sempre que há ligação (ver o "fetch" mais abaixo).
const FICHEIROS_DO_SITE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(FICHEIROS_DO_SITE.concat(BIBLIOTECAS_EXTERNAS));
    })
  );
  self.skipWaiting(); // ativa a versão nova assim que possível, não espera todas as abas fecharem
});

// Ao ativar, apaga caches de versões antigas (senão vão-se acumulando para sempre)
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (nomes) {
      return Promise.all(
        nomes.filter(function (nome) { return nome !== CACHE_NAME; })
          .map(function (nome) { return caches.delete(nome); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  var url = event.request.url;
  var ehBibliotecaExterna = BIBLIOTECAS_EXTERNAS.indexOf(url) > -1;

  if (ehBibliotecaExterna) {
    // Bibliotecas externas: usa o que está em cache, só vai à rede se não tiver
    event.respondWith(
      caches.match(event.request).then(function (emCache) {
        return emCache || fetch(event.request);
      })
    );
    return;
  }

  // Tudo o resto (o index.html, sobretudo): tenta sempre a rede primeiro,
  // para nunca mostrares a alguém uma versão desatualizada da app por engano.
  // Só usa o que está em cache quando mesmo não há rede nenhuma.
  event.respondWith(
    fetch(event.request)
      .then(function (respostaDaRede) {
        var copia = respostaDaRede.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copia); });
        return respostaDaRede;
      })
      .catch(function () {
        return caches.match(event.request).then(function (emCache) {
          return emCache || caches.match('./index.html');
        });
      })
  );
});
