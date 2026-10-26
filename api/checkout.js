// POST /api/checkout { items: [{ id, quantity }] }
// Stap 1: maak een basket aan
// Stap 2: haal CFX auth URL op
// Stap 3: stuur de gebruiker naar CFX om in te loggen
// Na login keert Tebex terug naar complete_url met ?basketIdent=xxx
// Dan kunnen packages worden toegevoegd via /api/add-packages

const BASE = 'https://headless.tebex.io/api';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Alleen POST' });

  const token = process.env.TEBEX_PUBLIC_TOKEN;
  if (!token) return res.status(500).json({ error: 'TEBEX_PUBLIC_TOKEN ontbreekt in environment variables' });

  const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 25) : [];
  const clean = items
    .map(i => ({
      package_id: parseInt(i.id, 10),
      quantity: Math.min(Math.max(parseInt(i.quantity, 10) || 1, 1), 99)
    }))
    .filter(i => Number.isInteger(i.package_id) && i.package_id > 0);

  if (!clean.length) return res.status(400).json({ error: 'Winkelmand is leeg' });

  const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
  // Na CFX login stuurt Tebex terug naar deze URL
  // We coderen de items mee zodat we ze daarna kunnen toevoegen
  const itemsParam = encodeURIComponent(JSON.stringify(clean));
  const returnUrl = `${origin}/auth-return?items=${itemsParam}`;
  const cancelUrl = `${origin}/#/winkelmand`;

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  try {
    // 1. Maak basket aan
    const bRes = await fetch(`${BASE}/accounts/${token}/baskets`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        complete_url: `${origin}/#/bedankt`,
        cancel_url: cancelUrl,
        complete_auto_redirect: true
      })
    });

    if (!bRes.ok) {
      const errText = await bRes.text();
      throw new Error(`Basket aanmaken mislukt (${bRes.status}): ${errText}`);
    }

    const basketData = await bRes.json();
    const basket = basketData.data;

    if (!basket?.ident) {
      throw new Error('Geen basket ident ontvangen van Tebex');
    }

    // 2. Haal CFX auth URL op
    const authRes = await fetch(
      `${BASE}/accounts/${token}/baskets/${basket.ident}/auth?returnUrl=${encodeURIComponent(returnUrl)}`,
      { headers: { Accept: 'application/json' } }
    );

    if (!authRes.ok) {
      const errText = await authRes.text();
      throw new Error(`Auth URL ophalen mislukt (${authRes.status}): ${errText}`);
    }

    const authData = await authRes.json();
    // authData is een array van auth providers
    const cfxAuth = Array.isArray(authData)
      ? authData.find(a => a.type?.toLowerCase().includes('cfx') || a.type?.toLowerCase().includes('fivem'))
      : null;

    const authUrl = cfxAuth?.url || (Array.isArray(authData) && authData[0]?.url) || authData?.url;

    if (!authUrl) {
      // Geen auth beschikbaar: probeer direct packages toe te voegen (kan falen als Tebex auth vereist)
      for (const item of clean) {
        const aRes = await fetch(`${BASE}/baskets/${basket.ident}/packages`, {
          method: 'POST',
          headers,
          body: JSON.stringify(item)
        });
        if (!aRes.ok) {
          const errText = await aRes.text();
          throw new Error(`Pakket toevoegen mislukt (${aRes.status}): ${errText}`);
        }
      }
      return res.status(200).json({ url: basket.links.checkout });
    }

    // 3. Stuur gebruiker naar CFX login
    // Items worden na login toegevoegd via /api/add-packages
    res.status(200).json({ authUrl, basketIdent: basket.ident });
  } catch (e) {
    console.error('Checkout fout:', e);
    res.status(502).json({ error: e.message });
  }
};
