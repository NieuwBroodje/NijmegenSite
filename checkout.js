// POST /api/checkout { items: [{ id, quantity }] } -> { url } (Tebex checkout)
const BASE = 'https://headless.tebex.io/api';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Alleen POST' });
  const token = process.env.TEBEX_PUBLIC_TOKEN;
  const key = process.env.TEBEX_PRIVATE_KEY;
  if (!token || !key) return res.status(500).json({ error: 'Tebex keys ontbreken' });

  const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 25) : [];
  const clean = items
    .map(i => ({ package_id: parseInt(i.id, 10), quantity: Math.min(Math.max(parseInt(i.quantity, 10) || 1, 1), 99) }))
    .filter(i => Number.isInteger(i.package_id));
  if (!clean.length) return res.status(400).json({ error: 'Winkelmand is leeg' });

  const auth = 'Basic ' + Buffer.from(`${token}:${key}`).toString('base64');
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: auth };
  const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;

  try {
    const b = await fetch(`${BASE}/accounts/${token}/baskets`, {
      method: 'POST', headers,
      body: JSON.stringify({
        complete_url: `${origin}/#/bedankt`,
        cancel_url: `${origin}/#/winkelmand`,
        complete_auto_redirect: true
      })
    });
    if (!b.ok) throw new Error('Mand aanmaken mislukt (' + b.status + ')');
    const basket = (await b.json()).data;

    for (const item of clean) {
      const a = await fetch(`${BASE}/baskets/${basket.ident}/packages`, {
        method: 'POST', headers, body: JSON.stringify(item)
      });
      if (!a.ok) throw new Error('Pakket ' + item.package_id + ' toevoegen mislukt (' + a.status + ')');
    }
    res.status(200).json({ url: basket.links.checkout });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
