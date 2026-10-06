export const config = { runtime: 'edge' };

import { checkRateLimit, getClientIP, corsHeaders, rateLimitHeaders } from './_lib/rate-limit.js';

const SUPABASE_URL = 'https://mtkesqoywahieuapftmh.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10a2VzcW95d2FoaWV1YXBmdG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2ODM1OTksImV4cCI6MjA4NzI1OTU5OX0.b_LmSnX_CGjL2YU5-JHqh14qHfv8NM9WNeMv5scZBpY';

const ALLOWED_TABLES = ['noticias', 'guias', 'otros', 'curiosidades', 'quiz'];
const SLUG_REGEX = /^[a-z0-9-]+$/;

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

  const ip = getClientIP(req);
  const { allowed, remaining, resetMs } = checkRateLimit(ip);
  
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: { 
        ...corsHeaders(), 
        'Content-Type': 'application/json',
        ...rateLimitHeaders(0, resetMs),
        'Retry-After': String(Math.ceil(resetMs / 1000))
      }
    });
  }

  const url = new URL(req.url);
  const table = url.searchParams.get('table');
  const action = url.searchParams.get('action');

  if (!table || !action) {
    return new Response(JSON.stringify({ error: 'Missing table or action' }), {
      status: 400,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json', ...rateLimitHeaders(remaining, resetMs) }
    });
  }

  if (!ALLOWED_TABLES.includes(table)) {
    return new Response(JSON.stringify({ error: 'Table not allowed' }), {
      status: 403,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json', ...rateLimitHeaders(remaining, resetMs) }
    });
  }

  try {
    let supabaseUrl, options;

    if (action === 'list') {
      const select = url.searchParams.get('select') || '*';
      const order = url.searchParams.get('order') || 'created_at.desc';
      const limit = url.searchParams.get('limit') || '100';
      
      supabaseUrl = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}&order=${encodeURIComponent(order)}&limit=${encodeURIComponent(limit)}`;
      options = { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } };

    } else if (action === 'by-slug') {
      const slug = url.searchParams.get('slug');
      if (!slug || !/^[a-z0-9-]+$/.test(slug) || slug.length > 200) {
        return new Response(JSON.stringify({ error: 'Invalid slug' }), {
          status: 400,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json', ...rateLimitHeaders(remaining, resetMs) }
        });
      }
      supabaseUrl = `${SUPABASE_URL}/rest/v1/${table}?slug=eq.${encodeURIComponent(slug)}&select=*`;
      options = { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } };

    } else if (action === 'by-id') {
      const id = url.searchParams.get('id');
      if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
        return new Response(JSON.stringify({ error: 'Invalid id' }), {
          status: 400,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json', ...rateLimitHeaders(remaining, resetMs) }
        });
      }
      supabaseUrl = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=*`;
      options = { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } };

    } else if (action === 'search' && req.method === 'POST') {
      const body = await req.json();
      const { query, table: searchTable, select = '*', limit = 20 } = body;
      
      if (!query || !searchTable || !['noticias', 'guias', 'otros', 'curiosidades', 'quiz'].includes(searchTable)) {
        return new Response(JSON.stringify({ error: 'Invalid search params' }), {
          status: 400,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json', ...rateLimitHeaders(remaining, resetMs) }
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
        headers: { ...corsHeaders(), 'Content-Type': 'application/json', ...rateLimitHeaders(remaining, resetMs) }
      });
    }

    const response = await fetch(supabaseUrl, options);
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json', ...rateLimitHeaders(remaining, resetMs) }
    });

  } catch (err) {
    console.error('Supabase proxy error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json', ...rateLimitHeaders(remaining, resetMs) }
    });
  }
}