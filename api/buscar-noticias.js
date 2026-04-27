// api/buscar-noticias.js
// Vercel Serverless Function — se ejecuta cada día a las 8:00 (configurado en vercel.json)
// Busca noticias de Minecraft con NewsAPI y las guarda en Supabase como 'pendiente'

import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    // 1. Buscar noticias de Minecraft en NewsAPI
    const hoy = new Date();
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);
    const desde = ayer.toISOString().split('T')[0];

    const url = `https://newsapi.org/v2/everything?q=Minecraft&language=es&from=${desde}&sortBy=publishedAt&pageSize=5&apiKey=${process.env.NEWSAPI_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'ok' || !data.articles?.length) {
      // Si no hay noticias en español, buscar en inglés
      const url2 = `https://newsapi.org/v2/everything?q=Minecraft&language=en&from=${desde}&sortBy=publishedAt&pageSize=5&apiKey=${process.env.NEWSAPI_KEY}`;
      const response2 = await fetch(url2);
      const data2 = await response2.json();

      if (data2.status !== 'ok' || !data2.articles?.length) {
        return res.status(200).json({ ok: true, guardadas: 0, mensaje: 'No se encontraron noticias' });
      }
      data.articles = data2.articles;
    }

    // 2. Filtrar artículos sin contenido útil
    const articulos = data.articles.filter(a => a.title && a.title !== '[Removed]' && a.description);

    if (!articulos.length) {
      return res.status(200).json({ ok: true, guardadas: 0, mensaje: 'No se encontraron noticias válidas' });
    }

    // 3. Formatear fecha en español
    const fechaHoy = hoy.toLocaleDateString('es-ES', {
      day: '2-digit', month: 'long', year: 'numeric'
    });

    // 4. Guardar en Supabase con estado 'pendiente'
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
