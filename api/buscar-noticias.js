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
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await r.json();
    return data[0].map(s => s[0]).join('');
  } catch (e) {
    return texto;
  }
}

function parseItems(xml) {
  const tag = xml.includes('<entry') ? 'entry' : 'item';
  const items = [];
  const re = new RegExp(`<${tag}[\\s>]([\\s\\S]*?)<\\/${tag}>`, 'g');
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const get = (t) => {
      const r = block.match(new RegExp(`<${t}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${t}>`, 'i'));
      return r ? r[1].trim() : '';
    };
    const title = get('title');
    const link  = get('link') || block.match(/href="([^"]+)"/)?.[1] || get('guid');
    const desc  = get('summary') || get('description') || get('content');
    const image = block.match(/url="([^"]+\.(jpg|jpeg|png|webp))"/i)?.[1] ||
                  block.match(/<img[^>]+src="([^"]+)"/i)?.[1] || null;
    if (title && title !== '[Removed]' && title.toLowerCase().includes('minecraft')) {
      const textoLimpio = desc.replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#\d+;/g,'').trim().slice(0, 400);
      items.push({
        titulo: title,
        texto:  textoLimpio || title,
        enlace: link || null,
        imagen: image,
      });
    }
  }
  return items;
}

const FUENTES = [
  { url: 'https://www.pcgamer.com/rss/', nombre: 'PC Gamer', limite: 10 },
  { url: 'https://kotaku.com/rss', nombre: 'Kotaku', limite: 10 },
  { url: 'https://www.eurogamer.net/?format=rss', nombre: 'Eurogamer', limite: 10 },
  { url: 'https://www.rockpapershotgun.com/feed', nombre: 'Rock Paper Shotgun', limite: 10 },
  { url: 'https://www.polygon.com/rss/index.xml', nombre: 'Polygon', limite: 10 },
  { url: 'https://www.gamesradar.com/rss/', nombre: 'GamesRadar', limite: 10 },
  { url: 'https://www.vg247.com/feed', nombre: 'VG247', limite: 10 },
  { url: 'https://gamerant.com/feed/', nombre: 'Game Rant', limite: 10 },
  { url: 'https://www.thegamer.com/feed/', nombre: 'TheGamer', limite: 10 },
  { url: 'https://screenrant.com/feed/', nombre: 'Screen Rant', limite: 10 },
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
  const fechaHoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

  for (const fuente of FUENTES) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const r = await fetch(fuente.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MinecraftBot/1.0)' },
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!r.ok) { console.error(`${fuente.nombre}: HTTP ${r.status}`); continue; }
      const xml = await r.text();
      const items = parseItems(xml).slice(0, fuente.limite);
      items.forEach(i => articulos.push({ ...i, fuente: fuente.nombre }));
      console.log(`${fuente.nombre}: ${items.length} artículos de Minecraft`);
    } catch (e) { console.error(`${fuente.nombre} error:`, e.message); }
  }

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
