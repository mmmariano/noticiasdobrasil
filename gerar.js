// Gerador do site Notícias do Brasil.
// Lê o noticias.json e escreve o site pronto na pasta "public".
// Rodar: node gerar.js   (a Vercel roda isso sozinha a cada commit)
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RAIZ = __dirname;
const SAIDA = path.join(RAIZ, 'public');
const ARQUIVOS_ESTATICOS = ['style.css', 'app.js', 'logo.png', 'og-default.png', 'favicon.png', 'robots.txt'];

// ---------- utilidades ----------
function falha(msg) {
  console.error('\nERRO no noticias.json: ' + msg + '\n');
  process.exit(1);
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const DIAS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MESES_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function partes(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  if (isNaN(d) || d.getUTCMonth() !== +m[2] - 1) return null;
  return { a: +m[1], m: +m[2], d: +m[3], dow: d.getUTCDay(), t: d.getTime() };
}
const dataCurta = (iso) => { const p = partes(iso); return p.d + ' de ' + MESES[p.m - 1]; };
const dataLonga = (iso) => { const p = partes(iso); return p.d + ' de ' + MESES[p.m - 1] + ' de ' + p.a; };
const dataBR = (iso) => { const p = partes(iso); return String(p.d).padStart(2, '0') + '/' + String(p.m).padStart(2, '0') + '/' + p.a; };
const dataRSS = (iso) => {
  const p = partes(iso);
  return DIAS_EN[p.dow] + ', ' + String(p.d).padStart(2, '0') + ' ' + MESES_EN[p.m - 1] + ' ' + p.a + ' 12:00:00 +0000';
};

function hojeSaoPaulo() {
  if (process.env.DATA_HOJE) return process.env.DATA_HOJE;
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function cortar(txt, max) {
  txt = String(txt).replace(/\s+/g, ' ').trim();
  if (txt.length <= max) return txt;
  const c = txt.slice(0, max);
  return c.slice(0, c.lastIndexOf(' ')).replace(/[ ,;:.]+$/, '') + '…';
}

const semTags = (h) => String(h)
  .replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g, '[$2]($1)')
  .replace(/<[^>]+>/g, '')
  .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

const ldjson = (o) => '<script type="application/ld+json">' + JSON.stringify(o).replace(/</g, '\\u003c') + '</script>';

// ---------- leitura e validação ----------
function baixar(url) {
  const alvo = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
  const codigo = "fetch(process.argv[1],{headers:{'cache-control':'no-cache'}}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.text()}).then(function(t){process.stdout.write(t)}).catch(function(e){console.error(e.message);process.exit(2)})";
  return require('child_process').execFileSync(process.execPath, ['-e', codigo, alvo], { encoding: 'utf8', timeout: 30000, maxBuffer: 50 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}

function carregarDados() {
  let base = {};
  const local = path.join(RAIZ, 'noticias.json');
  if (fs.existsSync(local)) {
    try { base = JSON.parse(fs.readFileSync(local, 'utf8')); } catch (e) { falha('o noticias.json do repositório não é um JSON válido (' + e.message + ').'); }
  }
  const url = process.env.NOTICIAS_URL || base.fonte_noticias;
  if (!url) return base;
  try {
    const texto = baixar(url);
    let remoto;
    try { remoto = JSON.parse(texto); } catch (e) { falha('o arquivo baixado de ' + url + ' não é um JSON válido (' + e.message + '). Confira vírgulas, aspas e chaves.'); }
    if (Array.isArray(remoto)) remoto = { noticias: remoto };
    console.log('Notícias lidas de ' + url);
    return Object.assign({}, base, remoto);
  } catch (e) {
    if (base.noticias && base.noticias.length) {
      console.warn('AVISO: não consegui baixar ' + url + ' (' + String(e.stderr || e.message).trim() + '). Usando as notícias do noticias.json do repositório.');
      return base;
    }
    falha('não consegui baixar ' + url + ' (' + String(e.stderr || e.message).trim() + ').');
  }
}

const dados = carregarDados();

const site = dados.site || falha('falta o bloco "site".');
const URL = String(site.url || '').replace(/\/+$/, '');
if (!URL) falha('falta site.url');
const NOME = site.nome || 'Notícias do Brasil';
const secoes = dados.secoes || [];
const mapaSecoes = {};
secoes.forEach((s) => { mapaSecoes[s.slug] = s; });
const paginas = dados.paginas || [];
const agenda = dados.agenda || [];

const slugs = new Set();
const noticias = (dados.noticias || []).map((n, i) => {
  const onde = 'notícia nº ' + (i + 1) + (n.slug ? ' ("' + n.slug + '")' : '');
  ['slug', 'titulo', 'secao', 'data', 'resumo'].forEach((k) => { if (!n[k]) falha(onde + ': falta o campo "' + k + '".'); });
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(n.slug)) falha(onde + ': o slug só pode ter letras minúsculas sem acento, números e hífen (ex.: "meu-titulo").');
  if (slugs.has(n.slug)) falha('o slug "' + n.slug + '" aparece em mais de uma notícia.');
  slugs.add(n.slug);
  if (!mapaSecoes[n.secao]) falha(onde + ': a seção "' + n.secao + '" não existe em "secoes".');
  if (!partes(n.data)) falha(onde + ': data inválida "' + n.data + '". Use AAAA-MM-DD, ex.: 2026-10-19.');
  if (n.atualizado && !partes(n.atualizado)) falha(onde + ': "atualizado" inválido. Use AAAA-MM-DD.');
  return Object.assign({ rotulo: mapaSecoes[n.secao].nome, corpo: [], fontes: [] }, n);
});
// mais recentes primeiro
noticias.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));

