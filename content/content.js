// Interview Copilot - Content Script v9
// Features: Left Position, Minimize Button
console.log("Interview Copilot: Content Script Loaded v9");

const SELECTORS = {
    youtube: { segment: '.ytp-caption-segment' },
    meet: { text: '.VbkSUe, .iTTPOb, .a4cQT, .CNusmb, div[jscontroller="xZbS8b"]' }
};

let currentPlatform = window.location.hostname.includes('youtube.com') ? 'youtube' : 'meet';
let lastCaptionText = "";
let autoMode = false;
let autoDebounceTimer = null;
let isProcessing = false;
let isExtensionContextInvalidated = false;
let isMinimized = false;

let captionSendTimer = null;
let pendingCaptionText = null;

let uiRefs = {
    transcript: null,
    response: null,
    status: null,
    btn: null,
    autoToggle: null,
    card: null,
    minBtn: null,
    contentArea: null,
    toolbar: null
};

function handleCaptionText(text) {
    if (isExtensionContextInvalidated) return;
    if (!text || text.trim().length === 0) return;
    if (text === lastCaptionText) return;

    lastCaptionText = text;
    updateLiveTranscript(text);

    pendingCaptionText = text;
    if (!captionSendTimer) {
        captionSendTimer = setTimeout(() => {
            if (pendingCaptionText) {
                safelySendMessage({
                    type: "NEW_CAPTION",
                    payload: {
                        text: pendingCaptionText,
                        timestamp: Date.now(),
                        platform: currentPlatform
                    }
                });
                pendingCaptionText = null;
            }
            captionSendTimer = null;
        }, 1000);
    }

    if (autoMode && !isProcessing) {
        if (autoDebounceTimer) clearTimeout(autoDebounceTimer);
        updateStatus("Ouvindo... (Auto)");
        autoDebounceTimer = setTimeout(() => {
            triggerHelp();
        }, 4000);
    }
}

function triggerHelp() {
    if (isExtensionContextInvalidated) return;
    if (isProcessing) return;
    isProcessing = true;

    // If minimized, maximize to show answer? Or stay minimized?
    // Better to maximize if it was auto-triggered? 
    // Let's keep state but maybe show a badge. For now, just generate.

    updateStatus('IA Gerando...');
    if (uiRefs.response) {
        uiRefs.response.innerHTML = '<span style="color:#666; font-style:italic;">Analizando novo contexto e gerando resposta completa...</span>';
    }
    if (uiRefs.btn) {
        uiRefs.btn.disabled = true;
        uiRefs.btn.innerText = 'GERANDO...';
    }

    safelySendMessage({ type: "HELP_REQUEST" }, (response) => {
        isProcessing = false;
        if (uiRefs.btn) {
            uiRefs.btn.disabled = false;
            uiRefs.btn.innerText = 'RESPONDER AGORA';
        }

        if (isExtensionContextInvalidated) return;

        if (response && response.success) {
            let formatted = response.data
                .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                .replace(/\n/g, '<br>');

            if (uiRefs.response) uiRefs.response.innerHTML = formatted;
            updateStatus('Respondido');
            if (uiRefs.transcript) uiRefs.transcript.textContent = "👂 (Aguardando nova pergunta...)";

        } else {
            const errorMsg = response ? response.error : 'Erro de conexão.';
            if (uiRefs.response) uiRefs.response.textContent = errorMsg;
            updateStatus('Erro');
        }
    });
}

function safelySendMessage(message, callback) {
    if (isExtensionContextInvalidated) return;
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        handleContextInvalidated();
        return;
    }
    try {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                if (!message.type.includes("HELP")) return;
                handleContextInvalidated();
                return;
            }
            if (callback) callback(response);
        });
    } catch (e) { handleContextInvalidated(); }
}

