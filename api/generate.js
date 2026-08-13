/**
 * Endpoint seguro para Tácticas AI en Vercel.
 * Configurar GEMINI_API_KEY en las variables de entorno de Vercel.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Solo se permiten solicitudes POST." });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: "Gemini aún no está configurado. Agrega GEMINI_API_KEY en Vercel." });
  }

  const { brand, identity, brief, quantity, objective, attachments = [] } = req.body || {};
  const total = Math.min(Math.max(Number(quantity) || 1, 1), 60);
  if (!brand || !brief) return res.status(400).json({ error: "Faltan la marca o el brief." });

  const systemPrompt = `Eres el director creativo senior de Tácticas AI, una agencia guatemalteca. Creas matrices de contenido para Facebook que se sienten pensadas por una persona: estratégicas, concretas y culturalmente naturales. Nunca uses frases genéricas de IA, promesas vacías, ni repitas el mismo enfoque. Primero interpreta el brief, luego diseña un mix editorial equilibrado. Cada publicación debe tener un propósito y una idea central claramente distinta.

Devuelve ÚNICAMENTE JSON válido, sin Markdown, con esta forma exacta:
{"posts":[{"headline":"titular breve, máximo 8 palabras","format":"Post|Carrusel|Álbum","type":"ángulo editorial","concept":"explica de forma concreta de qué tratará esta pieza y por qué importa","visual":"dirección visual específica","copy":"copy natural para Facebook","hashtags":["#hashtag1","#hashtag2","#hashtag3","#hashtag4","#hashtag5"],"cta":"llamado a la acción breve","prompt":"prompt detallado para generar la imagen, sin texto ni logos"}]}

Solo se permiten estos formatos de Facebook: Post, Carrusel y Álbum. Crea exactamente la cantidad solicitada. Los titulares deben ir al grano. Respeta estrictamente las restricciones de identidad.`;

  const userPrompt = `MARCA: ${brand}
OBJETIVO: ${objective || "Crear contenido relevante"}
BRIEF DEL CLIENTE: ${brief}
CANTIDAD: ${total}

IDENTIDAD DE MARCA
- Tono y lenguaje: ${identity?.tone || "No definido"}
- Público: ${identity?.audience || "No definido"}
- Personajes: ${identity?.characters || "No definido"}
- Vestuario: ${identity?.wardrobe || "No definido"}
- Ambientes: ${identity?.settings || "No definido"}
- Restricciones: ${identity?.restrictions || "No definido"}
- Directriz creativa: ${identity?.guideline || "No definido"}

Antes de responder, usa las referencias visuales o documentales adjuntas como dirección de arte y contexto. No inventes detalles que no aparezcan en ellas.`;

  const parts = [{ text: `${systemPrompt}\n\n${userPrompt}` }];
  for (const file of attachments) {
    if (file?.data && file?.type && ["image/png", "image/jpeg", "application/pdf"].includes(file.type)) {
      parts.push({ inlineData: { mimeType: file.type, data: file.data } });
    }
  }

  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { temperature: 0.85, responseMimeType: "application/json" }
        })
      }
    );

    const payload = await geminiResponse.json();
    if (!geminiResponse.ok) {
      return res.status(geminiResponse.status).json({ error: payload?.error?.message || "Gemini no pudo generar la matriz." });
    }
    const text = payload?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("");
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.posts) || !parsed.posts.length) throw new Error("La respuesta de Gemini no tuvo publicaciones.");
    return res.status(200).json({ posts: parsed.posts.slice(0, total) });
  } catch (error) {
    return res.status(502).json({ error: error.message || "No fue posible procesar la respuesta de Gemini." });
  }
}
