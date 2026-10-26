module.exports = async (req, res) => {
  const code = process.env.FIVEM_CODE;
  res.setHeader('Cache-Control', 'no-store');
  if (!code) return res.status(200).json({ online: null, debug: 'FIVEM_CODE ontbreekt (redeploy nodig?)' });
  try {
    const r = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${encodeURIComponent(code)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!r.ok) return res.status(200).json({ online: null, debug: `FiveM API status ${r.status}` });
    const d = (await r.json()).Data;
    res.status(200).json({ online: d.clients, max: d.sv_maxclients });
  } catch (e) {
    res.status(200).json({ online: null, debug: String(e) });
  }
};
