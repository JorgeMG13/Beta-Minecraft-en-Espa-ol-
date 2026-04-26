// api/buscar-noticias.js
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function getText(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i'));
  return m ? m[1].trim() : '';
}

function parseItems(xml) {
  // RSS <item> o Atom <entry>
  const tag = xml.includes('<entry>') ? 'entry' : 'item';
  const items = [];
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'g');
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const title = getText(block, 'title');
    const link  = getText(block, 'link') || block.match(/href="([^"]+)"/)?.[1] || getText(block, 'guid');
    const desc  = getText(block, 'summary') || getText(block, 'description') || getText(block, 'content');
    const image = block.match(/url="([^"]+\.(jpg|jpeg|png|webp))"/i)?.[1] || null;
    if (title && title !== '[Removed]') {
      items.push({
        titulo: title,
        texto:  desc.replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').slice(0, 400) || title,
        enlace: link || null,
        imagen: image,
      });
    }
  }
  return items;
}

export default async function handler(req, res) {
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
  const desde     = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // ── 1. Minecraft.net oficial ──
  try {
    const r   = await fetch('https://www.minecraft.net/en-us/feeds/community-content/articles.xml', { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const xml = await r.text();
    const items = parseItems(xml).slice(0, 3);
    items.forEach(i => articulos.push({ ...i, fuente: 'Minecraft.net' }));
  } catch (e) { console.error('Minecraft.net RSS error:', e.message); }

  // ── 2. Reddit r/Minecraft ──
  try {
    const r   = await fetch('https://www.reddit.com/r/Minecraft/hot.json?limit=5', { headers: { 'User-Agent': 'MinecraftNewsBot/1.0' } });
    const data = await r.json();
    const posts = data?.data?.children || [];
    for (const post of posts.slice(0, 4)) {
      const p = post.data;
      if (!p.title) continue;
      articulos.push({
        titulo: p.title,
        texto:  p.selftext?.slice(0, 400) || p.title,
        enlace: `https://reddit.com${p.permalink}`,
        imagen: p.thumbnail?.startsWith('http') ? p.thumbnail : null,
        fuente: 'Reddit r/Minecraft'
      });
    }
  } catch (e) { console.error('Reddit error:', e.message); }

  // ── 3. NewsAPI ──
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
    }
  } catch (e) { console.error('NewsAPI error:', e.message); }

  if (!articulos.length) {
    return res.status(200).json({ ok: true, guardadas: 0, mensaje: 'No se encontraron noticias' });
  }

  const rows = articulos.map(a => ({
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
}