const HOJE = hojeSaoPaulo();
const pHoje = partes(HOJE);

const hashAssets = crypto.createHash('md5')
  .update(fs.readFileSync(path.join(RAIZ, 'style.css')))
  .update(fs.readFileSync(path.join(RAIZ, 'app.js')))
  .digest('hex').slice(0, 10);

const urlNoticia = (n) => '/noticia/' + n.slug + '/';
const urlSecao = (s) => '/secao/' + s.slug + '/';
const abs = (p) => URL + p;
const curto = (n) => n.titulo_curto || n.titulo;
const fotoDe = (n) => (n.visual && n.visual.tipo === 'foto' ? n.visual : null);
const modificado = (n) => n.atualizado || n.data;

// ---------- peças de layout ----------
function cabecalho() {
  const nav = secoes.map((s) => '<li><a href="' + urlSecao(s) + '">' + esc(s.nome) + '</a></li>').join('') + '<li><a href="/#agenda">Agenda</a></li>';
  const ultimas = noticias.slice(0, 5).map((n) => '<a href="' + urlNoticia(n) + '">' + esc(curto(n)) + '</a>').join('<i>●</i>');
  const nomeHtml = '<span>Notícias</span>do Brasil';
  return '<div class="top"><div class="wrap"><span>' + DIAS[pHoje.dow] + ', ' + dataLonga(HOJE) + '</span><span>Atualizado em ' + dataBR(HOJE) + '</span></div></div>\n' +
    '<header class="brand"><div class="wrap"><a class="logo" href="/">' + nomeHtml + '</a><nav aria-label="Seções"><ul>' + nav + '</ul></nav></div></header>\n' +
    '<div class="last" aria-label="Últimas notícias"><div class="wrap"><b>Últimas</b>' + ultimas + '</div></div>\n';
}

