// ═══════════════════════════════════════════════════════════════
//  UTILITY FUNCTIONS
//  (Separate module to avoid circular dependencies)
// ═══════════════════════════════════════════════════════════════

export function showField(id, text = '') {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = text;
        el.style.display = 'block';
    }
}

export function hideField(id) {
    const el = document.getElementById(id);
    if (el) {
        el.style.display = 'none';
    }
}

export function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

export function decodeHTML(html) {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
}

export function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = message;
        toast.className = `show ${type}`;
        setTimeout(() => {
            toast.classList.remove('show', type);
        }, 3000);
    }
}
