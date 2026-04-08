// Prompts Configuration JavaScript

let currentPromptName = null;
let defaultPrompts = {};

document.addEventListener('DOMContentLoaded', function() {
    const promptsBtn = document.getElementById('prompts-btn');
    const promptsPanel = document.getElementById('prompts-panel');
    const cancelPromptsBtn = document.getElementById('cancel-prompts-btn');
    const promptTabs = document.querySelectorAll('.prompt-tab');
    const savePromptBtn = document.getElementById('save-prompt-btn');
    const resetPromptBtn = document.getElementById('reset-prompt-btn');
    const historyPromptBtn = document.getElementById('history-prompt-btn');
    const historyModal = document.getElementById('history-modal');
    const historyModalClose = document.getElementById('history-modal-close');
    
    // Load default prompts from server
    loadDefaultPrompts();
    
    // Toggle prompts panel
    promptsBtn.addEventListener('click', function() {
        const configPanel = document.getElementById('config-panel');
        configPanel.classList.remove('show');
        configPanel.classList.add('hidden');
        
        promptsPanel.classList.toggle('hidden');
        promptsPanel.classList.toggle('show');
        
        if (promptsPanel.classList.contains('show')) {
            // Load first prompt
            if (promptTabs.length > 0) {
                const firstTab = promptTabs[0];
                promptTabs.forEach(t => t.classList.remove('active'));
                firstTab.classList.add('active');
                const promptName = firstTab.getAttribute('data-prompt');
                loadPrompt(promptName);
            }
        }
    });
    
    // Close prompts panel
    cancelPromptsBtn.addEventListener('click', function() {
        promptsPanel.classList.remove('show');
        promptsPanel.classList.add('hidden');
    });
    
    // Tab switching
    promptTabs.forEach(tab => {
        tab.addEventListener('click', async function() {
            // Remove active class from all tabs
            promptTabs.forEach(t => t.classList.remove('active'));
            // Add active class to clicked tab
            this.classList.add('active');
            
            const promptName = this.getAttribute('data-prompt');
            await loadPrompt(promptName);
        });
    });
    
    // Save prompt
    savePromptBtn.addEventListener('click', async function() {
        if (!currentPromptName) return;
        
        const template = document.getElementById('prompt-template').value;
        
        if (!template.trim()) {
            showStatus('error', 'Prompt template cannot be empty');
            return;
        }
        
        try {
            const response = await fetch('/api/prompts/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt_name: currentPromptName,
                    template: template
                })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                showStatus('success', result.message || `Prompt "${currentPromptName}" saved successfully!`);
                // Reload to show updated status
                setTimeout(() => loadPrompt(currentPromptName), 1000);
            } else {
                showStatus('error', result.error || 'Failed to save prompt');
            }
        } catch (error) {
            showStatus('error', 'Error saving prompt: ' + error.message);
        }
    });
    
    // Version history
    historyPromptBtn.addEventListener('click', async function() {
        if (!currentPromptName) return;
        await openHistoryModal(currentPromptName);
    });

    historyModalClose.addEventListener('click', function() {
        historyModal.classList.add('hidden');
        historyModal.classList.remove('show');
    });

    historyModal.addEventListener('click', function(e) {
        if (e.target === historyModal) {
            historyModal.classList.add('hidden');
            historyModal.classList.remove('show');
        }
    });

    // Reset prompt
    resetPromptBtn.addEventListener('click', async function() {
        if (!currentPromptName) return;
        
        if (confirm(`Reset "${currentPromptName}" to default?`)) {
            try {
                const response = await fetch('/api/prompts/reset', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        prompt_name: currentPromptName
                    })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    showStatus('success', result.message || `Prompt "${currentPromptName}" reset to default`);
                    // Reload prompt
                    loadPrompt(currentPromptName);
                } else {
                    showStatus('error', result.error || 'Failed to reset prompt');
                }
            } catch (error) {
                showStatus('error', 'Error resetting prompt: ' + error.message);
            }
        }
    });
});

async function loadDefaultPrompts() {
    try {
        const response = await fetch('/api/prompts/default');
        if (response.ok) {
            defaultPrompts = await response.json();
        }
    } catch (error) {
        console.error('Error loading default prompts:', error);
    }
}

