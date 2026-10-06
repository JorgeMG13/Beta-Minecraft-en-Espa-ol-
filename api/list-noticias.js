export const config = { runtime: 'edge' };

import { checkRateLimit, getClientIP, corsHeaders, rateLimitHeaders } from './_lib/rate-limit.js';

const SUPABASE_URL    = 'https://mtkesqoywahieuapftmh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10a2VzcW95d2FoaWV1YXBmdG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2ODM1OTksImV4cCI6MjA4NzI1OTU5OX0.b_LmSnX_CGjL2YU5-JHqh14qHfv8NM9WNeMv5scZBpY';
const SITE            = 'https://minecraft-en-espanol.vercel.app';

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

const CSS = `
  :root{--bg:#0b0f0a;--surface:#161e13;--surface2:#1d2819;--border:rgba(255,255,255,0.07);--border-em:rgba(79,200,0,0.35);--green:#4fc800;--gold:#f5c842;--txt:#e8ede6;--txt-muted:#7a8c74;--txt-dim:#3d4d38;--pixel:"Press Start 2P",monospace;--body:"Rajdhani",sans-serif;--display:"Barlow Condensed",sans-serif;--radius:4px;}
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:var(--body);background:var(--bg);color:var(--txt);min-height:100vh;display:flex;flex-direction:column;}
  body::before{content:"";position:fixed;inset:0;z-index:0;background-image:radial-gradient(ellipse 80% 50% at 50% -10%,rgba(79,200,0,0.07) 0%,transparent 60%);pointer-events:none;}
  .pixel-strip{height:6px;flex-shrink:0;background:repeating-linear-gradient(90deg,#4fc800 0,#4fc800 8px,#3aaa00 8px,#3aaa00 16px,#2d8800 16px,#2d8800 24px,#3aaa00 24px,#3aaa00 32px);}
  header{padding:14px 20px;background:rgba(11,15,10,0.97);backdrop-filter:blur(12px);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:100;}
  .btn-back{font-family:var(--pixel);font-size:7px;color:var(--txt-muted);background:transparent;border:1px solid var(--border);border-radius:var(--radius);padding:8px 14px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;transition:color .2s,border-color .2s;white-space:nowrap;}
  .btn-back:hover{color:var(--green);border-color:var(--border-em);}
  .header-label{font-family:var(--pixel);font-size:6px;color:var(--green);letter-spacing:2px;}
  main{flex:1;position:relative;z-index:1;}
  .wrap{max-width:1100px;margin:0 auto;padding:40px 20px 80px;}
  .page-title{font-family:var(--display);font-size:clamp(32px,6vw,56px);font-weight:700;margin-bottom:8px;}
  .page-title span{color:var(--green);}
  .page-sub{font-size:16px;color:var(--txt-muted);margin-bottom:36px;}
  .news-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;}
  @media(max-width:600px){.news-grid{grid-template-columns:1fr;}}
  .news-grid .post-card:first-child{grid-column:span 2;}
  @media(max-width:600px){.news-grid .post-card:first-child{grid-column:span 1;}}
  .post-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;display:flex;flex-direction:column;text-decoration:none;transition:transform .2s,box-shadow .2s,border-color .2s;}
  .post-card:hover{transform:translateY(-4px);border-color:rgba(79,200,0,0.4);box-shadow:0 12px 40px rgba(0,0,0,0.5);}
  .post-card-img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;}
  .post-card-img-wrap{overflow:hidden;flex-shrink:0;}
  .post-card-placeholder{width:100%;aspect-ratio:16/9;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:40px;}
  .post-card-body{padding:16px;display:flex;flex-direction:column;gap:8px;flex:1;}
  .post-card-cat{font-family:var(--pixel);font-size:6px;color:var(--green);letter-spacing:2px;text-transform:uppercase;}
  .post-card-title{font-family:var(--display);font-size:clamp(14px,2.2vw,18px);font-weight:700;line-height:1.3;color:var(--txt);}
  .post-card-excerpt{font-size:14px;color:var(--txt-muted);line-height:1.6;flex:1;}
  .post-card-meta{font-family:var(--pixel);font-size:6px;color:var(--txt-dim);letter-spacing:1px;margin-top:4px;}
  .empty{text-align:center;padding:80px 20px;font-family:var(--pixel);font-size:8px;color:var(--txt-dim);line-height:2.4;}
  footer{background:#0a0e09;border-top:1px solid var(--border);padding:20px;text-align:center;font-family:var(--pixel);font-size:6px;color:var(--txt-dim);letter-spacing:1px;}
`;

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const ip = getClientIP(req);
  const { allowed, remaining, resetMs } = checkRateLimit(ip);
  
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: { 
        ...corsHeaders(), 
        'Content-Type': 'application/json',
        ...rateLimitHeaders(0, resetMs),
        'Retry-After': String(Math.ceil(resetMs / 1000))
      }
    });
  }
  
  let items = [];
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/noticias?select=id,titulo,texto,imagen,fecha,slug&order=created_at.desc`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    items = await res.json();
    if (!Array.isArray(items)) items = [];
  } catch (_) { items = []; }

  const cards = items.length === 0
    ? `<div class="empty">📭 Aún no hay noticias publicadas.</div>`
    : items.map(n => {
        const imgHtml = n.imagen
          ? `<div class="post-card-img-wrap"><img class="post-card-img" src="${esc(n.imagen)}" alt="${esc(n.titulo)}" loading="lazy" /></div>`
          : `<div class="post-card-placeholder">📰</div>`;
        const excerpt = (n.texto || '').slice(0, 120) + ((n.texto || '').length > 120 ? '…' : '');
        const noticiaUrl = n.slug ? `${SITE}/noticias/${n.slug}` : `${SITE}/noticias/${n.id}`;
        return `<a class="post-card" href="${noticiaUrl}">
          ${imgHtml}
          <div class="post-card-body">
            <span class="post-card-cat">Noticia</span>
            <div class="post-card-title">${esc(n.titulo)}</div>
            <div class="post-card-excerpt">${esc(excerpt)}</div>
            <div class="post-card-meta">${esc(n.fecha)}</div>
          </div>
        </a>`;
      }).join('');

  // Schema.org ItemList
  const schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Noticias de Minecraft en Español",
    "url": `${SITE}/noticias`,
    "numberOfItems": items.length,
    "itemListElement": items.slice(0, 10).map((n, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "url": n.slug ? `${SITE}/noticias/${n.slug}` : `${SITE}/noticias/${n.id}`,
      "name": n.titulo
    }))
  };

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Noticias de Minecraft en Español | Últimas actualizaciones 2025</title>
  <meta name="description" content="Últimas noticias sobre Minecraft en español: actualizaciones, novedades, eventos y todo lo que pasa en el mundo de Minecraft en castellano." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${SITE}/noticias" />
  <meta property="og:title"       content="Noticias de Minecraft en Español" />
  <meta property="og:description" content="Últimas noticias sobre Minecraft en español: actualizaciones, novedades y eventos." />
  <meta property="og:url"         content="${SITE}/noticias" />
  <meta property="og:type"        content="website" />
  <meta property="og:image"       content="${SITE}/titulo-minecraft-espanol.png" />
  <meta property="og:locale"      content="es_ES" />
  <meta property="og:site_name"   content="Minecraft en Español" />
  <meta name="twitter:card"       content="summary_large_image" />
  <meta name="twitter:title"      content="Noticias de Minecraft en Español" />
  <meta name="twitter:image"      content="${SITE}/titulo-minecraft-espanol.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
  <link rel="shortcut icon" href="/favicon.ico" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/site.webmanifest" />
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Rajdhani:wght@400;600;700&family=Barlow+Condensed:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet" />
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
  <style>${CSS}</style>
</head>
<body>
  <div class="pixel-strip"></div>
  <header>
    <a href="/" class="btn-back">← Inicio</a>
    <span class="header-label">📰 NOTICIAS</span>
  </header>
  <main>
    <div class="wrap">
      <h1 class="page-title">Últimas <span>Noticias</span></h1>
      <p class="page-sub">Todo lo que pasa en el mundo de Minecraft, en español.</p>
      <div class="news-grid">${cards}</div>
    </div>
  </main>
  <div class="pixel-strip"></div>
  <footer>© 2026 MINECRAFT EN ESPAÑOL · HECHO CON BLOQUES PARA VOSOTROS</footer>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 's-maxage=120, stale-while-revalidate=600',
      ...rateLimitHeaders(remaining, resetMs),
    },
  });
}
