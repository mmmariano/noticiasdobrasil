# Notícias do Brasil

Site estático gerado a partir de um `noticias.json`.

## De onde vêm as notícias
O `gerar.js` baixa as notícias de `https://clinicaroots.com.br/sites-de-noticia/noticias-do-brasil/noticias.json` (endereço definido em `fonte_noticias`, no topo do `noticias.json` do repositório).
- O arquivo remoto pode ter só a lista, `{"noticias": [ ... ]}`, ou o arquivo completo. O que ele trouxer substitui o que está no repositório.
- Se o download falhar, o gerador usa as notícias do `noticias.json` do repositório e avisa no log.
- Se o arquivo remoto tiver erro de JSON, o build falha e o site anterior continua no ar.

## Como publicar depois de atualizar o JSON
Crie um **Deploy Hook** na Vercel (Settings → Git → Deploy Hooks). Chamar o endereço dele (POST) dispara um novo deploy, que baixa o JSON e recria todas as páginas.

Exemplo em PHP, para rodar depois de salvar o `noticias.json`:
```php
$ch = curl_init('COLE_AQUI_O_LINK_DO_DEPLOY_HOOK');
curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true]);
curl_exec($ch);
curl_close($ch);
```
Pelo terminal: `curl -X POST "COLE_AQUI_O_LINK_DO_DEPLOY_HOOK"`.

## Se preferir editar aqui no GitHub

## Como adicionar uma notícia
1. No GitHub, abra `noticias.json` e clique no lápis (Edit).
2. Copie um bloco de notícia dentro de `"noticias": [ ... ]`, cole logo abaixo (com vírgula entre os blocos) e mude os campos.
3. Clique em **Commit changes**. A Vercel gera as páginas sozinha em cerca de 1 minuto.

A URL sai do campo `slug`: `"slug": "selic"` vira `/noticia/selic/`. Use só letras minúsculas sem acento, números e hífen.

## Campos de uma notícia
- `slug`, `titulo`, `secao` (politica, brasil, economia, educacao ou saude), `data` (AAAA-MM-DD), `resumo`: obrigatórios.
- `rotulo`: etiqueta curta (ex.: "Juros"). `titulo_curto`: versão curta para a faixa "Últimas".
- `atualizado`: data da última atualização (opcional).
- `destaque`: 1, 2 ou 3 para aparecer no carrossel da página inicial. `titulo_destaque` e `rotulo_destaque` são opcionais.
- `visual` (opcional), um destes formatos:
  - `{"tipo": "foto", "url": "...", "alt": "...", "credito": "Agência Senado"}`
  - `{"tipo": "texto", "texto": "44h → 40h", "alt": "..."}`
  - `{"tipo": "taxa", "valor": "13,75%", "legenda": "Selic ao ano", "alt": "..."}`
- `corpo`: lista de blocos, na ordem em que aparecem:
  - um texto simples vira parágrafo (pode ter `<a href="...">link</a>`)
  - `{"h2": "Subtítulo"}`
  - `{"lista": ["item 1", "item 2"]}`
  - `{"votos": [{"valor": "47,04%", "texto": "Candidato A"}]}`
- `fontes`: lista de `{"nome": "...", "url": "..."}`.

Se o JSON tiver erro (vírgula faltando, slug repetido, data inválida), a Vercel mostra o motivo no log do deploy e mantém o site anterior no ar.

## Arquivos
- `gerar.js`: lê o JSON e cria a pasta `public` (a Vercel roda isso no deploy).
- `vercel.json`: comando de build e cabeçalhos. `package.json`: apenas o nome do projeto.
- `style.css`, `app.js`, imagens e `robots.txt`: copiados como estão.
