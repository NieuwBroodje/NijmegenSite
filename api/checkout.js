// POST /api/checkout { items: [{ id, quantity }] }
// Stap 1: maak een basket aan
// Stap 2: haal CFX auth URL op (met de basket-ident in de return URL)
// Stap 3: stuur de gebruiker naar CFX om in te loggen
// Na login komt de gebruiker op /auth-return?basket=<ident>&items=...
// Daar worden de packages toegevoegd via /api/add-packages

const { BASE, HEADERS, getOrigin, createBasket, getAuthUrl } = require('./_tebex');

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
      return res.status(200).json({ url: basket.links.checkout });
    }

    res.status(200).json({ authUrl, basketIdent: basket.ident });
  } catch (e) {
    console.error('Checkout fout:', e);
    res.status(502).json({ error: e.message });
  }
};
