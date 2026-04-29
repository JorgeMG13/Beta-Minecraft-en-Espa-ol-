// api/buscar-noticias.js
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function traducir(texto) {
  if (!texto) return texto;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=${encodeURIComponent(texto)}`;
    const r    = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await r.json();
    return data[0].map(s => s[0]).join('');
  } catch (e) {
    console.error('Traducción error:', e.message);
    return texto;
  }
}

function parseItems(xml) {
  const tag   = xml.includes('<entry') ? 'entry' : 'item';
  const items = [];
  const re    = new RegExp(`<${tag}[\\s>]([\\s\\S]*?)<\\/${tag}>`, 'g');
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const get   = (t) => {
      const r = block.match(new RegExp(`<${t}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${t}>`, 'i'));
      return r ? r[1].trim() : '';
    };
    const title = get('title');
    const link  = get('link') || block.match(/href="([^"]+)"/)?.[1] || get('guid');
    const desc  = get('summary') || get('description') || get('content');
    const image = block.match(/url="([^"]+\.(jpg|jpeg|png|webp))"/i)?.[1] ||
                  block.match(/<img[^>]+src="([^"]+)"/i)?.[1] || null;
    if (title && title !== '[Removed]') {
      items.push({
        titulo: title,
        texto:  desc.replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#\d+;/g,'').trim().slice(0, 400) || title,
        enlace: link || null,
        imagen: image,
      });
    }
  }
  return items;
}

const FUENTES = [
  { url: 'https://www.minecraft.net/en-us/feeds/community-content/articles.xml', nombre: 'Minecraft.net', limite: 4 },
  { url: 'https://www.planetminecraft.com/rss/news.xml', nombre: 'Planet Minecraft', limite: 3 },
];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://minecraft-en-espanol-admin.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const articulos = [];
  const fechaHoy  = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  const desde     = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  for (const fuente of FUENTES) {
    try {
      const r   = await fetch(fuente.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MinecraftBot/1.0)' } });
      if (!r.ok) { console.error(`${fuente.nombre}: HTTP ${r.status}`); continue; }
      const xml   = await r.text();
      const items = parseItems(xml).slice(0, fuente.limite);
      items.forEach(i => articulos.push({ ...i, fuente: fuente.nombre }));
      console.log(`${fuente.nombre}: ${items.length} artículos`);
    } catch (e) { console.error(`${fuente.nombre} error:`, e.message); }
  }

  try {
    const url  = `https://newsapi.org/v2/everything?q=%22Minecraft%22&from=${desde}&sortBy=publishedAt&pageSize=5&apiKey=${process.env.NEWSAPI_KEY}`;
    const r    = await fetch(url);
    const data = await r.json();
    if (data.status === 'ok') {
      for (const a of (data.articles || [])) {
        if (!a.title || a.title === '[Removed]' || !a.description) continue;
        if (!a.title.toLowerCase().includes('minecraft')) continue;
        articulos.push({
          titulo: a.title,
          texto:  a.description,
          enlace: a.url || null,
          imagen: a.urlToImage || null,
          fuente: a.source?.name || 'NewsAPI'
        });
      }
    } else {
      console.error('NewsAPI:', data.message);
    }
  } catch (e) { console.error('NewsAPI error:', e.message); }

  if (!articulos.length) {
    return res.status(200).json({ ok: true, guardadas: 0, mensaje: 'No se encontraron noticias' });
  }

  const traducidos = await Promise.all(articulos.map(async (a) => {
    const [titulo, texto] = await Promise.all([
      traducir(a.titulo),
      traducir(a.texto)
    ]);
    return { ...a, titulo, texto };
  }));

  const rows = traducidos.map(a => ({
    titulo: a.titulo,
    texto:  a.texto || a.titulo,
    enlace: a.enlace || null,
    imagen: a.imagen || null,
    fuente: a.fuente || null,
    fecha:  fechaHoy,
    estado: 'pendiente'
  }));

  const { error } = await sb.from('noticias_ia').insert(rows);
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ ok: true, guardadas: rows.length });
};
