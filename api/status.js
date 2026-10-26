// GET /api/status -> { online, max } via de publieke FiveM server-API
module.exports = async (req, res) => {
  const code = process.env.FIVEM_CODE;
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
  if (!code) return res.status(200).json({ online: null });
  try {
    const r = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${encodeURIComponent(code)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const d = (await r.json()).Data;
    res.status(200).json({ online: d.clients, max: d.sv_maxclients });
  } catch {
    res.status(200).json({ online: null });
  }
};
