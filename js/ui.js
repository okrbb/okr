// js/ui.js

/**
 * Zobrazí modálne okno s daným obsahom.
 * @param {object} options - Objekt s konfiguráciou { title, content, pages, autoFocusSelector }.
 */
// === ZMENA: Použitie nového dizajnu modálu ===
export function showModal({ title, content, pages = [], autoFocusSelector = null }) {
    const modalContainer = document.getElementById('modal-container');
    let currentPage = 0;

    const renderPage = (index) => {
        // ... (pôvodná logika pre stránkovanie, ak existuje) ...
    };

    const modalHTML = `
        <div class="modal-overlay active">
            <div class="modal-content">
                <div class="modal-header">
                    ${title}
                    <button class="modal-close-btn">&times;</button>
                </div>
                <div class="modal-body">${content}</div>
                ${pages.length > 0 ? `
                <div class="modal-navigation">
                    <button class="btn btn--secondary modal-prev-btn">« Späť</button>
                    <span class="modal-page-indicator"></span>
                    <button class="btn btn--secondary modal-next-btn">Ďalej »</button>
                </div>` : ''}
            </div>
        </div>
    `;

    modalContainer.innerHTML = modalHTML;
    const overlay = modalContainer.querySelector('.modal-overlay');

    const closeModal = () => {
        overlay.classList.remove('active');
        setTimeout(() => modalContainer.innerHTML = '', 300);
    };
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.closest('.modal-close-btn')) {
            closeModal();
        }
    });

    if (pages.length > 0) {
        // ... (kód bezo zmeny) ...
    }

    if (autoFocusSelector) {
        const autoFocusInput = overlay.querySelector(autoFocusSelector);
        if (autoFocusInput) {
            autoFocusInput.focus();
            if (typeof autoFocusInput.select === 'function') {
                autoFocusInput.select();
            }
        }
    }
}
// === KONIEC ZMENY ===

/**
 * Zobrazí modálne okno pre chybové hlásenia.
 * @param {object} options - Objekt s konfiguráciou { title, message, details }.
 */
export function showErrorModal({ title = 'Chyba', message, details = '' }) {
    // === ZAČIATOK IMPLEMENTÁCIE ===
    const modalTitle = `
        <div class="help-center-header" style="color: var(--danger-color);">
            <i class="fas fa-exclamation-triangle"></i>
            <div class="title-group">
                <h3>${title}</h3>
                <span>Vyskytol sa problém</span>
            </div>
        </div>
    `;
    
    let detailsHTML = '';
    if (details) {
        detailsHTML = `
            <details style="margin-top: 1.5rem; background-color: var(--background-color); border-radius: var(--radius-lg); border: 1px solid var(--border-color); font-size: 0.9em;">
                <summary style="padding: 0.75rem 1rem; cursor: pointer; font-weight: 500;">
                    Technické detaily chyby
                </summary>
                <pre style="padding: 0 1rem 1rem 1rem; background: var(--surface-color); border-top: 1px solid var(--border-color); overflow-x: auto; white-space: pre-wrap; word-wrap: break-word; color: var(--text-secondary); max-height: 200px;">${details}</pre>
            </details>
        `;
    }

    const modalContent = `
        <p style="font-size: 1.1rem; color: var(--text-color);">${message}</p>
        ${detailsHTML}
    `;
    
    showModal({ title: modalTitle, content: modalContent });
    // === KONIEC IMPLEMENTÁCIE ===
}


/**
 * Zobrazí dočasnú "toast" notifikáciu a odošle udalosť pre centrum notifikácií.
 * @param {string} message - Správa na zobrazenie.
 * @param {string} type - Typ notifikácie (info, success, warning, error).
 * @param {number} duration - Trvanie v ms.
 */
