export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://mtkesqoywahieuapftmh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10a2VzcW95d2FoaWV1YXBmdG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2ODM1OTksImV4cCI6MjA4NzI1OTU5OX0.b_LmSnX_CGjL2YU5-JHqh14qHfv8NM9WNeMv5scZBpY';
const SITE = 'https://minecraft-en-espanol.vercel.app';

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

export default async function handler(req) {
  const url = new URL(req.url);
  // Vercel reescribe /noticias/:id → /api/noticia?id=:id, leer siempre del query
  const id = url.searchParams.get('id');

  let titulo = 'Dato Curioso | Minecraft en Español';
  let descripcion = 'Descubre datos curiosos sobre Minecraft en castellano.';
  let imagen = `${SITE}/favicon-96x96.png`;

  if (id) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/curiosidades?id=eq.${encodeURIComponent(id)}&select=texto`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      const data = await res.json();
      if (Array.isArray(data) && data[0]) {
        const c = data[0];
        if (c.texto) {
          titulo = c.texto.slice(0, 80) + (c.texto.length > 80 ? '…' : '');
          descripcion = c.texto.replace(/\n/g, ' ').slice(0, 160);
        }
      }
    } catch (_) {}
  }

  const pageUrl = `${SITE}/api/curiosidad${id ? '?id=' + id : ''}`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(titulo)}</title>
  <meta property="og:type"         content="article" />
  <meta property="og:site_name"    content="Minecraft en Español" />
  <meta property="og:url"          content="${esc(pageUrl)}" />
  <meta property="og:title"        content="${esc(titulo)}" />
  <meta property="og:description"  content="${esc(descripcion)}" />
  <meta property="og:image"        content="${esc(imagen)}" />
  <meta property="og:image:width"  content="1200" />
  <meta property="og:image:height" content="630" />
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
    :root{--bg:#0b0f0a;--surface:#161e13;--surface2:#1d2819;--border:rgba(255,255,255,0.07);--border-em:rgba(245,200,66,0.35);--green:#4fc800;--gold:#f5c842;--txt:#e8ede6;--txt-muted:#7a8c74;--txt-dim:#3d4d38;--pixel:"Press Start 2P",monospace;--body:"Rajdhani",sans-serif;--display:"Barlow Condensed",sans-serif;--radius:4px;}
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:var(--body);background:var(--bg);color:var(--txt);min-height:100vh;display:flex;flex-direction:column;overflow-x:hidden;}
    body::before{content:"";position:fixed;inset:0;z-index:0;background-image:radial-gradient(ellipse 80% 50% at 50% -10%,rgba(245,200,66,0.05) 0%,transparent 60%);pointer-events:none;}
    .pixel-strip{height:6px;flex-shrink:0;background:repeating-linear-gradient(90deg,#f5c842 0,#f5c842 8px,#d4a800 8px,#d4a800 16px,#b38f00 16px,#b38f00 24px,#d4a800 24px,#d4a800 32px);}
    header{padding:14px 20px;background:rgba(11,15,10,0.97);backdrop-filter:blur(12px);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:100;}
    .btn-back{font-family:var(--pixel);font-size:7px;color:var(--txt-muted);background:transparent;border:1px solid var(--border);border-radius:var(--radius);padding:8px 14px;cursor:pointer;letter-spacing:1px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;transition:color .2s,border-color .2s;white-space:nowrap;}
    .btn-back:hover{color:var(--gold);border-color:var(--border-em);}
    .header-label{font-family:var(--pixel);font-size:6px;color:var(--gold);letter-spacing:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    main{flex:1;position:relative;z-index:1;}
    .wrap{max-width:780px;margin:0 auto;padding:40px 20px 80px;}
    .curiosidad-block{background:var(--surface);border:1px solid var(--border);border-left:4px solid var(--gold);border-radius:var(--radius);padding:40px;}
    .curiosidad-icon-big{font-size:52px;margin-bottom:24px;display:block;}
    .art-meta{font-family:var(--pixel);font-size:6px;color:var(--gold);letter-spacing:2px;margin-bottom:20px;}
    .art-body{font-family:var(--display);font-size:clamp(20px,3.5vw,26px);font-weight:600;line-height:1.6;color:var(--txt);}
    .art-date{font-family:var(--pixel);font-size:6px;color:var(--txt-dim);letter-spacing:1px;margin-top:32px;padding-top:24px;border-top:1px solid var(--border);}
    .not-found{text-align:center;padding:80px 20px;}
    .not-found .nf-icon{font-size:48px;margin-bottom:20px;}
    .not-found h2{font-family:var(--display);font-size:28px;font-weight:700;margin-bottom:10px;}
    .not-found p{font-size:15px;color:var(--txt-muted);margin-bottom:28px;}
    .sk{background:var(--surface);border-radius:var(--radius);animation:pulse 1.5s ease-in-out infinite;}
    @keyframes pulse{0%,100%{opacity:1;}50%{opacity:.4;}}
    .sk-ln{height:13px;margin-bottom:12px;}
    footer{background:#0a0e09;border-top:1px solid var(--border);padding:20px;text-align:center;font-family:var(--pixel);font-size:6px;color:var(--txt-dim);letter-spacing:1px;}
  </style>
</head>
<body>
  <div class="pixel-strip"></div>
  <header>
    <a href="/index.html" class="btn-back">← Volver</a>
    <span class="header-label" id="header-label">💡 DATO CURIOSO</span>
  </header>
  <main>
    <div class="wrap" id="wrap">
      <div class="sk sk-ln" style="width:20%;margin-bottom:20px;"></div>
      <div class="sk sk-ln" style="width:100%;height:24px;margin-bottom:12px;"></div>
      <div class="sk sk-ln" style="width:90%;height:24px;margin-bottom:12px;"></div>
      <div class="sk sk-ln" style="width:70%;height:24px;"></div>
    </div>
  </main>
  <footer>© 2026 MINECRAFT EN ESPAÑOL · HECHO CON BLOQUES PARA VOSOTROS</footer>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script>
    const SUPABASE_URL = 'https://mtkesqoywahieuapftmh.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10a2VzcW95d2FoaWV1YXBmdG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2ODM1OTksImV4cCI6MjA4NzI1OTU5OX0.b_LmSnX_CGjL2YU5-JHqh14qHfv8NM9WNeMv5scZBpY';
    const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
    async function cargar() {
      // Soporta /noticias/123 (path) y ?id=123 (query legacy)
      const pathId = window.location.pathname.split('/').filter(Boolean).pop();
      const id = (pathId && !/\.html$/.test(pathId)) ? pathId : new URLSearchParams(window.location.search).get('id');
      const wrap = document.getElementById('wrap');
      if (!id) { mostrarError(wrap); return; }
      const { data, error } = await sb.from('curiosidades').select('*').eq('id', id).single();
      if (error || !data) { mostrarError(wrap); return; }
      document.title = 'Dato curioso | Minecraft en Español';
      document.getElementById('header-label').textContent = '💡 DATO CURIOSO · ' + (data.fecha || '');
      wrap.innerHTML = \`
        <div class="curiosidad-block">
          <span class="curiosidad-icon-big">💡</span>
          <div class="art-meta">💡 DATO CURIOSO</div>
          <div class="art-body">\${esc(data.texto)}</div>
          <div class="art-date">\${esc(data.fecha)}</div>
        </div>\`;
    }
    function mostrarError(wrap) {
      document.title = 'Curiosidad no encontrada | Minecraft en Español';
      wrap.innerHTML = \`<div class="not-found"><div class="nf-icon">🔍</div><h2>Dato curioso no encontrado</h2><p>El contenido que buscas no existe o fue eliminado.</p><a href="/index.html" class="btn-back">← Volver al inicio</a></div>\`;
    }
    cargar();
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' },
  });
}