function rodape() {
  const sec = secoes.map((s) => '<li><a href="' + urlSecao(s) + '">' + esc(s.nome) + '</a></li>').join('');
  const ult = noticias.slice(0, 4).map((n) => '<li><a href="' + urlNoticia(n) + '">' + esc(curto(n)) + '</a></li>').join('');
  return '<footer><div class="wrap"><div class="cols"><div><a class="logo" href="/"><span>Notícias</span>do Brasil</a><p>' + esc(site.sobre_rodape || '') + '</p></div>' +
    '<div><h2>Seções</h2><ul>' + sec + '</ul><h2 style="margin-top:1rem">Institucional</h2><ul>' +
    paginas.map((p) => '<li><a href="/' + p.slug + '/">' + esc(p.titulo.replace(/^Sobre o .*/, 'Sobre')) + '</a></li>').join('') +
    '<li><a href="/feed.xml">Feed RSS</a></li><li><a href="/llms.txt">llms.txt</a></li></ul></div>' +
    '<div><h2>Últimas notícias</h2><ul>' + ult + '</ul></div></div>' +
    '<p class="copy">' + (site.creditos_fotos || '') + ' © ' + pHoje.a + ' ' + esc(NOME) + ' · ' + URL.replace(/^https?:\/\//, '') + '</p></div></footer>\n' +
    '<script src="/app.js?v=' + hashAssets + '" defer></script>\n';
}

const ORG = () => ({
  '@type': 'NewsMediaOrganization', '@id': URL + '/#organization', name: NOME, url: URL + '/',
  logo: { '@type': 'ImageObject', url: URL + '/logo.png', width: 512, height: 512 },
  inLanguage: 'pt-BR', publishingPrinciples: URL + '/politica-editorial/'
});

function pagina(o) {
  const titulo = o.titulo;
  const desc = o.descricao;
  const imagem = o.imagem || URL + '/og-default.png';
  const padrao = !o.imagem;
  let h = '<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n';
  h += '<title>' + esc(titulo) + '</title>\n';
  if (desc) h += '<meta name="description" content="' + esc(desc) + '">\n';
  h += '<link rel="canonical" href="' + o.canonica + '">\n<link rel="alternate" hreflang="pt-BR" href="' + o.canonica + '">\n';
  h += '<meta name="robots" content="' + (o.robots || 'index, follow, max-image-preview:large') + '">\n<meta name="theme-color" content="#0c2a43">\n';
  h += '<meta property="og:type" content="' + (o.tipo || 'website') + '">\n<meta property="og:locale" content="pt_BR">\n<meta property="og:site_name" content="' + esc(NOME) + '">\n';
  h += '<meta property="og:title" content="' + esc(titulo) + '">\n';
  if (desc) h += '<meta property="og:description" content="' + esc(desc) + '">\n';
  h += '<meta property="og:url" content="' + o.canonica + '">\n<meta property="og:image" content="' + esc(imagem) + '">\n';
  if (padrao) h += '<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n';
  else if (o.imagemAlt) h += '<meta property="og:image:alt" content="' + esc(o.imagemAlt) + '">\n';
  if (o.metaExtra) h += o.metaExtra;
  h += '<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="' + esc(titulo) + '">\n';
  if (desc) h += '<meta name="twitter:description" content="' + esc(desc) + '">\n';
  h += '<meta name="twitter:image" content="' + esc(imagem) + '">\n';
  h += '<link rel="icon" type="image/png" href="/favicon.png">\n<link rel="apple-touch-icon" href="/favicon.png">\n';
  h += '<link rel="alternate" type="application/rss+xml" title="' + esc(NOME) + '" href="' + URL + '/feed.xml">\n';
  h += '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n';
  h += '<link href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@500;700;800&family=Source+Serif+4:wght@400;600&display=swap" rel="stylesheet">\n';
  if (o.preload) h += '<link rel="preload" as="image" href="' + esc(o.preload) + '" fetchpriority="high">\n';
  h += '<link rel="stylesheet" href="/style.css?v=' + hashAssets + '">\n';
  if (o.ld) h += ldjson({ '@context': 'https://schema.org', '@graph': o.ld }) + '\n';
  h += '</head>\n<body>\n' + cabecalho() + o.main + '\n' + rodape() + '</body>\n</html>\n';
  return h;
}

// ---------- blocos de conteúdo ----------
function visualHtml(v, grande) {
  if (!v) return '';
  if (v.tipo === 'taxa') {
    return '<div class="rate" role="img" aria-label="' + esc(v.alt) + '"><b>' + esc(v.valor) + '</b><span>' + esc(v.legenda) + '</span></div>';
  }
  return '<div class="noimg" role="img" aria-label="' + esc(v.alt) + '">' + esc(v.texto) + '</div>';
}

function votosHtml(b) {
  return '<div class="votes">\n' + b.votos.map((v) => '          <div><b>' + esc(v.valor) + '</b><span>' + esc(v.texto) + '</span></div>').join('\n') + '\n        </div>';
}

function corpoHtml(n) {
  const partesHtml = [];
  n.corpo.forEach((b) => {
    if (typeof b === 'string') partesHtml.push('<p>' + b + '</p>');
    else if (b.h2) partesHtml.push('<h2>' + esc(b.h2) + '</h2>');
    else if (b.lista) partesHtml.push('<ul class="pts">\n' + b.lista.map((i) => '          <li>' + i + '</li>').join('\n') + '\n        </ul>');
    else if (b.votos) partesHtml.push(votosHtml(b));
    else if (b.html) partesHtml.push(b.html);
  });
  if (n.fontes.length) {
    partesHtml.push('<h2>Fontes</h2><ul class="srcs">' + n.fontes.map((f) => '<li><a href="' + esc(f.url) + '" rel="noopener">' + esc(f.nome) + '</a></li>').join('') + '</ul>');
  }
  return partesHtml.join('\n        ');
}

function cartao(n) {
  const f = fotoDe(n);
  let vis = '';
  if (f) {
    vis = '<a class="vis" href="' + urlNoticia(n) + '" tabindex="-1" aria-hidden="true"><figure><img src="' + esc(f.url) + '" alt="' + esc(f.alt) + '" width="800" height="500" decoding="async" loading="lazy"></figure>' +
      (f.credito ? '<div class="credit">Foto: ' + esc(f.credito) + '</div>' : '') + '</a>';
  } else if (n.visual) {
    vis = '<a class="vis" href="' + urlNoticia(n) + '" tabindex="-1" aria-hidden="true">' + visualHtml(n.visual) + '</a>';
  }
  return '<article class="card" id="' + n.slug + '">' + vis + '<div class="body"><span class="tag">' + esc(n.rotulo) + '</span><h3><a href="' + urlNoticia(n) + '">' + esc(n.titulo) + '</a></h3><p>' + esc(n.resumo) + '</p><a class="more" href="' + urlNoticia(n) + '">Ler notícia completa →</a></div></article>';
}

function listaLateral(lista) {
  return lista.map((n) => '<li><a href="' + urlNoticia(n) + '">' + esc(n.titulo) + '</a><small>' + dataCurta(n.data) + '</small></li>').join('\n          ');
}

const doSecao = (slug) => noticias.filter((n) => n.secao === slug);

// ---------- páginas ----------
const arquivos = {}; // caminho relativo (dentro de public) -> conteúdo

function paginaNoticia(n) {
  const sec = mapaSecoes[n.secao];
  const f = fotoDe(n);
  const titulo = n.titulo + ' | ' + NOME;
  const canonica = abs(urlNoticia(n));
  const outras = doSecao(n.secao).filter((x) => x !== n).concat(noticias.filter((x) => x.secao !== n.secao && x !== n)).slice(0, 5);
  const visual = f
    ? '<figure>\n        <img src="' + esc(f.url) + '" alt="' + esc(f.alt) + '" width="1280" height="720" decoding="async" fetchpriority="high">\n' + (f.credito ? '        <figcaption>Foto: ' + esc(f.credito) + '</figcaption>\n' : '') + '      </figure>'
    : (n.visual ? '<div style="margin-top:1.2rem">' + visualHtml(n.visual) + '</div>' : '');
  const main = '<main class="wrap">\n  <nav class="crumbs" aria-label="Você está em">\n    <a href="/">Início</a>\n › <a href="' + urlSecao(sec) + '">' + esc(sec.nome) + '</a> › <span>' + esc(n.titulo) + '</span>\n  </nav>\n' +
    '  <div class="layout-article">\n    <article class="article">\n      <header>\n        <span class="tag">' + esc(n.rotulo) + '</span>\n        <h1>' + esc(n.titulo) + '</h1>\n' +
    '        <p class="byline">Por ' + esc(NOME) + ' · Publicado em <time datetime="' + n.data + '">' + dataLonga(n.data) + '</time>' +
    (n.atualizado && n.atualizado !== n.data ? ' · Atualizado em <time datetime="' + n.atualizado + '">' + dataLonga(n.atualizado) + '</time>' : '') + '</p>\n      </header>\n' +
    '      ' + visual + '\n      <div class="content">\n        ' + corpoHtml(n) + '\n      </div>\n    </article>\n' +
    '    <aside>\n      <section class="box list" aria-label="Mais notícias">\n        <h2>Mais notícias</h2>\n        <ul>\n          ' + listaLateral(outras) + '\n        </ul>\n      </section>\n    </aside>\n  </div>\n</main>';
  const desc = cortar(n.resumo, 160);
  const ld = [ORG(), {
    '@type': 'NewsArticle', '@id': canonica + '#article', mainEntityOfPage: { '@type': 'WebPage', '@id': canonica },
    headline: n.titulo, description: desc, datePublished: n.data, dateModified: modificado(n), inLanguage: 'pt-BR',
    author: { '@type': 'Organization', name: NOME + ' (redação)', url: URL + '/sobre/' }, publisher: { '@id': URL + '/#organization' },
    articleSection: sec.nome
  }, {
    '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: URL + '/' },
      { '@type': 'ListItem', position: 2, name: sec.nome, item: abs(urlSecao(sec)) },
      { '@type': 'ListItem', position: 3, name: n.titulo, item: canonica }
    ]
  }];
  if (f) ld[1].image = [f.url];
  if (n.fontes.length) ld[1].isBasedOn = n.fontes.map((x) => x.url);
  arquivos['noticia/' + n.slug + '/index.html'] = pagina({
    titulo, descricao: desc, canonica, tipo: 'article', imagem: f && f.url, imagemAlt: f && f.alt, ld, main,
    metaExtra: '<meta property="article:published_time" content="' + n.data + '">\n<meta property="article:modified_time" content="' + modificado(n) + '">\n<meta property="article:section" content="' + esc(sec.nome) + '">\n'
  });
}

