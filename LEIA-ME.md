# Notícias do Brasil

Site estático, tudo na raiz do repositório (sem pastas). As notícias ficam no `noticias.json`.

## Como publicar uma notícia
1. Edite o `noticias.json` e adicione um bloco de notícia dentro de `"noticias": [ ... ]` (copie um existente e mude os campos; vírgula entre os blocos).
2. No seu computador, na pasta do projeto, rode: `node gerar.js` (precisa do Node.js instalado).
3. O script cria/atualiza `noticia-<slug>.html`, a home, as seções, `sitemap.xml`, `sitemap-news.xml`, `feed.xml`, `llms.txt` e `llms-full.txt`. Se você apagar uma notícia do JSON, a página dela também é apagada.
4. Faça o commit e o push de tudo. A Vercel publica sozinha.

O endereço bonito vem do `vercel.json`: o arquivo `noticia-selic.html` abre em `/noticia/selic/`. O endereço sai do campo `slug`.

## Campos de uma notícia
- Obrigatórios: `slug` (minúsculas sem acento, números e hífen), `titulo`, `secao` (politica, brasil, economia, educacao ou saude), `data` (AAAA-MM-DD), `resumo`.
- Opcionais: `rotulo` (etiqueta), `titulo_curto` (faixa "Últimas"), `atualizado` (AAAA-MM-DD), `destaque` (1, 2 ou 3 para o carrossel da home), `titulo_destaque`, `rotulo_destaque`.
- `visual` (opcional), um destes formatos:
  - `{"tipo": "foto", "url": "...", "alt": "...", "credito": "Agência Senado"}`
  - `{"tipo": "texto", "texto": "44h → 40h", "alt": "..."}`
  - `{"tipo": "taxa", "valor": "13,75%", "legenda": "Selic ao ano", "alt": "..."}`
- `corpo`: lista de blocos, na ordem em que aparecem:
  - texto simples vira parágrafo (aceita `<a href="...">link</a>`)
  - `{"h2": "Subtítulo"}`
  - `{"lista": ["item 1", "item 2"]}`
  - `{"votos": [{"valor": "47,04%", "texto": "Candidato A"}]}`
- `fontes`: lista de `{"nome": "...", "url": "..."}`.

Se o JSON tiver erro (vírgula faltando, slug repetido, data inválida), o `gerar.js` mostra o motivo e não altera nada.

## Vercel
Framework Preset: **Other**. Deixe Build Command, Output Directory e Install Command sem preencher (Override desligado).

## Arquivos
`gerar.js` (gerador, só roda no seu computador), `noticias.json` (dados), `vercel.json` (URLs e cabeçalhos), `style.css`, `app.js`, imagens e `robots.txt`.
