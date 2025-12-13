module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const hasApiKey = !!process.env.OPENROUTER_API_KEY;
  return res.status(200).json({ configured: hasApiKey });
};
