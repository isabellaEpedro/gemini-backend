export default async function handler(req, res) {
  // 🔥 Habilita CORS
  res.setHeader("Access-Control-Allow-Origin", "https://xn--redaointerface-dhb.site"); // ou coloque seu domínio no lugar do *
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end(); // Responde pré-flight e sai
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required and must be a string' });
    }

    console.log("Gemini API key:", process.env.GEMINI_API_KEY ? "OK" : "MISSING");
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key n foi configurada' });
    }

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent?key=${apiKey}`;

    const body = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ]
    };

    const geminiResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API Error:', geminiResponse.status, errorText);

      if (geminiResponse.status === 429) {
        return res.status(429).json({
          error: 'A IA não conseguiu responder agora devido ao limite de uso, tente novamente em alguns minutos.'
        });
      }
      if (geminiResponse.status === 403) {
        return res.status(403).json({ error: 'A IA não conseguiu responder agora, tente novamente.' });
      }
      return res.status(500).json({ error: 'A IA não conseguiu responder agora, tente novamente.' });
    }

    const data = await geminiResponse.json();
    console.log('Gemini raw response:', JSON.stringify(data));

    const extractTextFromGemini = (d) => {
      if (!d) return null;
      let text = null;

      if (Array.isArray(d.candidates)) {
        for (const cand of d.candidates) {
          if (cand.content?.parts?.[0]?.text) {
            text = cand.content.parts[0].text;
            break;
          }
          if (typeof cand.output === 'string') text = cand.output;
          if (typeof cand.text === 'string') text = cand.text;
          if (text) break;
        }
      }

      if (!text) {
        const queue = [d];
        while (queue.length) {
          const node = queue.shift();
          if (!node || typeof node !== 'object') continue;
          for (const key of Object.keys(node)) {
            const val = node[key];
            if (key === 'text' && typeof val === 'string' && val.length > 10) {
              text = val;
              break;
            }
            if (typeof val === 'object') queue.push(val);
          }
        }
      }

      return text ? text.replace(/```(json)?/g, '').trim() : null;
    };

    const generatedText = extractTextFromGemini(data);

    if (!generatedText) {
      console.error('Unexpected Gemini response format:', JSON.stringify(data, null, 2));
      return res.status(500).json({ error: 'A IA não conseguiu responder agora, tente novamente.' });
    }

    return res.status(200).json({ success: true, response: generatedText });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'A IA não conseguiu responder agora, tente novamente.' });
  }
}
