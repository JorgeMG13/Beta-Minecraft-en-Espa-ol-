// api/buscar-noticias.js
// Busca noticias de Minecraft desde múltiples fuentes y las guarda en noticias_ia

import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Parsear RSS simple sin librerías externas
function parseRSS(xml) {
  const items = [];
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
  for (const match of itemMatches) {
    const item = match[1];
    const get = (tag) => {
      const m = item.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return m ? (m[1] || m[2] || '').trim() : '';
    };
    const title    = get('title');
    const link     = get('link') || get('guid');
    const desc     = get('description');
    const pubDate  = get('pubDate');
    const image    = item.match(/<media:thumbnail[^>]+url="([^"]+)"/)?.[1] ||
                     item.match(/<enclosure[^>]+url="([^"]+)"/)?.[1] || null;
    if (title && title !== '[Removed]') {
      items.push({ title, link, desc, pubDate, image });
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

  try {
    const hoy  = new Date();
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 2); // últimas 48h
    const desde = ayer.toISOString().split('T')[0];

    const articulos = [];

    // ── 1. RSS oficial de Minecraft.net ──
    try {
      const r = await fetch('https://www.minecraft.net/en-us/feeds/community-content/articles.xml');
      const xml = await r.text();
      const items = parseRSS(xml).slice(0, 3);
      for (const item of items) {
        articulos.push({
          titulo: item.title,
          texto:  item.desc || 'Noticia oficial de Minecraft.',
          enlace: item.link || null,
          imagen: item.image || null,
          fuente: 'Minecraft.net'
        });
      }
    } catch (e) { console.error('RSS Minecraft.net:', e.message); }

    // ── 2. RSS de Reddit r/Minecraft (filtraciones y rumores) ──
    try {
      const r = await fetch('https://www.reddit.com/r/Minecraft/new.rss', {
        headers: { 'User-Agent': 'MinecraftNewsBot/1.0' }
      });
      const xml = await r.text();
      const items = parseRSS(xml).slice(0, 3);
      for (const item of items) {
        articulos.push({
          titulo: item.title,
          texto:  item.desc?.replace(/<[^>]+>/g, '').slice(0, 300) || 'Post de Reddit.',
          enlace: item.link || null,
          imagen: item.image || null,
          fuente: 'Reddit r/Minecraft'
        });
      }
    } catch (e) { console.error('RSS Reddit:', e.message); }

    // ── 3. NewsAPI (medios gaming) ──
    try {
      const url = `https://newsapi.org/v2/everything?q=%22Minecraft%22&from=${desde}&sortBy=publishedAt&pageSize=4&apiKey=${process.env.NEWSAPI_KEY}`;
      const r    = await fetch(url);
      const data = await r.json();
      if (data.status === 'ok' && data.articles?.length) {
        for (const a of data.articles) {
          if (!a.title || a.title === '[Removed]' || !a.description) continue;
          // Filtrar que el título mencione Minecraft
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
    } catch (e) { console.error('NewsAPI:', e.message); }

    if (!articulos.length) {
      return res.status(200).json({ ok: true, guardadas: 0, mensaje: 'No se encontraron noticias' });
    }

    const fechaHoy = hoy.toLocaleDateString('es-ES', {
      day: '2-digit', month: 'long', year: 'numeric'
    });

    const rows = articulos.map(a => ({
      titulo: a.titulo,
      texto:  a.texto,
      enlace: a.enlace || null,
      imagen: a.imagen || null,
      fuente: a.fuente || null,
      fecha:  fechaHoy,
      estado: 'pendiente'
    }));

    const { error } = await sb.from('noticias_ia').insert(rows);
    if (error) throw error;

    return res.status(200).json({ ok: true, guardadas: rows.length });

  } catch (err) {
    console.error('Error en buscar-noticias:', err);
    return res.status(500).json({ error: err.message });
  }
}
