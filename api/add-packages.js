// POST /api/add-packages { basketIdent, items: [{ package_id, quantity }] }
// Wordt aangeroepen NADAT de gebruiker is ingelogd via CFX
// Tebex koppelt de CFX-gebruiker aan de basket via de auth flow

const BASE = 'https://headless.tebex.io/api';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Alleen POST' });

  const token = process.env.TEBEX_PUBLIC_TOKEN;
  if (!token) return res.status(500).json({ error: 'TEBEX_PUBLIC_TOKEN ontbreekt' });

  const { basketIdent, items } = req.body || {};
  if (!basketIdent) return res.status(400).json({ error: 'basketIdent ontbreekt' });

  const clean = (Array.isArray(items) ? items : [])
    .map(i => ({
      package_id: parseInt(i.package_id || i.id, 10),
      quantity: Math.min(Math.max(parseInt(i.quantity, 10) || 1, 1), 99)
    }))
    .filter(i => Number.isInteger(i.package_id) && i.package_id > 0);

  if (!clean.length) return res.status(400).json({ error: 'Geen geldige items' });

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  try {
    // Haal eerst de huidige basket op om de checkout URL te weten
    const getRes = await fetch(`${BASE}/accounts/${token}/baskets/${basketIdent}`, {
      headers: { Accept: 'application/json' }
    });

    if (!getRes.ok) throw new Error(`Basket ophalen mislukt (${getRes.status})`);
    const basketData = await getRes.json();
    const basket = basketData.data;

    // Voeg elk pakket toe
    for (const item of clean) {
      const aRes = await fetch(`${BASE}/baskets/${basketIdent}/packages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(item)
      });

      if (!aRes.ok) {
        const errText = await aRes.text();
        let errMsg = `Pakket ${item.package_id} toevoegen mislukt (${aRes.status})`;
        try {
          const errJson = JSON.parse(errText);
          errMsg = errJson.detail || errJson.message || errMsg;
        } catch {}
        throw new Error(errMsg);
      }
    }

    res.status(200).json({ url: basket.links.checkout });
  } catch (e) {
    console.error('Add packages fout:', e);
    res.status(502).json({ error: e.message });
  }
};
