// api/buscar-noticias.js
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const FUENTES = [
  { url: 'https://www.minecraft.net/en-us/feeds/community-content/articles.xml', nombre: 'Minecraft.net' },
  { url: 'https://www.ign.com/rss/articles', nombre: 'IGN' },
  { url: 'https://www.gamesradar.com/rss/', nombre: 'GamesRadar' },
  { url: 'https://www.eurogamer.net/?format=rss', nombre: 'Eurogamer' },
  { url: 'https://www.polygon.com/rss/index.xml', nombre: 'Polygon' },
  { url: 'https://kotaku.com/rss', nombre: 'Kotaku' },
  { url: 'https://www.gamespot.com/feeds/mashup/', nombre: 'GameSpot' },
  { url: 'https://www.windowscentral.com/rss.xml', nombre: 'Windows Central' },
  { url: 'https://www.meristation.com/rss/topnews.xml', nombre: 'Meristation' },
  { url: 'https://www.planetminecraft.com/rss/news.xml', nombre: 'Planet Minecraft' },
  { url: 'https://www.pcgamer.com/rss/', nombre: 'PC Gamer' },
  { url: 'https://www.rockpapershotgun.com/feed', nombre: 'Rock Paper Shotgun' },
  { url: 'https://www.vg247.com/feed', nombre: 'VG247' },
  { url: 'https://gamerant.com/feed/', nombre: 'Game Rant' },
  { url: 'https://www.thegamer.com/feed/', nombre: 'TheGamer' },
  { url: 'https://screenrant.com/feed/', nombre: 'Screen Rant' },
  { url: 'https://feeds.feedburner.com/minecrafter', nombre: 'Minecrafter' },
  ];

function extraerArticulos(xml) {
  const articulos = [];
  const tag = xml.includes('<entry') ? 'entry' : 'item';
  const re = new RegExp(`<${tag}[\\s>]([\\s\\S]*?)<\\/${tag}>`, 'g');
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const get = (t) => {
      const r = block.match(new RegExp(`<${t}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${t}>`, 'i'));
      return r ? r[1].trim() : '';
    };
    const titulo = get('title');
    if (!titulo || !titulo.toLowerCase().includes('minecraft')) continue;
    const enlace = get('link') || block.match(/href="([^"]+)"/)?.[1] || get('guid') || null;
    const imagen = block.match(/url="([^"]+\.(jpg|jpeg|png|webp))"/i)?.[1] ||
                   block.match(/<img[^>]+src="([^"]+)"/i)?.[1] ||
                   block.match(/<media:content[^>]+url="([^"]+)"/i)?.[1] || null;
    articulos.push({ titulo, enlace, imagen });
  }
  return articulos;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://minecraft-en-espanol-admin.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const fechaHoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  const articulos = [];

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
      const items = extraerArticulos(xml);
      items.forEach(i => articulos.push({ ...i, fuente: fuente.nombre }));
      console.log(`${fuente.nombre}: ${items.length} artículos de Minecraft`);
    } catch (e) { console.error(`${fuente.nombre} error:`, e.message); }
  }

  if (!articulos.length) {
    return res.status(200).json({ ok: true, guardadas: 0, mensaje: 'No se encontraron artículos de Minecraft' });
  }

  // Mandar a Groq con título, enlace e índice para que los devuelva
  const listaTexto = articulos.map((a, i) => `${i}. [${a.fuente}] ${a.titulo}`).join('\n');

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
          content: `Eres un redactor de noticias de Minecraft en español.
Recibirás una lista numerada de titulares. Selecciona los más interesantes y genera noticias en español.
Responde SOLO con JSON válido sin markdown:
{
  "noticias": [
    {
      "indice": 0,
      "titulo": "Título atractivo en español",
      "texto": "2-3 frases en español explicando la noticia de forma clara para fans de Minecraft",
      "fuente": "Nombre del medio"
    }
  ]
}
Genera entre 3 y 6 noticias. Incluye el índice exacto del titular original y No repitas noticias sobre el mismo tema aunque vengan de distintos medios. Si varios titulares hablan de lo mismo, elige solo uno, el mas completo preferiblemente.`
        },
        {
          role: 'user',
          content: `Titulares de hoy sobre Minecraft:\n\n${listaTexto}`
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

  // Usar el índice para recuperar enlace e imagen del artículo original
  const rows = noticias.map(n => {
    const original = articulos[n.indice] || {};
    return {
      titulo: n.titulo,
      texto:  n.texto,
      enlace: original.enlace || null,
      imagen: original.imagen || null,
      fuente: n.fuente || original.fuente || 'IA',
      fecha:  fechaHoy,
      estado: 'pendiente'
    };
  });

  const { error } = await sb.from('noticias_ia').insert(rows);
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ ok: true, guardadas: rows.length });
};