function paginaSecao(s) {
  const lista = doSecao(s.slug);
  const canonica = abs(urlSecao(s));
  const desc = s.descricao || ('Últimas notícias de ' + s.nome + ' no Brasil, em linguagem simples e com link para as fontes.');
  const main = '<main class="wrap">\n  <nav class="crumbs" aria-label="Você está em"><a href="/">Início</a> › <span>' + esc(s.nome) + '</span></nav>\n' +
    '  <div class="pagehead">\n    <h1>' + esc(s.nome) + '</h1>\n    <p>' + esc(desc) + '</p>\n  </div>\n  <div class="cards">\n' +
    (lista.length ? lista.map(cartao).join('\n') : '<p>Ainda não há notícias nesta seção.</p>') + '\n  </div>\n</main>';
  const ld = [ORG(), {
    '@type': 'CollectionPage', '@id': canonica + '#pagina', url: canonica, name: s.nome + ': últimas notícias', description: desc,
    isPartOf: { '@id': URL + '/#website' }, inLanguage: 'pt-BR',
    mainEntity: { '@type': 'ItemList', itemListElement: lista.map((n, i) => ({ '@type': 'ListItem', position: i + 1, name: n.titulo, url: abs(urlNoticia(n)) })) }
  }, {
    '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: URL + '/' },
      { '@type': 'ListItem', position: 2, name: s.nome, item: canonica }
    ]
  }];
  arquivos['secao/' + s.slug + '/index.html'] = pagina({ titulo: s.nome + ': últimas notícias | ' + NOME, descricao: desc, canonica, ld, main, imagem: (lista[0] && fotoDe(lista[0]) || {}).url, imagemAlt: (lista[0] && fotoDe(lista[0]) || {}).alt });
}

