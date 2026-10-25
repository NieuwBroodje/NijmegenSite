// GET /api/packages -> categorieen + pakketten uit Tebex Headless API
const BASE = 'https://headless.tebex.io/api';

module.exports = async (req, res) => {
  const token = process.env.TEBEX_PUBLIC_TOKEN;
  if (!token) return res.status(500).json({ error: 'TEBEX_PUBLIC_TOKEN ontbreekt' });
  try {
    const r = await fetch(`${BASE}/accounts/${token}/categories?includePackages=1`, {
      headers: { Accept: 'application/json' }
    });
    if (!r.ok) throw new Error('Tebex antwoordde met ' + r.status);
    const { data } = await r.json();
    const categories = data.map(c => ({
      id: c.id,
      name: c.name,
      packages: (c.packages || []).map(p => ({
        id: p.id,
        name: p.name,
        image: p.image || null,
        description: String(p.description || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300),
        price: p.total_price ?? p.base_price,
        currency: p.currency || 'EUR',
        discount: p.discount || 0
      }))
    }));
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json({ categories });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