// === FUNKCIA UPRAVENÁ PRE NOVÝ DIZAJN (des.html) ===
export function showNotification(message, type = 'info', duration = 3000) { 
    // === ZAČIATOK IMPLEMENTÁCIE ===
    
    const container = document.getElementById('notification-toast-container');
    if (!container) {
        console.error('Chýba #notification-toast-container v DOMe.');
        return;
    }

    // 1. Vytvoríme "toast" notifikáciu
    const notification = document.createElement('div');
    notification.className = `toast toast--${type}`;
    
    // Automatický titulok a ikona podľa typu (podľa des.html)
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    // === ZMENA: Odstránený objekt 'titles' ===
    // const titles = { ... };
    
    // === ZMENA: Odstránený .toast-title z HTML ===
    notification.innerHTML = `
        <div class="toast-icon">
            <i class="fas ${icons[type]}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-message">${message}</div>
        </div>
    `;
    
    // Vložíme notifikáciu (zmenené na .appendChild() kvôli flex-direction: column)
    container.appendChild(notification);
    // === KONIEC ZMENY ===

    // Skryjeme ju po 'duration'
    setTimeout(() => {
        notification.classList.add('hide'); // Pridá triedu pre animáciu výstupu
        // Odstránime element z DOMu po skončení animácie
        setTimeout(() => {
            if (notification.parentNode === container) {
                container.removeChild(notification);
            }
        }, 300); // 300ms (podľa novej transition v CSS)
    }, duration);

    // 2. Odošleme udalosť pre centrum notifikácií (zvonček) - bezo zmeny
    document.dispatchEvent(new CustomEvent('add-notification', {
        detail: { message, type }
    }));
    // === KONIEC IMPLEMENTÁCIE ===
}

/**
 * Zobrazí alebo skryje globálny spinner.
 * @param {boolean} show - True pre zobrazenie, false pre skrytie.
 */
export function toggleSpinner(show) {
    // === ZAČIATOK IMPLEMENTÁCIE ===
    const spinner = document.getElementById('spinner-overlay');
    if (spinner) {
        spinner.style.display = show ? 'flex' : 'none';
    }
    // === KONIEC IMPLEMENTÁCIE ===
}

/**
 * Nastaví stav tlačidla (napr. počas načítavania).
 * @param {HTMLElement} button - Element tlačidla.
 * @param {string} state - Stav ('loading', 'reset', 'success').
 * @param {string} text - Voliteľný text na zobrazenie.
 */
export function setButtonState(button, state, text = '') {
    // === ZAČIATOK IMPLEMENTÁCIE ===
    if (!button) return;

    const btnTextSpan = button.querySelector('.btn-text');
    
    // 1. Vyčistíme staré stavy (spinner)
    const existingSpinner = button.querySelector('.btn-spinner');
    if (existingSpinner) {
        existingSpinner.remove();
    }
    
    // 2. Nastavíme text, ak je poskytnutý
    if (text && btnTextSpan) {
        btnTextSpan.textContent = text;
    }
    
    // 3. Obnovíme zobrazenie pôvodnej ikony (napr. fa-cogs)
    const icon = button.querySelector('i');
    if (icon) {
        icon.style.display = '';
    }

    switch (state) {
        case 'loading':
            button.classList.add('loading');
            button.classList.remove('is-success');
            button.disabled = true;
            // Skryjeme pôvodnú ikonu
            if(icon) icon.style.display = 'none';
            // Vložíme spinner na začiatok tlačidla
            button.insertAdjacentHTML('afterbegin', '<span class="btn-spinner"></span>');
            break;

        case 'success':
            button.classList.remove('loading');
            button.classList.add('is-success');
            // Tlačidlo ostáva neaktívne, kým sa "resetne"
            button.disabled = true; 
            break;

        case 'reset':
            button.classList.remove('loading');
            button.classList.remove('is-success');
            // Tlačidlo odblokujeme, aby `checkAllButtonsState` mohol určiť jeho finálny stav
            button.disabled = false;
            break;
    }
    // === KONIEC IMPLEMENTÁCIE ===
}

/**
 * Vytvorí a zobrazí modálne okno so sledovaním priebehu.
 * TÁTO FUNKCIA UŽ NIE JE POUŽÍVANÁ V DOC PROCESSOR, ZOSTÁVA LEN PRE KOMPLETNOSŤ
 * (Kód funkcie bezo zmeny)
 */
export function createProgressTracker(totalItems, titleText) {
    // ... (kód bezo zmeny) ...
};

/**
 * Formátuje bajty na čitateľnú veľkosť (KB, MB).
 * @param {number} bytes - Veľkosť v bajtoch.
 * @returns {string} - Formátovaná veľkosť.
 */
export function formatBytes(bytes) {
    // === ZAČIATOK IMPLEMENTÁCIE ===
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    // === KONIEC IMPLEMENTÁCIE ===
}