function paginaHome() {
  const destaques = noticias.filter((n) => n.destaque).sort((a, b) => a.destaque - b.destaque);
  const slides = destaques.length ? destaques : noticias.slice(0, 3);
  const primeiraFoto = slides.map(fotoDe).find(Boolean);
  let main = '<main class="wrap">\n  <h1 class="home-h1">' + esc(site.h1_home || NOME) + '</h1>\n';
  if (slides.length) {
    main += '  <section class="slider" aria-roledescription="carrossel" aria-label="Destaques do dia">\n    <div class="track" id="track">\n';
    slides.forEach((n, i) => {
      const f = fotoDe(n);
      const sec = mapaSecoes[n.secao];
      const fig = f
        ? '<figure><img src="' + esc(f.url) + '" alt="' + esc(f.alt) + '" width="1280" height="720" decoding="async"' + (i === 0 ? ' fetchpriority="high"' : ' loading="lazy"') + '></figure>'
        : '<figure>' + visualHtml(n.visual || { tipo: 'texto', alt: n.titulo, texto: n.titulo }) + '</figure>';
      main += '      <article class="slide" aria-label="' + (i + 1) + ' de ' + slides.length + '">\n        ' + fig + '\n        <div class="txt">\n          <a class="tag" href="' + urlSecao(sec) + '">' + esc(n.rotulo_destaque || n.rotulo) + '</a>\n' +
        '          <h2><a href="' + urlNoticia(n) + '">' + esc(n.titulo_destaque || n.titulo) + '</a></h2>\n          <p>' + esc(n.resumo) + '</p>\n          <span class="meta">' + esc(sec.nome) + ' · ' + dataCurta(n.data) + '</span>\n        </div>\n' +
        (f && f.credito ? '        <div class="credit">Foto: ' + esc(f.credito) + '</div>\n' : '') + '      </article>\n';
    });
    main += '    </div>\n    <div class="ctrl">\n      <div class="dots" id="dots"></div>\n      <button type="button" id="prev" aria-label="Destaque anterior">‹</button>\n      <button type="button" id="next" aria-label="Próximo destaque">›</button>\n    </div>\n  </section>\n';
  }

  secoes.forEach((s) => {
    let lista = doSecao(s.slug);
    if (!lista.length) return;
    main += '\n  <div class="sechead">\n    <h2 class="sec" id="' + s.slug + '">' + esc(s.nome) + '</h2>\n    <span class="line"></span>\n    <a class="all" href="' + urlSecao(s) + '">Ver todas →</a>\n  </div>\n';
    if (s.manchete_na_home) {
      const m = lista[0];
      lista = lista.slice(1);
      const f = fotoDe(m);
      const primeiroP = m.corpo.find((b) => typeof b === 'string') || m.resumo;
      const votos = m.corpo.find((b) => b && b.votos);
      const outras = noticias.filter((x) => x !== m).slice(0, 4);
      main += '  <div class="two">\n    <article class="lead" id="' + m.slug + '">\n' +
        (f ? '      <figure><img src="' + esc(f.url) + '" alt="' + esc(f.alt) + '" width="1280" height="640" decoding="async" loading="lazy"></figure>' + (f.credito ? '<div class="credit">Foto: ' + esc(f.credito) + '</div>' : '') : '') +
        '      <div class="body">\n        <span class="tag">' + esc(m.rotulo) + '</span>\n        <h3><a href="' + urlNoticia(m) + '" style="text-decoration:none">' + esc(m.titulo) + '</a></h3>\n        <p>' + primeiroP + '</p>\n' +
        (votos ? '        <div class="votes">\n' + votos.votos.map((v) => '          <div><b>' + esc(v.valor) + '</b><span>' + esc(v.texto) + '</span></div>').join('\n') + '\n        </div>\n' : '') +
        '        <a class="more" href="' + urlNoticia(m) + '">Ler notícia completa →</a>\n      </div>\n    </article>\n    <div>\n' +
        '      <section class="box list" aria-label="Mais notícias">\n        <h2>Mais notícias</h2>\n        <ul>\n          ' + listaLateral(outras) + '\n        </ul>\n      </section>\n';
      const futuros = agenda.filter((a) => a.data >= HOJE);
      if (futuros.length) {
        main += '      <section class="box agenda" id="agenda" aria-label="Agenda">\n        <h2>Agenda das próximas semanas</h2>\n        <ul>\n' +
          futuros.map((a) => '          <li><time datetime="' + a.data + '"><b>' + esc(a.dia) + '</b>' + esc(a.mes) + '</time><div><p>' + esc(a.titulo) + '</p><small>' + esc(a.detalhe || '') + '</small></div></li>').join('\n') + '\n        </ul>\n      </section>\n';
      }
      main += '    </div>\n  </div>\n';
    }
    if (lista.length) main += '  <div class="cards">\n' + lista.map(cartao).join('\n') + '\n  </div>\n';
  });
  main += '\n</main>';

  const ld = [ORG(), { '@type': 'WebSite', '@id': URL + '/#website', url: URL + '/', name: NOME, inLanguage: 'pt-BR', publisher: { '@id': URL + '/#organization' } }, {
    '@type': 'CollectionPage', '@id': URL + '/#pagina', url: URL + '/', name: site.titulo_home, description: site.descricao,
    isPartOf: { '@id': URL + '/#website' }, inLanguage: 'pt-BR', dateModified: HOJE,
    mainEntity: { '@type': 'ItemList', itemListElement: slides.map((n, i) => ({ '@type': 'ListItem', position: i + 1, name: n.titulo_destaque || n.titulo, url: abs(urlNoticia(n)) })) }
  }];
  arquivos['index.html'] = pagina({
    titulo: site.titulo_home || NOME, descricao: site.descricao, canonica: URL + '/', imagem: primeiraFoto && primeiraFoto.url, imagemAlt: primeiraFoto && primeiraFoto.alt,
    preload: primeiraFoto && primeiraFoto.url, ld, main
  });
}

