// api/generar-noticia.js
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://minecraft-en-espanol-admin.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Falta la URL' });

  try {
    // 1. Descargar la página
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MinecraftBot/1.0)' }
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const html = await r.text();

    // 2. Extraer título
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    let titulo = titleMatch ? titleMatch[1].replace(/\s*[-|].*$/, '').trim() : '';

    // 3. Extraer texto principal — busca <article>, <main> o <p> con más contenido
    let texto = '';
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                         html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    if (articleMatch) {
      texto = articleMatch[1]
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 600);
    } else {
      // Fallback: coger todos los párrafos
      const parrafos = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
        .map(m => m[1].replace(/<[^>]+>/g, '').trim())
        .filter(p => p.length > 80)
        .slice(0, 3)
        .join(' ');
      texto = parrafos.slice(0, 600);
    }

    // 4. Extraer imagen og
    const imgMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) ||
                     html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
    const imagen = imgMatch ? imgMatch[1] : null;

    if (!titulo && !texto) throw new Error('No se pudo extraer contenido');

    // 5. Traducir
    async function traducir(t) {
      if (!t) return t;
      try {
        const u = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=${encodeURIComponent(t)}`;
        const tr = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const d  = await tr.json();
        return d[0].map(s => s[0]).join('');
      } catch (e) { return t; }
    }

    const [tituloEs, textoEs] = await Promise.all([
      traducir(titulo),
      traducir(texto)
    ]);

    return res.status(200).json({
      ok: true,
      titulo: tituloEs,
      texto:  textoEs,
      imagen,
      enlace: url
    });

  } catch (err) {
    console.error('generar-noticia error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
