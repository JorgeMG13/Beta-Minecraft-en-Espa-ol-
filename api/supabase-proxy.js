export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://mtkesqoywahieuapftmh.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10a2VzcW95d2FoaWV1YXBmdG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2ODM1OTksImV4cCI6MjA4NzI1OTU5OX0.b_LmSnX_CGjL2YU5-JHqh14qHfv8NM9WNeMv5scZBpY';

const ALLOWED_TABLES = ['noticias', 'guias', 'otros', 'curiosidades', 'quiz'];
const SLUG_REGEX = /^[a-z0-9-]+$/;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': 'https://beta-minecraft-en-espanol.vercel.app',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function validateSlug(slug) {
  return slug && SLUG_REGEX.test(slug) && slug.length <= 200;
}

function validateId(id) {
  return id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace('/api/supabase-proxy', '');
  const segments = path.split('/').filter(Boolean);

  if (segments.length < 2) {
    return new Response(JSON.stringify({ error: 'Invalid path' }), {
      status: 400,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
    });
  }

  const table = segments[0];
  const action = segments[1];

  if (!ALLOWED_TABLES.includes(table)) {
    return new Response(JSON.stringify({ error: 'Table not allowed' }), {
      status: 403,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
    });
  }

  try {
    let supabaseUrl, options;

    if (action === 'list') {
      const select = url.searchParams.get('select') || '*';
      const order = url.searchParams.get('order') || 'created_at.desc';
      const limit = url.searchParams.get('limit') || '50';
      
      supabaseUrl = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}&order=${encodeURIComponent(order)}&limit=${encodeURIComponent(limit)}`;
      options = { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } };

    } else if (action === 'by-slug' && segments[2]) {
      const slug = segments[2];
      if (!validateSlug(slug)) {
        return new Response(JSON.stringify({ error: 'Invalid slug' }), {
          status: 400,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
        });
      }
      supabaseUrl = `${SUPABASE_URL}/rest/v1/${table}?slug=eq.${encodeURIComponent(slug)}&select=*`;
      options = { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } };

    } else if (action === 'by-id' && segments[2]) {
      const id = segments[2];
      if (!validateId(id)) {
        return new Response(JSON.stringify({ error: 'Invalid id' }), {
          status: 400,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
        });
      }
      supabaseUrl = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=*`;
      options = { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } };

    } else if (action === 'search' && req.method === 'POST') {
      const body = await req.json();
      const { query, table: searchTable, select = '*', limit = 20 } = body;
      
      if (!query || !searchTable || !ALLOWED_TABLES.includes(searchTable)) {
        return new Response(JSON.stringify({ error: 'Invalid search params' }), {
          status: 400,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
        });
      }
      
      supabaseUrl = `${SUPABASE_URL}/rest/v1/rpc/search_${searchTable}`;
      options = {
        method: 'POST',
        headers: { 
          apikey: SUPABASE_ANON_KEY, 
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify({ search_query: query, result_limit: limit })
      };
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 404,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
      });
    }

    const response = await fetch(supabaseUrl, options);
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Supabase proxy error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
    });
  }
}