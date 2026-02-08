// Popup Logic
console.log("Popup script loaded");

document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey');
    const userContextInput = document.getElementById('userContext');
    const qaContextInput = document.getElementById('qaContext');

    // New Fields
    const jobDescInput = document.getElementById('jobDescription');
    const instructionsInput = document.getElementById('responseInstructions');

    const saveBtn = document.getElementById('saveBtn');
    const statusDiv = document.getElementById('status');

    // Load saved settings
    chrome.storage.local.get([
        'geminiApiKey',
        'userContext',
        'qaContext',
        'jobDescription',
        'responseInstructions'
    ], (result) => {
        if (result.geminiApiKey) apiKeyInput.value = result.geminiApiKey;
        if (result.userContext) userContextInput.value = result.userContext;
        if (result.qaContext) qaContextInput.value = result.qaContext;
        if (result.jobDescription) jobDescInput.value = result.jobDescription;
        if (result.responseInstructions) instructionsInput.value = result.responseInstructions;
    });

    // Save Settings
    saveBtn.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        const userContext = userContextInput.value.trim();
        const qaContext = qaContextInput.value.trim();
        const jobDesc = jobDescInput.value.trim();
        const instructions = instructionsInput.value.trim();

        if (!apiKey) {
            showStatus('Por favor, insira a API Key.', 'error');
            return;
        }

        chrome.storage.local.set({
            geminiApiKey: apiKey,
            userContext: userContext,
            qaContext: qaContext,
            jobDescription: jobDesc,
            responseInstructions: instructions
        }, () => {
            showStatus('Configurações salvas com sucesso!', 'success');
            // Clean history on save as "start fresh" signal
            chrome.runtime.sendMessage({ type: "CLEAR_HISTORY" });
        });
    });

    function showStatus(msg, type) {
        statusDiv.textContent = msg;
        statusDiv.className = 'status-bar ' + type;
        setTimeout(() => {
            statusDiv.textContent = '';
            statusDiv.className = 'status-bar';
        }, 3000);
    }
});
