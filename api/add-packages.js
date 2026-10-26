// POST /api/add-packages { basketIdent, items: [{ package_id | id, quantity }] }
// Wordt aangeroepen NADAT de gebruiker is ingelogd via CFX.
// Controleert of de basket echt aan een CFX-gebruiker gekoppeld is, leegt oude items en voegt de nieuwe toe.

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

  const { basketIdent, items } = req.body || {};
  if (!validIdent(basketIdent)) return res.status(400).json({ error: 'basketIdent ontbreekt of is ongeldig' });

  const clean = (Array.isArray(items) ? items : [])
    .slice(0, 25)
    .map(i => ({
      package_id: parseInt(i.package_id || i.id, 10),
      quantity: Math.min(Math.max(parseInt(i.quantity, 10) || 1, 1), 99)
    }))
    .filter(i => Number.isInteger(i.package_id) && i.package_id > 0);

  if (!clean.length) return res.status(400).json({ error: 'Geen geldige items' });

  try {
    let basket;
    try {
      basket = await getBasket(token, basketIdent);
    } catch (e) {
      return res.status(e.status === 404 ? 410 : 502).json({ error: e.message, relogin: e.status === 404 });
    }

    // Basket al betaald/afgerond: de gebruiker moet opnieuw inloggen voor een nieuwe aankoop
    if (basket.complete) return res.status(410).json({ error: 'Deze basket is al afgerond', relogin: true });
    if (!basket.username) return res.status(401).json({ error: 'Niet ingelogd via CFX', relogin: true });

    // Oude items uit eerdere (afgebroken) pogingen eerst weghalen zodat er niets dubbel in zit
    for (const p of basket.packages || []) {
      try {
        await fetch(`${BASE}/baskets/${basketIdent}/packages/remove`, {
          method: 'POST',
          headers: HEADERS,
          body: JSON.stringify({ package_id: p.id })
        });
      } catch {}
    }

    for (const item of clean) {
      const aRes = await fetch(`${BASE}/baskets/${basketIdent}/packages`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(item)
      });
      if (!aRes.ok) {
        const errText = await aRes.text();
        let errMsg = `Pakket ${item.package_id} toevoegen mislukt (${aRes.status})`;
        try {
          const j = JSON.parse(errText);
          errMsg = j.detail || j.message || errMsg;
        } catch {}
        throw new Error(errMsg);
      }
    }

    // FIX: Tebex vult links.checkout pas zodra er pakketten in de basket zitten,
    // dus de basket moet NA het toevoegen opnieuw worden opgehaald.
    let url = null;
    for (let t = 0; t < 3 && !url; t++) {
      if (t) await new Promise(r => setTimeout(r, 400));
      try {
        const fresh = await getBasket(token, basketIdent);
        url = fresh?.links?.checkout || fresh?.links?.payment || null;
      } catch {}
    }
    if (!url) throw new Error('Tebex gaf geen afreken-link terug. Probeer het opnieuw.');

    res.status(200).json({ url, username: basket.username });
  } catch (e) {
    console.error('Add packages fout:', e);
    res.status(502).json({ error: e.message });
  }
};
