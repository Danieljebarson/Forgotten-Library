export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const key = process.env.GEMINI_API_KEY;
  console.log('Key starts with:', key?.substring(0, 8));
  console.log('Key length:', key?.length);

  
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: geminiMessages,
          generationConfig: { 
            maxOutputTokens: 1000,
            temperature: 0.9
          }
        })
      }
    );

    const data = await response.json();
    console.log('Gemini response:', JSON.stringify(data));
    
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    res.status(200).json({ content: [{ text }] });
  } catch(e) {
    console.error('Error:', e);
    res.status(500).json({ error: e.message });
  }
}