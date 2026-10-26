// POST /api/login -> { authUrl, basketIdent }
// Start alleen de Cfx.re login (zonder winkelmand). Na het inloggen keert Cfx/Tebex terug naar
// /auth-return?basket=<ident>&mode=login, waar de CFX-naam wordt opgehaald via /api/session.

// Gedeelde helpers voor de Tebex Headless API (bestanden met _ voor de naam worden door Vercel niet als route gebruikt)
const BASE = 'https://headless.tebex.io/api';
const HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };

const getOrigin = req => `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
const validIdent = s => typeof s === 'string' && /^[A-Za-z0-9_-]{5,120}$/.test(s);

async function createBasket(token, origin) {
  const r = await fetch(`${BASE}/accounts/${token}/baskets`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      complete_url: `${origin}/#/bedankt`,
      cancel_url: `${origin}/#/winkelmand`,
      complete_auto_redirect: true
    })
  });
  if (!r.ok) throw new Error(`Basket aanmaken mislukt (${r.status}): ${await r.text()}`);
  const basket = (await r.json()).data;
  if (!basket?.ident) throw new Error('Geen basket ident ontvangen van Tebex');
  return basket;
}

// Tebex geeft een lijst terug met { name, url } per login-provider (bij FiveM: Cfx.re)
async function getAuthUrl(token, ident, returnUrl) {
  const r = await fetch(
    `${BASE}/accounts/${token}/baskets/${ident}/auth?returnUrl=${encodeURIComponent(returnUrl)}`,
    { headers: { Accept: 'application/json' } }
  );
  if (!r.ok) throw new Error(`Auth URL ophalen mislukt (${r.status}): ${await r.text()}`);
  const j = await r.json();
  const list = Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : [];
  const pick = list.find(a => /cfx|fivem/i.test(`${a.name || ''} ${a.type || ''}`)) || list[0];
  return pick?.url || j?.url || null;
}

async function getBasket(token, ident) {
  const r = await fetch(`${BASE}/accounts/${token}/baskets/${ident}`, { headers: { Accept: 'application/json' } });
  if (!r.ok) {
    const e = new Error(`Basket ophalen mislukt (${r.status})`);
    e.status = r.status;
    throw e;
  }
  return (await r.json()).data;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Alleen POST' });
  const token = process.env.TEBEX_PUBLIC_TOKEN;
  if (!token) return res.status(500).json({ error: 'TEBEX_PUBLIC_TOKEN ontbreekt' });

  try {
    const origin = getOrigin(req);
    const basket = await createBasket(token, origin);
    // De basket-ident zit zelf in de return URL, Tebex stuurt die niet vanzelf mee terug
    const returnUrl = `${origin}/auth-return?basket=${encodeURIComponent(basket.ident)}&mode=login`;
    const authUrl = await getAuthUrl(token, basket.ident, returnUrl);
    if (!authUrl) throw new Error('Geen login-provider beschikbaar bij Tebex');
    res.status(200).json({ authUrl, basketIdent: basket.ident });
  } catch (e) {
    console.error('Login fout:', e);
    res.status(502).json({ error: e.message });
  }
};
