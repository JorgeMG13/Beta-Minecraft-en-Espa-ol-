// api/publicar-programadas.js
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const ahora = new Date().toISOString();

    const { data: pendientes, error: errBuscar } = await sb
      .from('noticias_ia')
      .select('*')
      .eq('estado', 'programada')
      .lte('publicar_en', ahora);

    if (errBuscar) throw errBuscar;

    if (!pendientes || !pendientes.length) {
      return res.status(200).json({ ok: true, publicadas: 0 });
    }

    for (const n of pendientes) {
      // Insertar en noticias reales
      await sb.from('noticias').insert({
        titulo: n.titulo,
        texto:  n.texto,
        enlace: n.enlace || null,
        imagen: n.imagen || null,
        fecha:  n.fecha  || new Date().toLocaleDateString('es-ES', { day:'2-digit', month:'long', year:'numeric' })
      });

      // Borrar de noticias_ia
      await sb.from('noticias_ia').delete().eq('id', n.id);
    }

    return res.status(200).json({ ok: true, publicadas: pendientes.length });

  } catch (err) {
    console.error('Error en publicar-programadas:', err);
    return res.status(500).json({ error: err.message });
  }
};
