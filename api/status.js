// GET /api/status -> { online, max } rechtstreeks van de server via de cfx.re join-code
module.exports = async (req, res) => {
  const code = (process.env.FIVEM_CODE || '').trim();
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
  if (!code) return res.status(200).json({ online: null, debug: 'FIVEM_CODE ontbreekt' });

  const opts = { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) };
  try {
    // Stap 1: join-link geeft het serveradres terug in een header
    const j = await fetch(`https://cfx.re/join/${encodeURIComponent(code)}`, { ...opts, redirect: 'manual' });
    const base = (j.headers.get('x-citizenfx-url') || '').replace(/\/$/, '');
    if (!base) return res.status(200).json({ online: null, debug: `Geen serveradres via join-link (status ${j.status})` });

    // Stap 2: spelers en max slots ophalen
    const [pr, ir] = await Promise.all([
      fetch(`${base}/players.json`, opts),
      fetch(`${base}/info.json`, opts)
    ]);
    if (!pr.ok) return res.status(200).json({ online: null, debug: `players.json status ${pr.status}` });

    const players = await pr.json();
    let max = null;
    if (ir.ok) {
      const info = await ir.json();
      max = parseInt(info?.vars?.sv_maxClients, 10) || null;
    }
    res.status(200).json({ online: Array.isArray(players) ? players.length : null, max });
  } catch (e) {
    res.status(200).json({ online: null, debug: String(e) });
  }
};
