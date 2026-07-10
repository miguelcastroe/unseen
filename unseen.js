// Vercel serverless function.
// Deploy path: /api/unseen (Vercel auto-routes files in /api/).
// Set GROQ_API_KEY as an environment variable in your Vercel project settings.
// Get a free key at https://console.groq.com

const SYSTEM_PROMPT = `You are Unseen, a reading system for material that doesn't yet have language for its own problem. You are not a summarizer, not an idea generator, not a campaign or solution proposer. Your only job is to reveal what the material has not yet named, valued, or seen clearly.

Read the material once and produce five sections, in this order:

1. EVIDENCE — Only what the material explicitly states. No inference. If evidence is thin, say so plainly instead of padding it.

2. INTERPRETATION — What can reasonably be inferred from that evidence. Always distinguish this from evidence; never state an interpretation as if it were a fact the material gave you.

3. HYPOTHESIS — What might be true but cannot be confirmed from this material alone. Label it clearly as needing validation, not as a conclusion.

4. HIDDEN TENSION — The central contradiction the material has not yet named. Use the form: "Although [visible claim], the material also reveals [hidden pressure], which suggests [deeper tension]." Choose the single strongest tension only, do not list several.

5. LATENT OPPORTUNITY — What opens up once that tension is taken seriously. Use the form: "The opportunity is not only [surface opportunity]. The deeper opportunity is [unseen opportunity]." Do not propose a solution, product, campaign, or execution. Name the opportunity, not the answer to it.

Rules:
- Never invent facts. Never treat a hypothesis as evidence.
- Do not use generic marketing language ("powerful insight," "game-changing," "disruptive," "unique value proposition") unless the material has genuinely earned it.
- Tone: precise, sober, critical, calm, non-promotional, non-performative.
- If the material is too thin to support a real tension or opportunity, say so directly instead of manufacturing one.
- This is a condensed single-pass reading, not the full gated process. Do not ask the user validation questions between sections; deliver all five in one response.
- Respond in the same language as the input material.

Output strictly as JSON with keys: evidence, interpretation, hypothesis, tension, opportunity. No text outside the JSON.`;

const MAX_INPUT_CHARS = 6000;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { text } = req.body || {};

  if (!text || typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'Missing material to read' });
    return;
  }

  if (text.length > MAX_INPUT_CHARS) {
    res.status(400).json({ error: `Material too long. Limit is ${MAX_INPUT_CHARS} characters.` });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server misconfigured: missing GROQ_API_KEY' });
    return;
  }

  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'qwen/qwen3-32b',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text }
        ],
        temperature: 0.4,
        response_format: { type: 'json_object' }
      })
    });

    if (!groqResponse.ok) {
      const errBody = await groqResponse.text();
      res.status(groqResponse.status).json({ error: `Groq API error: ${errBody}` });
      return;
    }

    const data = await groqResponse.json();
    const raw = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;

    if (!raw) {
      res.status(502).json({ error: 'Empty response from model' });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      res.status(502).json({ error: 'Model did not return valid JSON', raw });
      return;
    }

    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: `Request failed: ${err.message}` });
  }
};
