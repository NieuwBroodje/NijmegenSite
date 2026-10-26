// GET /api/session?basket=<ident> -> { username, ident, complete }
// Leest de ingelogde Cfx.re-gebruiker uit de Tebex basket.
const { validIdent, getBasket } = require('./_tebex');

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
