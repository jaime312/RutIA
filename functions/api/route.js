export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();

    const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.CEREBRAS_KEY}`,
      },
      body: JSON.stringify({
        model: "zai-glm-4.7",
        messages: [
          { role: "system", content: "Eres un asistente de creación de rutas turísticas útil que responde solo en JSON." },
          { role: "user", content: body.prompt }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      })
    });

    const data = await response.text();

    return new Response(data, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}