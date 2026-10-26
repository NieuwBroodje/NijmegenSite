// GET /api/session?basket=<ident> -> { username, ident, complete }
// Leest de ingelogde Cfx.re-gebruiker uit de Tebex basket.

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
  res.setHeader('Cache-Control', 'no-store');
  const token = process.env.TEBEX_PUBLIC_TOKEN;
  if (!token) return res.status(500).json({ error: 'TEBEX_PUBLIC_TOKEN ontbreekt' });

  const ident = req.query?.basket;
  if (!validIdent(ident)) return res.status(400).json({ error: 'Ongeldige basket' });

  try {
    const b = await getBasket(token, ident);
    res.status(200).json({
      ident,
      username: b.username || null,
      complete: !!b.complete
    });
  } catch (e) {
    res.status(e.status === 404 ? 404 : 502).json({ error: e.message });
  }
};
