export async function onRequest(context) {
    // Handle CORS for development/production
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    if (context.request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    if (context.request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }

    try {
        const { location, interest, exactLocation, routeType, duration, daysCount } = await context.request.json();

        // Retrieve API Key from Environment Variable
        // If running locally with wrangler, ensure .dev.vars or .env exists
        const apiKey = context.env.CEREBRAS_KEY;

        if (!apiKey) {
            return new Response(JSON.stringify({ error: "Configuration Error: API Key missing on server." }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Default duration and logic
        const totalMinutes = parseInt(duration) || 120;
        const isCircular = routeType === 'circular';
        const days = parseInt(daysCount) || 1;

        // Reuse the successful prompt logic from index.html (as it was the latest working version)
        // but adapted for the backend structure.
        let userOrigin = exactLocation ? exactLocation : location;

        // Prompt construction (adapted from index.html logic)
        let prompt = `Eres un guía experto. Crea un itinerario de ${days} día(s) en ${location}.
            Intereses: "${interest}".
            Duración por día: ${totalMinutes} minutos.
            Inicio obligatorio cada día: "${userOrigin}".
            Tipo de ruta: ${isCircular ? "CIRCULAR (acaba donde empieza)" : "LINEAL (ve de punto A a punto B)"}.
            
            IMPORTANTE: Devuelve SOLO un JSON válido con esta estructura, sin texto extra:
            {
                "dias": [
                    {
                        "dia": 1,
                        "titulo": "Nombre de la zona",
                        "historia": "Breve descripción con emojis",
                        "paradas": ["${userOrigin}", "Lugar 1", "Lugar 2", "Fin"]
                    }
                ]
            }`;

        const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "zai-glm-4.7",
                messages: [
                    { role: "system", content: "Eres un asistente útil que responde solo en JSON." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.2,
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            return new Response(JSON.stringify({ error: `Upstream API Error: ${response.status}`, details: errorText }), {
                status: 502, // Bad Gateway
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const data = await response.json();
        // Verify content structure before sending back
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error("Invalid response from AI provider");
        }

        // Return the "choices" part or just the content, but let's mirror what the frontend expects.
        // The frontend code expects:
        // const data = await response.json();
        // const content = JSON.parse(data.choices[0].message.content);
        // So we can just return the raw 'data' from Cerebras to keep it simple, 
        // OR parse it here and return clean JSON. 
        // Let's return the full 'data' object so the frontend change is minimal (it already parses choices).

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}
