// api/buscar-noticias.js
// Vercel Serverless Function — se ejecuta cada día a las 8:00 (configurado en vercel.json)
// Busca noticias de Minecraft con Claude + web search y las guarda en Supabase como 'pendiente'

import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // service key, no anon key
);

export default async function handler(req, res) {
  // Seguridad: solo permite llamadas del cron de Vercel o tuyas manuales con la clave
  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    // 1. Llamar a Claude con web search activado
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 2000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: `Eres un asistente especializado en Minecraft. Tu tarea es buscar las noticias más relevantes de Minecraft de hoy y devolver un JSON con exactamente este formato, sin texto adicional ni markdown:
{
  "noticias": [
    {
      "titulo": "Título de la noticia en español",
      "texto": "Resumen de 3-4 frases en español, claro y atractivo para fans de Minecraft",
      "enlace": "https://url-de-la-fuente.com",
      "fuente": "Nombre del medio (ej: Mojang Blog, IGN, etc.)",
      "imagen": "https://url-imagen-si-existe.com o null"
    }
  ]
}
Devuelve entre 3 y 5 noticias. Solo JSON, nada más.`,
        messages: [
          {
            role: 'user',
            content: `Busca las noticias más recientes e importantes de Minecraft de hoy ${new Date().toLocaleDateString('es-ES')}. Incluye actualizaciones, snapshots, anuncios de Mojang, eventos y novedades relevantes.`
          }
        ]
      })
    });

    const data = await response.json();

    // 2. Extraer el texto de la respuesta
    const textoRespuesta = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    // 3. Parsear el JSON de noticias
    const parsed = JSON.parse(textoRespuesta.replace(/```json|```/g, '').trim());
    const noticias = parsed.noticias;

    if (!noticias || !noticias.length) {
      return res.status(200).json({ ok: true, guardadas: 0, mensaje: 'No se encontraron noticias' });
    }

    // 4. Guardar en Supabase con estado 'pendiente'
    const fechaHoy = new Date().toLocaleDateString('es-ES', {
      day: '2-digit', month: 'long', year: 'numeric'
    });

    const rows = noticias.map(n => ({
      titulo: n.titulo,
      texto: n.texto,
      enlace: n.enlace || null,
      imagen: n.imagen || null,
      fuente: n.fuente || null,
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