async function loadPrompt(promptName) {
    currentPromptName = promptName;
    
    // Get default prompt
    const defaultPrompt = defaultPrompts[promptName];
    if (!defaultPrompt) {
        showStatus('error', `Prompt "${promptName}" not found`);
        return;
    }
    
    // Check if user has custom version from server
    let customPrompt = null;
    try {
        const response = await fetch('/api/prompts/custom');
        if (response.ok) {
            const customPrompts = await response.json();
            customPrompt = customPrompts[promptName];
        }
    } catch (error) {
        console.error('Error loading custom prompts:', error);
    }
    
    // Update UI
    document.getElementById('prompt-name').textContent = defaultPrompt.name || promptName;
    document.getElementById('prompt-description').textContent = defaultPrompt.description || '';
    
    // Show variables
    const variablesDiv = document.getElementById('prompt-variables');
    if (defaultPrompt.variables && Object.keys(defaultPrompt.variables).length > 0) {
        variablesDiv.innerHTML = '<h5>Variables:</h5><ul>' +
            Object.entries(defaultPrompt.variables).map(([key, desc]) => 
                `<li><strong>{${key}}</strong>: ${desc}</li>`
            ).join('') +
            '</ul>';
    } else {
        variablesDiv.innerHTML = '';
    }
    
    // Load template (custom or default)
    const template = customPrompt ? customPrompt.template : defaultPrompt.template;
    document.getElementById('prompt-template').value = template;
    
    // Show save status if custom
    if (customPrompt) {
        const savedDate = new Date(customPrompt.saved_at).toLocaleString();
        showStatus('success', `Using custom version (saved: ${savedDate})`, false);
    } else {
        document.getElementById('prompt-save-status').classList.remove('success', 'error');
        document.getElementById('prompt-save-status').style.display = 'none';
    }
}

function showStatus(type, message, autoHide = true) {
    const statusDiv = document.getElementById('prompt-save-status');
    statusDiv.className = `save-status ${type}`;
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
    
    if (autoHide) {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    }
}

async function openHistoryModal(promptName) {
    const modal = document.getElementById('history-modal');
    const modalTitle = document.getElementById('history-modal-title');
    const modalBody = document.getElementById('history-modal-body');

    modalTitle.textContent = `Version History — ${promptName.replace(/_/g, ' ')}`;
    modalBody.innerHTML = '<p class="history-loading">Loading history…</p>';
    modal.classList.remove('hidden');
    modal.classList.add('show');

    try {
        const response = await fetch(`/api/prompts/history?prompt_name=${encodeURIComponent(promptName)}`);
        if (!response.ok) throw new Error('Failed to load history');
        const versions = await response.json();

        if (!versions || versions.length === 0) {
            modalBody.innerHTML = '<p class="history-empty">No previous versions saved yet. Save the prompt a couple of times to build history.</p>';
            return;
        }

        modalBody.innerHTML = versions.map(v => {
            const date = new Date(v.saved_at).toLocaleString();
            const preview = v.template.length > 200 ? v.template.slice(0, 200) + '…' : v.template;
            return `
                <div class="history-entry">
                    <div class="history-entry-header">
                        <span class="history-version">v${v.version}</span>
                        <span class="history-date">${date}</span>
                        <button class="btn-restore" onclick="restoreVersion('${promptName}', ${v.version})">↩ Restore</button>
                    </div>
                    <pre class="history-preview">${escapeHtml(preview)}</pre>
                </div>
            `;
        }).join('');
    } catch (err) {
        modalBody.innerHTML = `<p class="history-error">Error loading history: ${err.message}</p>`;
    }
}

async function restoreVersion(promptName, version) {
    if (!confirm(`Restore version ${version} of "${promptName}"? Your current version will be archived in history.`)) return;

    const modal = document.getElementById('history-modal');
    try {
        const response = await fetch('/api/prompts/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt_name: promptName, version })
        });
        const result = await response.json();
        if (response.ok) {
            modal.classList.add('hidden');
            modal.classList.remove('show');
            showStatus('success', result.message || `Restored version ${version}`);
            await loadPrompt(promptName);
        } else {
            showStatus('error', result.error || 'Failed to restore version');
        }
    } catch (err) {
        showStatus('error', 'Error restoring version: ' + err.message);
    }
}

function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
