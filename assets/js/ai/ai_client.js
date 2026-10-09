/**
 * IDE Indómito - Asistente de IA Client-side
 * Conexión directa mediante fetch() a Google Gemini, Mercury 2 y Grok
 * con almacenamiento seguro de API Keys en localStorage.
 */
const AIClient = {
    keysStorageKey: 'ide_indomito_ai_keys_v1',
    activeProvider: 'gemini',
    history: [],

    getStoredKeys() {
        try {
            return JSON.parse(localStorage.getItem(this.keysStorageKey)) || {};
        } catch (e) {
            return {};
        }
    },

    setApiKey(provider, key) {
        const keys = this.getStoredKeys();
        keys[provider] = key.trim();
        localStorage.setItem(this.keysStorageKey, JSON.stringify(keys));
    },

    getApiKey(provider) {
        const keys = this.getStoredKeys();
        return keys[provider] || '';
    },

    getAvailableProviders() {
        const keys = this.getStoredKeys();
        return [
            { id: 'gemini', name: 'Google Gemini 1.5 Flash', enabled: !!keys['gemini'] },
            { id: 'gemini-2.0-flash', name: 'Google Gemini 2.0 Flash', enabled: !!keys['gemini'] },
            { id: 'gemini-1.5-pro', name: 'Google Gemini 1.5 Pro', enabled: !!keys['gemini'] },
            { id: 'mercury', name: 'Mercury 2 (InceptionLabs)', enabled: !!keys['mercury'] },
            { id: 'grok', name: 'xAI Grok 2', enabled: !!keys['grok'] }
        ];
    },

    async generateResponse(provider, prompt, codigo = '', accionIa = 'chat', nombreArchivo = 'Sin título') {
        const systemInstruction = `Eres un asistente de IA experto en compiladores y programación en el IDE Indómito. ` +
            `El usuario está trabajando en '${nombreArchivo}'. Responde de forma concisa, técnica y con formato Markdown.`;

        let promptFinal = prompt;
        if (accionIa === 'explicar') {
            promptFinal = `Explica detalladamente el funcionamiento y la lógica del siguiente fragmento de código:\n\n\`\`\`\n${codigo}\n\`\`\``;
        } else if (accionIa === 'corregir') {
            promptFinal = `Analiza el siguiente código en busca de posibles errores de sintaxis, léxicos, lógicos o malas prácticas, e indica cómo corregirlos:\n\n\`\`\`\n${codigo}\n\`\`\``;
        } else if (accionIa === 'optimizar') {
            promptFinal = `Sugiere optimizaciones de rendimiento y legibilidad para el siguiente código:\n\n\`\`\`\n${codigo}\n\`\`\``;
        } else if (codigo) {
            promptFinal = `Contexto del código:\n\`\`\`\n${codigo}\n\`\`\`\n\nPregunta: ${prompt}`;
        }

        if (provider.startsWith('gemini')) {
            return await this.callGemini(provider, promptFinal, systemInstruction);
        } else if (provider === 'mercury') {
            return await this.callMercury(promptFinal, systemInstruction);
        } else if (provider === 'grok') {
            return await this.callGrok(promptFinal, systemInstruction);
        } else {
            throw new Error(`Proveedor de IA no soportado: ${provider}`);
        }
    },

    async callGemini(modelName, prompt, systemInstruction) {
        let apiKey = this.getApiKey('gemini');
        if (!apiKey) {
            apiKey = await this.promptForApiKey('Google Gemini');
            if (!apiKey) throw new Error("Se requiere una API Key de Google Gemini para usar este modelo.");
            this.setApiKey('gemini', apiKey);
        }

        const modelId = modelName === 'gemini' ? 'gemini-1.5-flash' : modelName;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

        const contents = [];
        for (const msg of this.history) {
            contents.push({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            });
        }
        contents.push({ role: 'user', parts: [{ text: prompt }] });

        const payload = {
            contents: contents,
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: { temperature: 0.4 }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) {
            const msg = data.error?.message || response.statusText;
            throw new Error(`Error de Gemini (${response.status}): ${msg}`);
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Gemini no devolvió una respuesta de texto válida.");

        return text;
    },

    async callMercury(prompt, systemInstruction) {
        let apiKey = this.getApiKey('mercury');
        if (!apiKey) {
            apiKey = await this.promptForApiKey('Mercury 2');
            if (!apiKey) throw new Error("Se requiere una API Key de Mercury 2 para usar este modelo.");
            this.setApiKey('mercury', apiKey);
        }

        const url = 'https://api.inceptionlabs.ai/v1/chat/completions';
        const messages = [{ role: 'system', content: systemInstruction }];
        for (const msg of this.history) {
            messages.push({ role: msg.role, content: msg.content });
        }
        messages.push({ role: 'user', content: prompt });

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'mercury-2',
                messages: messages,
                temperature: 0.4
            })
        });

        const data = await response.json();
        if (!response.ok) {
            const msg = data.error?.message || response.statusText;
            throw new Error(`Error de Mercury 2 (${response.status}): ${msg}`);
        }

        return data.choices?.[0]?.message?.content || "Sin respuesta de Mercury 2.";
    },

    async callGrok(prompt, systemInstruction) {
        let apiKey = this.getApiKey('grok');
        if (!apiKey) {
            apiKey = await this.promptForApiKey('xAI Grok');
            if (!apiKey) throw new Error("Se requiere una API Key de Grok.");
            this.setApiKey('grok', apiKey);
        }

        const url = 'https://api.x.ai/v1/chat/completions';
        const messages = [{ role: 'system', content: systemInstruction }, ...this.history, { role: 'user', content: prompt }];

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'grok-beta',
                messages: messages,
                temperature: 0.4
            })
        });

        const data = await response.json();
        if (!response.ok) {
            const msg = data.error?.message || response.statusText;
            throw new Error(`Error de Grok (${response.status}): ${msg}`);
        }

        return data.choices?.[0]?.message?.content || "Sin respuesta de Grok.";
    },

    async promptForApiKey(providerName) {
        if (typeof Modals !== 'undefined' && Modals.promptPassword) {
            return await Modals.promptPassword(
                `Configurar API Key para ${providerName}`,
                `Ingresa tu clave de API para ${providerName} (se guardará de forma segura en tu navegador):`
            );
        }
        return window.prompt(`Ingresa tu clave de API para ${providerName}:`);
    }
};

if (typeof window !== 'undefined') {
    window.AIClient = AIClient;
}