function paginaEstatica(p) {
  const canonica = abs('/' + p.slug + '/');
  const main = '<main class="wrap">\n  <nav class="crumbs" aria-label="Você está em"><a href="/">Início</a> › <span>' + esc(p.titulo) + '</span></nav>\n  <article class="article static">\n    <header><h1>' + esc(p.titulo) + '</h1></header>\n    <div class="content">\n' +
    p.corpo.map((b) => '      <p>' + b + '</p>').join('\n') + '\n    </div>\n  </article>\n</main>';
  const ld = [ORG(), { '@type': 'AboutPage', '@id': canonica + '#pagina', url: canonica, name: p.titulo, description: p.descricao, isPartOf: { '@id': URL + '/#website' }, inLanguage: 'pt-BR' }];
  arquivos[p.slug + '/index.html'] = pagina({ titulo: p.titulo + ' | ' + NOME, descricao: p.descricao, canonica, ld, main });
}

function pagina404() {
  const main = '<main class="wrap"><div class="status" style="padding:3rem 0"><h1 style="font:800 1.8rem var(--head);color:var(--ink)">Página não encontrada</h1><p style="margin-top:.6rem">O endereço que você acessou não existe.</p><p style="margin-top:1rem"><a href="/">Voltar para a página inicial</a></p></div></main>';
  arquivos['404.html'] = pagina({ titulo: 'Página não encontrada | ' + NOME, canonica: URL + '/', robots: 'noindex, follow', main });
}

