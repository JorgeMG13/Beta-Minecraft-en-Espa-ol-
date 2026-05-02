// api/generar-noticia.js
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://minecraft-en-espanol-admin.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Falta la URL' });

  try {
    // 1. Descargar la página
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MinecraftBot/1.0)' }
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const html = await r.text();

    // 2. Extraer texto limpio
    const textoRaw = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000);

    // 3. Extraer imagen og
    const imgMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) ||
                     html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
    const imagen = imgMatch ? imgMatch[1] : null;

    // 4. Usar Groq para generar la noticia limpia en español
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 500,
        messages: [
          {
            role: 'system',
            content: `Eres un redactor de noticias de Minecraft en español. 
Tu tarea es transformar el contenido extraído de una web en una noticia limpia y atractiva en español.
Responde SOLO con un JSON con este formato exacto, sin texto adicional:
{"titulo": "Título corto y atractivo en español", "texto": "2-3 frases en español resumiendo la noticia de forma clara y directa, sin mencionar autores, fechas ni créditos"}`
          },
          {
            role: 'user',
            content: `URL: ${url}\n\nContenido extraído:\n${textoRaw}`
          }
        ]
      })
    });

    const groqData = await groqRes.json();
    const respuesta = groqData.choices?.[0]?.message?.content || '';
console.log('Groq respuesta:', respuesta);
console.log('Groq data:', JSON.stringify(groqData));

    let titulo = '';
    let texto  = '';

    try {
      const parsed = JSON.parse(respuesta.replace(/```json|```/g, '').trim());
      titulo = parsed.titulo || '';
      texto  = parsed.texto  || '';
    } catch (e) {
      // Si no parsea, usar el texto tal cual
      titulo = respuesta.split('\n')[0].slice(0, 100);
      texto  = respuesta.slice(0, 400);
    }

    return res.status(200).json({ ok: true, titulo, texto, imagen, enlace: url });

  } catch (err) {
    console.error('generar-noticia error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
