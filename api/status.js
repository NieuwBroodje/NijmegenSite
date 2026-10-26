// GET /api/status -> { online, max }, met debug per stap
module.exports = async (req, res) => {
  const code = (process.env.FIVEM_CODE || '').trim();
  res.setHeader('Cache-Control', 'no-store');
  if (!code) return res.status(200).json({ online: null, debug: 'FIVEM_CODE ontbreekt' });

  const opts = () => ({ headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(4000) });
  let step = 'join-link';
  let base = '';
  try {
    const j = await fetch(`https://cfx.re/join/${encodeURIComponent(code)}`, { ...opts(), redirect: 'manual' });
    base = (j.headers.get('x-citizenfx-url') || '').replace(/\/$/, '');
    if (!base) return res.status(200).json({ online: null, debug: `join-link gaf geen adres (status ${j.status})` });

    step = 'players.json';
    const pr = await fetch(`${base}/players.json`, opts());
    if (!pr.ok) return res.status(200).json({ online: null, debug: `players.json status ${pr.status}`, base });
    const players = await pr.json();

    step = 'info.json';
    let max = null;
    try {
      const ir = await fetch(`${base}/info.json`, opts());
      if (ir.ok) max = parseInt((await ir.json())?.vars?.sv_maxClients, 10) || null;
    } catch {}

    res.status(200).json({ online: Array.isArray(players) ? players.length : null, max });
  } catch (e) {
    res.status(200).json({ online: null, debug: `fout bij stap "${step}": ${String(e)}`, base });
  }
};
