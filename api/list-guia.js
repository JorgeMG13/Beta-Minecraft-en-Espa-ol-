export const config = { runtime: 'edge' };

import { checkRateLimit, getClientIP, corsHeaders, rateLimitHeaders } from './_lib/rate-limit.js';

const SUPABASE_URL      = 'https://mtkesqoywahieuapftmh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10a2VzcW95d2FoaWV1YXBmdG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2ODM1OTksImV4cCI6MjA4NzI1OTU5OX0.b_LmSnX_CGjL2YU5-JHqh14qHfv8NM9WNeMv5scZBpY';
const SITE              = 'https://minecraft-en-espanol.vercel.app';

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function difClass(d) {
  if (!d) return '';
  d = d.toLowerCase();
  return d.includes('fácil') || d.includes('facil') ? 'dif-facil'
       : d.includes('difícil') || d.includes('dificil') ? 'dif-dificil'
       : 'dif-medio';
}

const CSS = `
  :root{--bg:#0b0f0a;--surface:#161e13;--surface2:#1d2819;--border:rgba(255,255,255,0.07);--border-em:rgba(79,200,0,0.35);--green:#4fc800;--gold:#f5c842;--red:#e83535;--txt:#e8ede6;--txt-muted:#7a8c74;--txt-dim:#3d4d38;--pixel:"Press Start 2P",monospace;--body:"Rajdhani",sans-serif;--display:"Barlow Condensed",sans-serif;--radius:4px;}
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
  .guias-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;}
  .guia-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;text-decoration:none;display:flex;flex-direction:column;transition:transform .2s,box-shadow .2s,border-color .2s;}
  .guia-card:hover{transform:translateY(-4px);border-color:rgba(79,200,0,0.4);box-shadow:0 12px 40px rgba(0,0,0,0.5);}
  .guia-card-img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;}
  .guia-card-placeholder{width:100%;aspect-ratio:16/9;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:40px;}
  .guia-card-body{padding:16px;flex:1;display:flex;flex-direction:column;gap:8px;}
  .dif-badge{font-family:var(--pixel);font-size:6px;letter-spacing:1px;padding:3px 7px;border-radius:2px;display:inline-block;width:fit-content;}
  .dif-facil{background:rgba(79,200,0,0.15);color:var(--green);border:1px solid rgba(79,200,0,0.3);}
  .dif-medio{background:rgba(245,200,66,0.15);color:var(--gold);border:1px solid rgba(245,200,66,0.3);}
  .dif-dificil{background:rgba(232,53,53,0.15);color:var(--red);border:1px solid rgba(232,53,53,0.3);}
  .guia-cat{font-family:var(--pixel);font-size:6px;color:var(--green);letter-spacing:2px;text-transform:uppercase;}
  .guia-title{font-family:var(--display);font-size:17px;font-weight:700;color:var(--txt);line-height:1.3;}
  .guia-steps{font-family:var(--pixel);font-size:6px;color:var(--txt-muted);margin-top:auto;}
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
      `${SUPABASE_URL}/rest/v1/guias?select=id,titulo,imagen_url,categoria,dificultad,pasos,slug&order=created_at.desc`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    items = await res.json();
    if (!Array.isArray(items)) items = [];
  } catch (_) { items = []; }

  const cards = items.length === 0
    ? `<div class="empty">📖 Aún no hay guías publicadas.</div>`
    : items.map(g => {
        const pasos = Array.isArray(g.pasos) ? g.pasos : (typeof g.pasos === 'string' ? JSON.parse(g.pasos || '[]') : []);
        const imgHtml = g.imagen_url
          ? `<img class="guia-card-img" src="${esc(g.imagen_url)}" alt="${esc(g.titulo)} — Guía Minecraft en Español" loading="lazy" />`
          : `<div class="guia-card-placeholder">📖</div>`;
        const guiaUrl = g.slug ? `${SITE}/guias/${g.slug}` : `${SITE}/guias/${g.id}`;
        return `<a class="guia-card" href="${guiaUrl}">
          ${imgHtml}
          <div class="guia-card-body">
            ${g.dificultad ? `<span class="dif-badge ${difClass(g.dificultad)}">${esc(g.dificultad)}</span>` : ''}
            ${g.categoria  ? `<span class="guia-cat">${esc(g.categoria)}</span>` : ''}
            <div class="guia-title">${esc(g.titulo)}</div>
            <div class="guia-steps">${pasos.length} paso${pasos.length !== 1 ? 's' : ''}</div>
          </div>
        </a>`;
      }).join('');

  const schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Guías de Minecraft en Español",
    "url": `${SITE}/guias`,
    "numberOfItems": items.length,
    "itemListElement": items.slice(0, 10).map((g, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "url": g.slug ? `${SITE}/guias/${g.slug}` : `${SITE}/guias/${g.id}`,
      "name": g.titulo
    }))
  };

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Guías de Minecraft en Español | Paso a paso para todos los niveles</title>
  <meta name="description" content="Guías detalladas de Minecraft en español: supervivencia, construcción, redstone, jefes y exploración. Pasos claros para principiantes y avanzados." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${SITE}/guias" />
  <meta property="og:title"       content="Guías de Minecraft en Español" />
  <meta property="og:description" content="Guías de Minecraft en español: supervivencia, construcción, redstone y más." />
  <meta property="og:url"         content="${SITE}/guias" />
  <meta property="og:type"        content="website" />
  <meta property="og:image"       content="${SITE}/titulo-minecraft-espanol.png" />
  <meta property="og:locale"      content="es_ES" />
  <meta property="og:site_name"   content="Minecraft en Español" />
  <meta name="twitter:card"       content="summary_large_image" />
  <meta name="twitter:title"      content="Guías de Minecraft en Español" />
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
    <span class="header-label">📖 GUÍAS</span>
  </header>
  <main>
    <div class="wrap">
      <h1 class="page-title">Guías de <span>Minecraft</span></h1>
      <p class="page-sub">Tutoriales paso a paso en español para todos los niveles.</p>
      <div class="guias-grid">${cards}</div>
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
