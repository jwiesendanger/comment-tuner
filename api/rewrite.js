export default async function handler(req, res) {
  // CORS — allow requests from same origin and Teams iframe
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { prompt, model, baseURL, apiKey } = req.body || {}

  if (!prompt) {
    return res.status(400).json({ error: 'Missing required field: prompt' })
  }

  // Key resolution: client override > Vercel env var
  const key = apiKey || process.env.API_KEY || process.env.OPENAI_API_KEY
  if (!key) {
    return res.status(500).json({
      error:
        'No API key configured. Add API_KEY as an environment variable in your Vercel project settings.',
    })
  }

  const resolvedBase = process.env.BASE_URL || baseURL || 'https://api.openai.com/v1'
  const resolvedModel = process.env.MODEL || model || 'gpt-4o-mini'
  const endpoint = `${resolvedBase.replace(/\/$/, '')}/chat/completions`

  let response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    })
  } catch (err) {
    return res.status(502).json({ error: `Could not reach model endpoint: ${err.message}` })
  }

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText)
    return res.status(response.status).json({ error: text })
  }

  let data
  try {
    data = await response.json()
  } catch {
    return res.status(502).json({ error: 'Invalid JSON from model endpoint' })
  }

  const rewrite = data?.choices?.[0]?.message?.content?.trim()
  if (!rewrite) {
    return res.status(500).json({ error: 'Model returned an empty response' })
  }

  return res.status(200).json({ rewrite })
}