// ---------- sitemaps, feed e llms ----------
function gerarSitemap() {
  const u = (loc, lastmod) => '  <url><loc>' + loc + '</loc>' + (lastmod ? '<lastmod>' + lastmod + '</lastmod>' : '') + '</url>';
  const linhas = [u(URL + '/', HOJE)];
  secoes.forEach((s) => { const l = doSecao(s.slug); linhas.push(u(abs(urlSecao(s)), l.length ? l.map(modificado).sort().pop() : null)); });
  noticias.forEach((n) => linhas.push(u(abs(urlNoticia(n)), modificado(n))));
  paginas.forEach((p) => linhas.push(u(abs('/' + p.slug + '/'))));
  arquivos['sitemap.xml'] = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + linhas.join('\n') + '\n</urlset>\n';

  const recentes = noticias.filter((n) => (pHoje.t - partes(n.data).t) / 86400000 <= 2);
  arquivos['sitemap-news.xml'] = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n' +
    recentes.map((n) => '  <url>\n    <loc>' + abs(urlNoticia(n)) + '</loc>\n    <news:news>\n      <news:publication><news:name>' + esc(NOME) + '</news:name><news:language>pt</news:language></news:publication>\n      <news:publication_date>' + n.data + '</news:publication_date>\n      <news:title>' + esc(n.titulo) + '</news:title>\n    </news:news>\n  </url>').join('\n') + '\n</urlset>\n';
}