function handleContextInvalidated() {
    if (isExtensionContextInvalidated) return;
    isExtensionContextInvalidated = true;
    if (uiRefs.card) {
        uiRefs.card.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #d93025;">
                <p>⚠️ Conexão Perdida</p>
                <button onclick="window.location.reload()" style="background:#d93025;color:white;border:none;padding:10px;border-radius:4px;cursor:pointer;width:100%;margin-top:10px;">RECARREGAR PÁGINA</button>
            </div>
        `;
    }
}

function updateStatus(text) {
    if (uiRefs.status) uiRefs.status.textContent = text;
}

function updateLiveTranscript(text) {
    if (uiRefs.transcript) uiRefs.transcript.textContent = "👂 " + text;
}

function pollForCaptions() {
    if (isExtensionContextInvalidated) return;
    let fullText = "";
    if (currentPlatform === 'youtube') {
        const segments = document.querySelectorAll(SELECTORS.youtube.segment);
        if (segments && segments.length > 0) fullText = Array.from(segments).map(s => s.innerText).join(' ');
    } else if (currentPlatform === 'meet') {
        const nodes = document.querySelectorAll('.VbkSUe, .iTTPOb');
        if (nodes && nodes.length > 0) fullText = Array.from(nodes).map(n => n.innerText).filter(t => t && t.trim().length > 0).join(' ');
    }
    if (fullText) handleCaptionText(fullText);
}

function startObserving() {
    setInterval(() => { if (!isExtensionContextInvalidated) pollForCaptions(); }, 500);
}

function toggleMinimize() {
    isMinimized = !isMinimized;
    const body = uiRefs.card.querySelector('.card-body');
    const minBtn = uiRefs.minBtn;

    if (isMinimized) {
        body.style.display = 'none';
        minBtn.innerHTML = '+'; // Expand icon
        uiRefs.card.style.width = '200px';
    } else {
        body.style.display = 'flex';
        minBtn.innerHTML = '−'; // Minimize icon
        uiRefs.card.style.width = '400px';
    }
}

function createTeleprompter() {
    const existing = document.getElementById('interview-copilot-container');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = 'interview-copilot-container';
    container.style.position = 'fixed';
    container.style.bottom = '20px';
    container.style.left = '20px'; // MOVED TO LEFT
    container.style.zIndex = '999999';
    container.style.width = '400px';

    const shadow = container.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
    .card {
      background: rgba(255, 255, 255, 0.98);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
      padding: 15px;
      font-family: 'Segoe UI', sans-serif;
      border: 1px solid #ddd;
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: width 0.3s ease;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 5px;
    }
    .header-left { display: flex; align-items: center; gap: 8px; }
    
    .title { font-weight: 800; color: #4285f4; font-size: 16px; margin: 0; }
    .status { font-size: 11px; color: #555; font-weight: 600; text-transform: uppercase; }
    
    .min-btn {
        background: none;
        border: none;
        font-size: 20px;
        color: #666;
        cursor: pointer;
        font-weight: bold;
        line-height: 1;
        padding: 0 5px;
    }
    .min-btn:hover { color: #000; }

    .card-body {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .toolbar { display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
    .toggle-label { display: flex; align-items: center; gap: 6px; cursor: pointer; font-weight: 500;}

    .live-transcript {
      font-size: 11px;
      color: #666;
      background: #f8f9fa;
      padding: 8px;
      border-radius: 6px;
      min-height: 24px;
      max-height: 60px;
      overflow-y: auto;
      font-style: italic;
      border-left: 3px solid #34a853;
    }

    .content {
      font-size: 15px;
      color: #222;
      line-height: 1.6;
      min-height: 150px;
      max-height: 500px;
      overflow-y: auto;
      white-space: pre-wrap;
      padding: 12px;
      background: #fff;
      border: 1px solid #eee;
      border-radius: 6px;
      font-weight: 400;
    }
    
    .btn {
      background: #1a73e8; 
      color: white;
      border: none;
      padding: 14px;
      border-radius: 8px;
      font-weight: 700;
      cursor: pointer;
      width: 100%;
      text-transform: uppercase;
      font-size: 13px;
    }
    .btn:hover { background: #1557b0; }
    .btn:disabled { background: #ccc; cursor: not-allowed; }
  `;

    const card = document.createElement('div');
    card.className = 'card';

    card.innerHTML = `
    <div class="header">
        <div class="header-left">
            <h3 class="title">Interview Copilot</h3>
            <span class="status" id="status">Pronto</span>
        </div>
        <button class="min-btn" id="min-btn">−</button>
    </div>
    
    <div class="card-body">
        <div class="toolbar">
            <label class="toggle-label">
                <input type="checkbox" id="auto-mode"> Modo Automático (4s)
            </label>
        </div>

        <div class="live-transcript" id="ic-live-transcript">
          👂 Aguardando fala...
        </div>

        <div class="content" id="response-area">
          <span style="color:#999;font-weight:400;">Respostas aparecerão aqui...</span>
        </div>
        
        <button class="btn" id="help-btn">RESPONDER AGORA</button>
    </div>
  `;

    shadow.appendChild(style);
    shadow.appendChild(card);
    document.body.appendChild(container);

    uiRefs.card = card;
    uiRefs.minBtn = card.querySelector('#min-btn');
    uiRefs.btn = card.querySelector('#help-btn');
    uiRefs.response = card.querySelector('#response-area');
    uiRefs.status = card.querySelector('#status');
    uiRefs.transcript = card.querySelector('#ic-live-transcript');
    uiRefs.autoToggle = card.querySelector('#auto-mode');

    uiRefs.minBtn.addEventListener('click', toggleMinimize);
    uiRefs.btn.addEventListener('click', triggerHelp);
    uiRefs.autoToggle.addEventListener('change', (e) => {
        autoMode = e.target.checked;
        updateStatus(autoMode ? "Auto: Ligado" : "Auto: Desligado");
    });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', createTeleprompter);
else createTeleprompter();

startObserving();
