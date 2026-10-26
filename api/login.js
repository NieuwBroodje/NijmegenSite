// POST /api/login -> { authUrl, basketIdent }
// Start alleen de Cfx.re login (zonder winkelmand). Na het inloggen keert Cfx/Tebex terug naar
// /auth-return?basket=<ident>&mode=login, waar de CFX-naam wordt opgehaald via /api/session.
const { getOrigin, createBasket, getAuthUrl } = require('./_tebex');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Alleen POST' });
  const token = process.env.TEBEX_PUBLIC_TOKEN;
  if (!token) return res.status(500).json({ error: 'TEBEX_PUBLIC_TOKEN ontbreekt' });

  try {
    const origin = getOrigin(req);
    const basket = await createBasket(token, origin);
    // De basket-ident zit zelf in de return URL, Tebex stuurt die niet vanzelf mee terug
    const returnUrl = `${origin}/auth-return?basket=${encodeURIComponent(basket.ident)}&mode=login`;
    const authUrl = await getAuthUrl(token, basket.ident, returnUrl);
    if (!authUrl) throw new Error('Geen login-provider beschikbaar bij Tebex');
    res.status(200).json({ authUrl, basketIdent: basket.ident });
  } catch (e) {
    console.error('Login fout:', e);
    res.status(502).json({ error: e.message });
  }
};
