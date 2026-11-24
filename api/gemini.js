 module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metode tidak diizinkan' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('ERROR: GEMINI_API_KEY belum dipasang di Vercel');
    return res.status(500).json({ error: 'GEMINI_API_KEY belum dipasang di Vercel.' });
  }

  try {
    const { contents, systemInstruction, generationConfig, model } = req.body || {};

    const normalizedContents =
      typeof contents === 'string'
        ? [{ parts: [{ text: contents }] }]
        : contents;

    const payload = { contents: normalizedContents };
    if (systemInstruction) payload.systemInstruction = systemInstruction;
    if (generationConfig) payload.generationConfig = generationConfig;

    // Prioritaskan gemini-3-flash-preview agar langsung merespons 200 OK tanpa 404
    const requestedModel =
      model && model !== 'gemini-2.5-flash' ? model : null;

    const modelsToTry = [
      ...new Set(
        [
          requestedModel,
          'gemini-3-flash-preview',
          'gemini-2.5-flash',
          'gemini-2.0-flash',
        ].filter(Boolean)
      ),
    ];

    let lastStatus = 500;
    let lastData = { error: 'Tidak ada model AI yang merespons.' };

    for (const currentModel of modelsToTry) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (response.ok) {
        return res.status(200).json(data);
      }

      lastStatus = response.status;
      lastData = data;
      console.warn(`Fallback dari ${currentModel} (${response.status}):`, JSON.stringify(data));

      if (response.status !== 404) {
        break;
      }
    }

    console.error('Semua model Gemini gagal:', lastStatus, JSON.stringify(lastData));
    return res.status(lastStatus).json(lastData);
  } catch (error) {
    console.error('Server Error:', error.message);
    return res.status(500).json({ error: 'Terjadi kesalahan server: ' + error.message });
  }
};
