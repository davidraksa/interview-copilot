// Interview Copilot - Background Script v14
// Features: Strict Timestamp Consumption (Fix Infinite Loop), New Context Fields
console.log("Interview Copilot: Background Script Loaded v14");

// State
let conversationHistory = [];
let activeCaptions = [];
// timestamp of the last caption that was "consumed" (sent to Gemini)
let lastConsumedTimestamp = 0;
const HISTORY_LIMIT = 5;
let cachedModel = null;
const MODEL_BLACKLIST = ['gemini-2.5-pro', 'gemini-ultra'];

// --- Message Listener ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "NEW_CAPTION") {
        handleNewCaption(message.payload);
        return false;
    }

    if (message.type === "HELP_REQUEST") {
        handleHelpRequest().then(response => {
            try { sendResponse(response); } catch (e) { }
        });
        return true;
    }

    if (message.type === "CLEAR_HISTORY") {
        conversationHistory = [];
        activeCaptions = [];
        lastConsumedTimestamp = 0;
        sendResponse({ success: true });
        return false;
    }
});

function handleNewCaption(payload) {
    // Only add if it's newer than what we've already processed
    if (payload.timestamp <= lastConsumedTimestamp) return;

    // Add to active buffer
    const lastEntry = activeCaptions[activeCaptions.length - 1];
    if (lastEntry && payload.text.includes(lastEntry.text)) {
        lastEntry.text = payload.text;
        lastEntry.timestamp = payload.timestamp;
    } else {
        activeCaptions.push(payload);
    }

    if (activeCaptions.length > 50) activeCaptions.shift();
}

async function handleHelpRequest() {
    try {
        const {
            geminiApiKey,
            userContext,
            qaContext,
            jobDescription,
            responseInstructions
        } = await chrome.storage.local.get([
            'geminiApiKey',
            'userContext',
            'qaContext',
            'jobDescription',
            'responseInstructions'
        ]);

        if (!geminiApiKey) return { success: false, error: "API Key não configurada!" };

        // 1. Discover Model
        const model = await discoverBestModel(geminiApiKey);

        // 2. Prepare Context (Only use captains NEWER than last consumption)
        // Filter strictly by timestamp again just in case
        const validCaptions = activeCaptions.filter(c => c.timestamp > lastConsumedTimestamp);

        // Sort by time just to be sure
        validCaptions.sort((a, b) => a.timestamp - b.timestamp);

        const currentInput = validCaptions.map(c => c.text).join(" ").trim();

        // UPDATE CONSUMED TIMESTAMP immediately so we don't use these again
        if (validCaptions.length > 0) {
            lastConsumedTimestamp = validCaptions[validCaptions.length - 1].timestamp;
        }

        const effectiveInput = currentInput || "[O entrevistador está em silêncio ou aguardando]";

        const historyText = conversationHistory.map(turn =>
            `${turn.role === 'interviewer' ? 'ENTREVISTADOR' : 'VOCÊ (CANDIDATO)'}: "${turn.text}"`
        ).join("\n\n");

        const userBio = userContext || "Profissional qualificado.";
        const qa = qaContext || "";
        const job = jobDescription || "Vaga padrão.";
        const style = responseInstructions || "Seja direto, não enrole, vá direto ao ponto.";

        // 3. Construct Prompt
        const prompt = `
      ATUE COMO O CANDIDATO ("David") EM UMA ENTREVISTA DE EMPREGO.
      
      === CONTEXTO ===
      SOBRE MIM: ${userBio}
      SOBRE A VAGA: ${job}
      NOTAS Q&A: ${qa}
      
      === ESTILO DE RESPOSTA (IMPORTANTE) ===
      ${style}
      
      === HISTÓRICO DA CONVERSA ===
      ${historyText}
      
      === FALA ATUAL (O que ele acabou de dizer) ===
      "${effectiveInput}"
      
      === TAREFA ===
      Responda à FALA ATUAL.
      - Se "FALA ATUAL" for vazia ou silêncio, apenas diga algo para manter a conversa ou peça para prosseguir.
      - Use o contexto da Vaga para conectar minha experiência.
      - Fale em Português do Brasil (Primeira Pessoa).
    `;

        // 4. Call Gemini
        const responseText = await callGemini(geminiApiKey, model, prompt);

        // 5. Update History
        if (currentInput) {
            conversationHistory.push({ role: 'interviewer', text: currentInput });
        }
        conversationHistory.push({ role: 'candidate', text: responseText });

        if (conversationHistory.length > HISTORY_LIMIT * 2) {
            conversationHistory = conversationHistory.slice(-(HISTORY_LIMIT * 2));
        }

        // CLEAR active buffer completely
        activeCaptions = [];

        return { success: true, data: responseText };

    } catch (error) {
        if (error.message.includes("429")) {
            cachedModel = null;
            return { success: false, error: "Limite de cota (429). Aguarde 1 min." };
        }
        return { success: false, error: "Erro: " + error.message };
    }
}

// --- Discovery ---
async function discoverBestModel(apiKey) {
    if (cachedModel) return cachedModel;
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!response.ok) throw new Error("Falha ListModels");
        const data = await response.json();
        const models = (data.models || []).map(m => m.name.replace("models/", ""));

        const flash = models.find(m => m.includes("flash") && !MODEL_BLACKLIST.some(b => m.includes(b)));
        if (flash) { cachedModel = flash; return flash; }

        const pro = models.find(m => m.includes("pro") && !m.includes("vision") && !models.includes("2.5"));
        if (pro) { cachedModel = pro; return pro; }

        return "gemini-1.5-flash";
    } catch (e) {
        return "gemini-1.5-flash";
    }
}

async function callGemini(apiKey, model, prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await response.json();
    if (!response.ok) {
        if (data.error?.message?.includes("not found")) cachedModel = null;
        throw new Error(data.error?.message || response.statusText);
    }
    if (data.candidates && data.candidates.length > 0) return data.candidates[0].content.parts[0].text;
    throw new Error("Sem resposta.");
}
