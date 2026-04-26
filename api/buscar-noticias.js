// api/buscar-noticias.js
// Vercel Serverless Function — se ejecuta cada día a las 8:00 (configurado en vercel.json)
// Busca noticias de Minecraft con NewsAPI y las guarda en Supabase como 'pendiente'

import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://minecraft-en-espanol-admin.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const hoy = new Date();
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);
    const desde = ayer.toISOString().split('T')[0];

    // 1. Buscar en español primero
    let articulos = [];
    for (const lang of ['es', 'en']) {
      const url = `https://newsapi.org/v2/everything?q=Minecraft&language=${lang}&from=${desde}&sortBy=publishedAt&pageSize=5&apiKey=${process.env.NEWSAPI_KEY}`;
      const res2 = await fetch(url);
      const data = await res2.json();
      if (data.status === 'ok' && data.articles?.length) {
        articulos = data.articles.filter(a => a.title && a.title !== '[Removed]' && a.description);
        if (articulos.length) break;
      }
    }

    if (!articulos.length) {
      return res.status(200).json({ ok: true, guardadas: 0, mensaje: 'No se encontraron noticias' });
    }

    const fechaHoy = hoy.toLocaleDateString('es-ES', {
      day: '2-digit', month: 'long', year: 'numeric'
    });

    const rows = articulos.map(a => ({
      titulo: a.title,
      texto: a.description || a.content || '',
      enlace: a.url || null,
      imagen: a.urlToImage || null,
      fuente: a.source?.name || null,
      fecha: fechaHoy,
      estado: 'pendiente'
    }));

    const { error } = await sb.from('noticias').insert(rows);
    if (error) throw error;

    return res.status(200).json({ ok: true, guardadas: rows.length });

  } catch (err) {
    console.error('Error en buscar-noticias:', err);
    return res.status(500).json({ error: err.message });
  }
}
