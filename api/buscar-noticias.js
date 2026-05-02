// api/buscar-noticias.js
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const FUENTES = [
  { url: 'https://www.pcgamer.com/rss/', nombre: 'PC Gamer' },
  { url: 'https://kotaku.com/rss', nombre: 'Kotaku' },
  { url: 'https://www.eurogamer.net/?format=rss', nombre: 'Eurogamer' },
  { url: 'https://www.rockpapershotgun.com/feed', nombre: 'Rock Paper Shotgun' },
  { url: 'https://www.polygon.com/rss/index.xml', nombre: 'Polygon' },
  { url: 'https://www.gamesradar.com/rss/', nombre: 'GamesRadar' },
  { url: 'https://www.vg247.com/feed', nombre: 'VG247' },
  { url: 'https://gamerant.com/feed/', nombre: 'Game Rant' },
  { url: 'https://www.thegamer.com/feed/', nombre: 'TheGamer' },
  { url: 'https://screenrant.com/feed/', nombre: 'Screen Rant' },
];

function extraerTitulos(xml) {
  const titulos = [];
  const re = /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const t = m[1].trim();
    if (t && t.toLowerCase().includes('minecraft')) titulos.push(t);
  }
  return titulos;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://minecraft-en-espanol-admin.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const fechaHoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

  // 1. Recoger titulares de Minecraft de todos los RSS
  const titulares = [];
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
      const items = extraerTitulos(xml);
      items.forEach(t => titulares.push({ titulo: t, fuente: fuente.nombre }));
      console.log(`${fuente.nombre}: ${items.length} titulares de Minecraft`);
    } catch (e) { console.error(`${fuente.nombre} error:`, e.message); }
  }

  if (!titulares.length) {
    return res.status(200).json({ ok: true, guardadas: 0, mensaje: 'No se encontraron titulares de Minecraft' });
  }

  // 2. Mandar los titulares a Groq para que genere noticias en español
  const listaTexto = titulares.map((t, i) => `${i + 1}. [${t.fuente}] ${t.titulo}`).join('\n');

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 2000,
      messages: [
        {
          role: 'system',
          content: `Eres un redactor de noticias de Minecraft en español para una web llamada "Minecraft en Español".
Recibirás una lista de titulares de noticias de Minecraft en inglés.
Tu tarea es seleccionar los más interesantes y crear noticias en español.
Responde SOLO con un JSON válido con este formato exacto, sin texto adicional ni markdown:
{
  "noticias": [
    {
      "titulo": "Título atractivo en español",
      "texto": "2-3 frases en español explicando la noticia de forma clara y directa para fans de Minecraft",
      "fuente": "Nombre del medio original"
    }
  ]
}
Genera entre 3 y 6 noticias. Solo las más relevantes e interesantes.`
        },
        {
          role: 'user',
          content: `Estos son los titulares de hoy sobre Minecraft:\n\n${listaTexto}`
        }
      ]
    })
  });

  const groqData = await groqRes.json();
  const respuesta = groqData.choices?.[0]?.message?.content || '';
  console.log('Groq respuesta:', respuesta);

  let noticias = [];
  try {
    const parsed = JSON.parse(respuesta.replace(/```json|```/g, '').trim());
    noticias = parsed.noticias || [];
  } catch (e) {
    console.error('Error parseando Groq:', e.message);
    return res.status(200).json({ ok: true, guardadas: 0, mensaje: 'Groq no devolvió JSON válido' });
  }

  if (!noticias.length) {
    return res.status(200).json({ ok: true, guardadas: 0, mensaje: 'Groq no generó noticias' });
  }

  const rows = noticias.map(n => ({
    titulo: n.titulo,
    texto:  n.texto,
    enlace: null,
    imagen: null,
    fuente: n.fuente || 'IA',
    fecha:  fechaHoy,
    estado: 'pendiente'
  }));

  const { error } = await sb.from('noticias_ia').insert(rows);
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ ok: true, guardadas: rows.length });
};
