// POST /api/checkout { items: [{ id, quantity }] }
// Stap 1: maak een basket aan
// Stap 2: haal CFX auth URL op (met de basket-ident in de return URL)
// Stap 3: stuur de gebruiker naar CFX om in te loggen
// Na login komt de gebruiker op /auth-return?basket=<ident>&items=...
// Daar worden de packages toegevoegd via /api/add-packages

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
  if (!token) return res.status(500).json({ error: 'TEBEX_PUBLIC_TOKEN ontbreekt in environment variables' });

  const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 25) : [];
  const clean = items
    .map(i => ({
      package_id: parseInt(i.id ?? i.package_id, 10),
      quantity: Math.min(Math.max(parseInt(i.quantity, 10) || 1, 1), 99)
    }))
    .filter(i => Number.isInteger(i.package_id) && i.package_id > 0);

  if (!clean.length) return res.status(400).json({ error: 'Winkelmand is leeg' });

  try {
    const origin = getOrigin(req);
    const basket = await createBasket(token, origin);

    // FIX: basket-ident meegeven in de return URL. Tebex voegt die zelf NIET toe,
    // daardoor kreeg je eerst "Kon je sessie niet ophalen".
    const itemsParam = encodeURIComponent(JSON.stringify(clean.map(i => ({ id: i.package_id, quantity: i.quantity }))));
    const returnUrl = `${origin}/auth-return?basket=${encodeURIComponent(basket.ident)}&items=${itemsParam}`;

    const authUrl = await getAuthUrl(token, basket.ident, returnUrl);

    if (!authUrl) {
      // Geen auth beschikbaar: probeer direct packages toe te voegen
      for (const item of clean) {
        const aRes = await fetch(`${BASE}/baskets/${basket.ident}/packages`, {
          method: 'POST',
          headers: HEADERS,
          body: JSON.stringify(item)
        });
        if (!aRes.ok) throw new Error(`Pakket toevoegen mislukt (${aRes.status}): ${await aRes.text()}`);
      }
      const fresh = await getBasket(token, basket.ident);
      const url = fresh?.links?.checkout;
      if (!url) throw new Error('Tebex gaf geen afreken-link terug');
      return res.status(200).json({ url });
    }

    res.status(200).json({ authUrl, basketIdent: basket.ident });
  } catch (e) {
    console.error('Checkout fout:', e);
    res.status(502).json({ error: e.message });
  }
};
