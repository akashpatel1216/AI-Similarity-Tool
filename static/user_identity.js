function getStoredCanvasUserName() {
    return sessionStorage.getItem('canvas_user_name') || '';
}

function renderCanvasUserBadge() {
    const container = document.querySelector('.container');
    const header = container ? container.querySelector('header') : null;
    if (!container || !header) return;

    let badge = document.getElementById('canvas-user-pill');
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'canvas-user-pill';
        badge.className = 'canvas-user-pill';
        if (header.nextElementSibling) {
            container.insertBefore(badge, header.nextElementSibling);
        } else {
            container.appendChild(badge);
        }
    }

    const name = getStoredCanvasUserName();
    if (name) {
        badge.textContent = name.includes(' and ') ? `Selected professors: ${name}` : `Selected professor: ${name}`;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

async function refreshCanvasUserFromToken() {
    const apiToken = sessionStorage.getItem('api_token') || sessionStorage.getItem('canvas_api_token');
    const canvasUrl = sessionStorage.getItem('canvas_url');
    if (!apiToken || !canvasUrl) return;

    try {
        const response = await fetch('/api/canvas-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_token: apiToken,
                canvas_url: canvasUrl
            })
        });
        if (!response.ok) return;

        const data = await response.json();
        const name = data.name || data.short_name || data.login_id || '';
        if (name) {
            sessionStorage.setItem('canvas_user_name', name);
            renderCanvasUserBadge();
        }
    } catch (err) {
        console.error('Could not refresh Canvas user profile:', err);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    renderCanvasUserBadge();
    if (!getStoredCanvasUserName()) {
        refreshCanvasUserFromToken();
    }
});
