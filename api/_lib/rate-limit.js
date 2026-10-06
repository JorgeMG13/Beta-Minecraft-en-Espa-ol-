// Rate limiting utility for Edge functions
// 60 requests per minute per IP (sliding window)

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const rateLimitStore = new Map();

export function rateLimitHeaders(remaining, resetMs) {
  return {
    'X-RateLimit-Limit': String(60),
    'X-RateLimit-Remaining': String(Math.max(0, remaining)),
    'X-RateLimit-Reset': String(Math.ceil(resetMs / 1000)),
  };
}

export function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - 60 * 1000;
  
  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, []);
  }
  
  const requests = rateLimitStore.get(ip).filter(ts => ts > windowStart);
  rateLimitStore.set(ip, requests);
  
  if (requests.length >= 60) {
    const oldest = requests[0];
    const resetMs = oldest + 60 * 1000 - now;
    return { allowed: false, remaining: 0, resetMs };
  }
  
  requests.push(now);
  return { allowed: true, remaining: 60 - requests.length, resetMs: 60 * 1000 };
}

export function getClientIP(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || req.headers.get('x-real-ip') 
      || 'unknown';
}

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': 'https://beta-minecraft-en-espanol.vercel.app',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}