function gerarFeed() {
  const itens = noticias.slice(0, 50).map((n) => {
    const paras = [];
    for (const b of n.corpo) { if (typeof b === 'string') paras.push(b); else break; }
    return '  <item>\n    <title>' + esc(n.titulo) + '</title>\n    <link>' + abs(urlNoticia(n)) + '</link>\n    <guid isPermaLink="true">' + abs(urlNoticia(n)) + '</guid>\n    <pubDate>' + dataRSS(n.data) + '</pubDate>\n    <category>' + esc(mapaSecoes[n.secao].nome) + '</category>\n    <description>' + esc(n.resumo) + '</description>\n    <content:encoded><![CDATA[' + paras.map((p) => '<p>' + p + '</p>').join('') + ']]></content:encoded>\n  </item>';
  });
  arquivos['feed.xml'] = '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">\n<channel>\n  <title>' + esc(NOME) + '</title>\n  <link>' + URL + '/</link>\n  <description>' + esc(site.descricao) + '</description>\n  <language>pt-br</language>\n  <lastBuildDate>' + dataRSS(HOJE) + '</lastBuildDate>\n  <atom:link href="' + URL + '/feed.xml" rel="self" type="application/rss+xml"/>\n' + itens.join('\n') + '\n</channel>\n</rss>\n';
}

function gerarLlms() {
  const intro = '# ' + NOME + '\n\n> ' + site.descricao + '\n\n' + (site.llms_intro || '') + ' Atualizado em ' + dataLonga(HOJE) + '.\n';
  let t = intro + '\n## Notícias\n\n' + noticias.map((n) => '- [' + n.titulo + '](' + abs(urlNoticia(n)) + '): ' + cortar(n.resumo, 220)).join('\n') + '\n\n## Seções\n\n' +
    secoes.map((s) => '- [' + s.nome + '](' + abs(urlSecao(s)) + ')').join('\n') + '\n\n## Institucional\n\n' +
    paginas.map((p) => '- [' + p.titulo.replace(/^Sobre o .*/, 'Sobre') + '](' + abs('/' + p.slug + '/') + '): ' + (p.llms || '')).join('\n').replace(/: $/gm, '') + '\n';
  arquivos['llms.txt'] = t;

  let f = intro + '\n---\n\n' + noticias.map((n) => {
    let s = '## ' + n.titulo + '\n\nURL: ' + abs(urlNoticia(n)) + '\nPublicado em: ' + n.data + '\nSeção: ' + mapaSecoes[n.secao].nome + '\n\n';
    const blocos = [];
    n.corpo.forEach((b) => {
      if (typeof b === 'string') blocos.push(semTags(b));
      else if (b.h2) blocos.push('### ' + b.h2);
      else if (b.lista) blocos.push(b.lista.map((i) => '- ' + semTags(i)).join('\n'));
      else if (b.votos) blocos.push(b.votos.map((v) => '- ' + v.valor + ': ' + v.texto).join('\n'));
      else if (b.html) blocos.push(semTags(b.html));
    });
    s += blocos.join('\n\n');
    if (n.fontes.length) s += '\n\nFontes: ' + n.fontes.map((x) => '[' + x.nome + '](' + x.url + ')').join(', ');
    return s;
  }).join('\n\n---\n\n') + '\n';
  arquivos['llms-full.txt'] = f;
}

// ---------- executar ----------
noticias.forEach(paginaNoticia);
secoes.forEach(paginaSecao);
paginas.forEach(paginaEstatica);
paginaHome();
pagina404();
gerarSitemap();
gerarFeed();
gerarLlms();

fs.rmSync(SAIDA, { recursive: true, force: true });
Object.keys(arquivos).forEach((rel) => {
  const dest = path.join(SAIDA, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, arquivos[rel]);
});
ARQUIVOS_ESTATICOS.forEach((a) => {
  const origem = path.join(RAIZ, a);
  if (!fs.existsSync(origem)) falha('falta o arquivo "' + a + '" na raiz do repositório.');
  fs.copyFileSync(origem, path.join(SAIDA, a));
});

console.log('Site gerado em "public": ' + noticias.length + ' notícias, ' + secoes.length + ' seções, ' + paginas.length + ' páginas.');
