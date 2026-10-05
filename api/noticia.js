export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://mtkesqoywahieuapftmh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10a2VzcW95d2FoaWV1YXBmdG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2ODM1OTksImV4cCI6MjA4NzI1OTU5OX0.b_LmSnX_CGjL2YU5-JHqh14qHfv8NM9WNeMv5scZBpY';
const SITE = 'https://minecraft-en-espanol.vercel.app';

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

export default async function handler(req) {
  const url = new URL(req.url);
  // Vercel reescribe /noticias/:slug → /api/noticia?slug=:slug
  const slug = url.searchParams.get('slug');

  // Si el "slug" parece UUID (formato antiguo), buscar el slug real y redirigir 301
  function isUUID(str) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
  }

  if (slug && isUUID(slug)) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/noticias?id=eq.${encodeURIComponent(slug)}&select=slug`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      const data = await res.json();
      if (Array.isArray(data) && data[0] && data[0].slug) {
        return new Response(null, {
          status: 301,
          headers: { Location: `/noticias/${data[0].slug}` }
        });
      }
    } catch (_) {}
  }

  // Valores por defecto
  let titulo = 'Minecraft en Español';
  let descripcion = 'Noticias, guías, datos curiosos y quiz sobre Minecraft en castellano.';
  let imagen = `${SITE}/favicon-96x96.png`;

  if (slug) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/noticias?slug=eq.${encodeURIComponent(slug)}&select=titulo,texto,imagen`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      const data = await res.json();
      if (Array.isArray(data) && data[0]) {
        const n = data[0];
        if (n.titulo) titulo = n.titulo;
        if (n.texto)  descripcion = n.texto.replace(/\n/g, ' ').slice(0, 160);
        if (n.imagen) imagen = n.imagen;
      }
    } catch (_) {}
  }

  const pageUrl = `${SITE}/noticias${slug ? '/' + slug : ''}`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(titulo)} | Minecraft en Español</title>

  <!-- Open Graph (WhatsApp, Facebook, Telegram) -->
  <meta property="og:type"         content="article" />
  <meta property="og:site_name"    content="Minecraft en Español" />
  <meta property="og:url"          content="${esc(pageUrl)}" />
  <meta property="og:title"        content="${esc(titulo)}" />
  <meta property="og:description"  content="${esc(descripcion)}" />
  <meta property="og:image"        content="${esc(imagen)}" />
  <meta property="og:image:width"  content="1200" />
  <meta property="og:image:height" content="630" />

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${esc(titulo)}" />
  <meta name="twitter:description" content="${esc(descripcion)}" />
  <meta name="twitter:image"       content="${esc(imagen)}" />

  <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
  <link rel="shortcut icon" href="/favicon.ico" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/site.webmanifest" />
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Rajdhani:wght@400;600;700&family=Barlow+Condensed:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg:#0b0f0a;--surface:#161e13;--surface2:#1d2819;
      --border:rgba(255,255,255,0.07);--border-em:rgba(79,200,0,0.35);
      --green:#4fc800;--gold:#f5c842;--txt:#e8ede6;--txt-muted:#7a8c74;--txt-dim:#3d4d38;
      --pixel:"Press Start 2P",monospace;--body:"Rajdhani",sans-serif;--display:"Barlow Condensed",sans-serif;
      --radius:4px;
    }
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:var(--body);background:var(--bg);color:var(--txt);min-height:100vh;display:flex;flex-direction:column;overflow-x:hidden;}
    body::before{content:"";position:fixed;inset:0;z-index:0;background-image:radial-gradient(ellipse 80% 50% at 50% -10%,rgba(79,200,0,0.07) 0%,transparent 60%);pointer-events:none;}
    .pixel-strip{height:6px;flex-shrink:0;background:repeating-linear-gradient(90deg,#4fc800 0,#4fc800 8px,#3aaa00 8px,#3aaa00 16px,#2d8800 16px,#2d8800 24px,#3aaa00 24px,#3aaa00 32px);}
    header{padding:14px 20px;background:rgba(11,15,10,0.97);backdrop-filter:blur(12px);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:100;}
    .btn-back{font-family:var(--pixel);font-size:7px;color:var(--txt-muted);background:transparent;border:1px solid var(--border);border-radius:var(--radius);padding:8px 14px;cursor:pointer;letter-spacing:1px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;transition:color .2s,border-color .2s;white-space:nowrap;}
    .btn-back:hover{color:var(--green);border-color:var(--border-em);}
    .header-label{font-family:var(--pixel);font-size:6px;color:var(--green);letter-spacing:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    main{flex:1;position:relative;z-index:1;}
    .wrap{max-width:780px;margin:0 auto;padding:40px 20px 80px;}
    .hero-img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:var(--radius);border:1px solid var(--border);margin-bottom:32px;display:block;}
    .art-meta{font-family:var(--pixel);font-size:6px;color:var(--green);letter-spacing:2px;margin-bottom:12px;}
    .art-title{font-family:var(--display);font-size:clamp(28px,6vw,52px);font-weight:700;line-height:1.1;margin-bottom:14px;}
    .art-date{font-family:var(--pixel);font-size:6px;color:var(--txt-dim);letter-spacing:1px;padding-bottom:24px;border-bottom:1px solid var(--border);margin-bottom:32px;}
    .art-body{font-size:17px;line-height:1.75;color:var(--txt-muted);white-space:pre-wrap;word-break:break-word;}
    .art-link{display:inline-flex;align-items:center;gap:8px;margin-top:36px;font-family:var(--pixel);font-size:7px;letter-spacing:1px;padding:12px 20px;background:transparent;color:var(--green);border:1px solid var(--border-em);border-radius:var(--radius);text-decoration:none;transition:background .2s;}
    .art-link:hover{background:rgba(79,200,0,0.1);}
    .not-found{text-align:center;padding:80px 20px;}
    .not-found .nf-icon{font-size:48px;margin-bottom:20px;}
    .not-found h2{font-family:var(--display);font-size:28px;font-weight:700;margin-bottom:10px;}
    .not-found p{font-size:15px;color:var(--txt-muted);margin-bottom:28px;}
    .sk{background:var(--surface);border-radius:var(--radius);animation:pulse 1.5s ease-in-out infinite;}
    @keyframes pulse{0%,100%{opacity:1;}50%{opacity:.4;}}
    .sk-img{width:100%;aspect-ratio:16/9;margin-bottom:32px;}
    .sk-ln{height:13px;margin-bottom:12px;}
    footer{background:#0a0e09;border-top:1px solid var(--border);padding:20px;text-align:center;font-family:var(--pixel);font-size:6px;color:var(--txt-dim);letter-spacing:1px;}
  </style>
</head>
<body>
  <div class="pixel-strip"></div>
  <header>
    <a href="/index.html" class="btn-back">← Volver</a>
    <span class="header-label" id="header-label">📰 NOTICIA</span>
  </header>
  <main>
    <div class="wrap" id="wrap">
      <div class="sk sk-img"></div>
      <div class="sk sk-ln" style="width:25%"></div>
      <div class="sk sk-ln" style="width:70%;height:40px;margin-bottom:16px;"></div>
      <div class="sk sk-ln" style="width:30%;margin-bottom:32px;"></div>
      <div class="sk sk-ln"></div>
      <div class="sk sk-ln" style="width:90%"></div>
      <div class="sk sk-ln" style="width:80%"></div>
      <div class="sk sk-ln" style="width:95%"></div>
    </div>
  </main>
  <footer>© 2026 MINECRAFT EN ESPAÑOL · HECHO CON BLOQUES PARA VOSOTROS</footer>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script>
    const SUPABASE_URL = 'https://mtkesqoywahieuapftmh.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10a2VzcW95d2FoaWV1YXBmdG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2ODM1OTksImV4cCI6MjA4NzI1OTU5OX0.b_LmSnX_CGjL2YU5-JHqh14qHfv8NM9WNeMv5scZBpY';
    const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    function esc(s){return String(s||'').replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"');}

    function isUUID(str) {
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
    }

    async function cargar() {
      // Lee slug del path (/noticias/:slug) o ?slug= query
      const qsSlug = new URLSearchParams(window.location.search).get('slug');
      const pathSlug = window.location.pathname.split('/').filter(Boolean).pop();
      const slug = qsSlug || (pathSlug && pathSlug !== 'noticias' ? pathSlug : null);
      const wrap = document.getElementById('wrap');
      if (!slug) { mostrarError(wrap); return; }

      // Compatibilidad: si parece UUID, consultar por id; si no, por slug
      const queryKey = isUUID(slug) ? 'id' : 'slug';
      const queryValue = slug;

      const { data, error } = await sb.from('noticias').select('*').eq(queryKey, queryValue).single();
      if (error || !data) { mostrarError(wrap); return; }

      document.title = data.titulo + ' | Minecraft en Español';
      document.getElementById('header-label').textContent = '📰 ' + data.titulo;

wrap.innerHTML = [
          data.imagen ? '<img class="hero-img" src="' + esc(data.imagen) + '" alt="' + esc(data.titulo) + '" />' : '',
          '<div class="art-meta">📰 NOTICIA</div>',
          '<h1 class="art-title">' + esc(data.titulo) + '</h1>',
          '<div class="art-date">' + esc(data.fecha) + '</div>',
          '<div class="art-body">' + esc(data.texto) + '</div>',
          data.enlace ? '<a class="art-link" href="' + esc(data.enlace) + '" target="_blank" rel="noopener">🔗 Más información</a>' : ''
        ].join('');
    }

    function mostrarError(wrap) {
      document.title = 'Noticia no encontrada | Minecraft en Español';
      wrap.innerHTML = [
        '<div class="not-found">',
          '<div class="nf-icon">🔍</div>',
          '<h2>Noticia no encontrada</h2>',
          '<p>El artículo que buscas no existe o fue eliminado.</p>',
          '<a href="/index.html" class="btn-back">← Volver al inicio</a>',
        '</div>'
      ].join('');
    }

    cargar();
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
    },
  });
}
