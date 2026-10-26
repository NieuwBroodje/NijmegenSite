// POST /api/add-packages { basketIdent, items: [{ package_id | id, quantity }] }
// Wordt aangeroepen NADAT de gebruiker is ingelogd via CFX.
// Controleert of de basket echt aan een CFX-gebruiker gekoppeld is, leegt oude items en voegt de nieuwe toe.

const { BASE, HEADERS, validIdent, getBasket } = require('./_tebex');

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

    res.status(200).json({ url: basket.links.checkout, username: basket.username });
  } catch (e) {
    console.error('Add packages fout:', e);
    res.status(502).json({ error: e.message });
  }
};
