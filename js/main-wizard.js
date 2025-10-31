// js/main-wizard.js
import { TEMPLATE_PATHS, TEMPLATE_DOWNLOAD_FILES } from './config.js';
import { showNotification, showErrorModal, showModal, formatBytes } from './ui.js';
import { agendaConfigs } from './agendaConfigFactory.js';
import { DocumentProcessor } from './DocumentProcessor.js';
import { startGuidedTour } from './tour.js';
import { getHelpCenterHTML } from './helpContent.js';

// Globálny stav aplikácie
const AppState = {
    selectedOU: null,
    okresData: null,
    spis: null, 
    selectedAgendaKey: null,
    processor: null,
    files: {}, 
    notifications: [],
    municipalitiesMailContent: {}, 
    zoznamyPreObceGenerated: false,
    currentView: 'welcome', // 'welcome', 'agenda' (už nie 'help')
    tempMailContext: {} 
};

// Načítanie statických JSON dát
async function loadStaticData() {
    try {
        const [ouResponse, emailResponse] = await Promise.all([
            fetch('DATA/okresne_urady.json'),
            fetch('DATA/emaily_obci.json')
        ]);

        if (!ouResponse.ok) throw new Error(`Nepodarilo sa načítať okresne_urady.json: ${ouResponse.statusText}`);
        if (!emailResponse.ok) throw new Error(`Nepodarilo sa načítať emaily_obci.json: ${emailResponse.statusText}`);

        const ouData = await ouResponse.json();
        const emailData = await emailResponse.json();
        
        return { ouData, emailData };
    } catch (error) {
        console.error("Chyba pri načítaní statických dát:", error);
        if (typeof showErrorModal === 'function') {
            showErrorModal({ 
                title: 'Kritická chyba aplikácie', 
                message: 'Nepodarilo sa načítať základné konfiguračné súbory (dáta OÚ alebo e-maily obcí). Aplikácia nemôže pokračovať. Skúste obnoviť stránku (F5).',
                details: error.message
            });
        } else {
            alert(`Kritická chyba: Nepodarilo sa načítať dáta. ${error.message}`);
        }
        return null;
    }
}

// Controller pre listenery viazané na #agenda-view
let agendaViewListenersController = new AbortController();

document.addEventListener('DOMContentLoaded', async () => {
    
    const spinner = document.getElementById('spinner-overlay');
    if (spinner) spinner.style.display = 'flex';

    // Inicializácia dát
    const staticData = await loadStaticData();
    if (!staticData) {
         if (spinner) spinner.style.display = 'none';
         return; 
    }
    
    const OKRESNE_URADY = staticData.ouData;
    const MUNICIPALITY_EMAILS = staticData.emailData;
    
    // === KĽÚČOVÁ ZMENA: Odstránenie `helpView` z DOM elementov ===
    // const helpView = document.getElementById('help-view');
    // ==========================================================
    const agendaNav = document.getElementById('agenda-navigation');
    const agendaLinks = agendaNav.querySelectorAll('.nav-link');
    const dashboardContent = document.getElementById('dashboard-content');
    
    const resetAppBtn = document.getElementById('reset-app-btn');
    const helpCenterBtn = document.getElementById('show-help-center');
    const resetTourBtn = document.getElementById('reset-tour-btn');

    // === ZAČIATOK ZMENY: Odstránené elementy zvončeka ===
    // const notificationBellBtn = document.getElementById('notification-bell-btn');
    // const notificationPanel = document.getElementById('notification-center-panel');
    // const notificationBadge = document.querySelector('.notification-badge');
    const notificationList = document.getElementById('notification-list');
    const clearNotificationsBtn = document.getElementById('clear-notifications-btn');
    // === KONIEC ZMENY ===

    // Inicializácia
    populateOkresnyUradSelect(OKRESNE_URADY); 
    initializeFromLocalStorage();
    startGuidedTour();
    updateUIState(); 

    // Pripojenie statických listenerov
    setupStaticListeners();
    
    if (spinner) spinner.style.display = 'none';

    
    /**
     * Pripája listenery, ktoré sa nemenia.
     * === KĽÚČOVÁ ZMENA: Listener pre `helpCenterBtn` volá `showHelpCenterModal` ===
     */
    function setupStaticListeners() {
        // === ZAČIATOK ZMENY: Zjednodušené listenery notifikácií ===
        // Notifikácie
        clearNotificationsBtn.addEventListener('click', () => { 
            AppState.notifications = []; 
            renderNotifications(); 
            // Priamo zavoláme addNotification, keďže showNotification už len dispatchuje
            addNotification('História notifikácií bola vymazaná.', 'info'); 
        });
        
        document.addEventListener('add-notification', (e) => { 
            addNotification(e.detail.message, e.detail.type); 
        });
        // Odstránené listenery pre notificationBellBtn a zatváranie panelu
        // === KONIEC ZMENY ===

        // Vlastný select pre OÚ (bez zmeny)
        const ouSelectWrapper = document.getElementById('ou-select-wrapper');
        const ouTrigger = document.getElementById('okresny-urad-trigger');
        const ouOptions = document.getElementById('okresny-urad-options');
        const ouLabel = document.getElementById('okresny-urad-label');
        if (ouTrigger && ouOptions && ouSelectWrapper && ouLabel) {
            ouTrigger.addEventListener('click', (e) => { e.stopPropagation(); const isOpen = ouOptions.classList.toggle('active'); ouSelectWrapper.classList.toggle('is-open', isOpen); ouTrigger.setAttribute('aria-expanded', isOpen); });
            ouOptions.addEventListener('click', (e) => { const targetOption = e.target.closest('.custom-select-option'); if (!targetOption) return; const selectedValue = targetOption.dataset.value; const selectedText = targetOption.textContent; ouLabel.textContent = selectedText; ouOptions.classList.remove('active'); ouSelectWrapper.classList.remove('is-open'); ouTrigger.setAttribute('aria-expanded', 'false'); ouOptions.querySelectorAll('.custom-select-option').forEach(opt => opt.classList.remove('selected')); targetOption.classList.add('selected'); if (AppState.selectedOU !== selectedValue) { setOkresnyUrad(selectedValue); } });
            document.addEventListener('click', (e) => { if (ouOptions && !ouSelectWrapper.contains(e.target)) { ouOptions.classList.remove('active'); ouSelectWrapper.classList.remove('is-open'); if(ouTrigger) ouTrigger.setAttribute('aria-expanded', 'false'); } });
        }

        // Hlavná navigácia a ovládacie prvky
        agendaLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                if (link.classList.contains('disabled')) { showNotification("Najprv prosím vyberte okresný úrad.", "warning"); return; }
                if (link.classList.contains('active')) return; // Zjednodušené, lebo help už nie je view
                if (dashboardContent) dashboardContent.scrollTo({ top: 0, behavior: 'smooth' });
                const agendaKey = link.dataset.agenda;
                renderAgendaView(agendaKey);
            });
        });
        resetAppBtn.addEventListener('click', () => { if (confirm("Naozaj chcete resetovať aplikáciu? Stratíte všetky neuložené dáta a výbery.")) { resetApp(); } });
        
        // === KĽÚČOVÁ ZMENA: Volanie `showHelpCenterModal` ===
        helpCenterBtn.addEventListener('click', () => {
             if (dashboardContent) dashboardContent.scrollTo({ top: 0, behavior: 'smooth' });
             showHelpCenterModal(); // Namiesto renderHelpCenterView
        });
        // === KONIEC ZMENY ===
        
        resetTourBtn.addEventListener('click', () => { localStorage.removeItem('krokr-tour-completed'); startGuidedTour(); });

        // Listenery pre modálne okná (bez zmeny v tejto časti)
        const modalContainer = document.getElementById('modal-container');
        modalContainer.addEventListener('click', (e) => { const target = e.target.closest('.prepare-mail-to-obec-btn'); if (!target) return; const obecName = decodeURIComponent(target.dataset.obec); showEmailPreviewModal(obecName); });
        modalContainer.addEventListener('click', (e) => { const target = e.target.closest('#modal-save-spis-btn'); if (!target) return; const modalInput = modalContainer.querySelector('#modal-spis-input'); const contextKeyEl = modalContainer.querySelector('#modal-spis-context-key'); const contextChangingEl = modalContainer.querySelector('#modal-spis-context-changing'); const contextExistingEl = modalContainer.querySelector('#modal-spis-context-existing'); if (!modalInput || !contextKeyEl || !contextChangingEl || !contextExistingEl) { console.error("Spis modal save failed: Could not find context elements."); return; } const agendaKey = contextKeyEl.value; const isChanging = contextChangingEl.value === 'true'; const existingValue = contextExistingEl.value; const spisValue = modalInput.value.trim(); if (spisValue) { if (isChanging && spisValue === existingValue) { document.querySelector('.modal-overlay .modal-close-btn')?.click(); return; } AppState.spis = spisValue; localStorage.setItem(`krokr-spis`, spisValue); document.querySelector('.modal-overlay .modal-close-btn')?.click(); if (isChanging) { const spisDisplaySpan = document.getElementById('agenda-view')?.querySelector('.spis-display span'); if (spisDisplaySpan) spisDisplaySpan.textContent = spisValue; showNotification(`Číslo spisu bolo zmenené na ${spisValue}.`, 'success'); } else { showNotification(`Číslo spisu ${spisValue} bolo uložené.`, 'success'); const agendaConfig = agendaConfigs[agendaKey]; if (agendaConfig) { renderAgendaTabs(agendaKey, agendaConfig); } } } else { showNotification("Prosím, zadajte platné číslo spisu.", "warning"); } });
        modalContainer.addEventListener('keyup', (e) => { if (e.key !== 'Enter') return; const target = e.target.closest('#modal-spis-input'); if (!target) return; const saveButton = modalContainer.querySelector('#modal-save-spis-btn'); if (saveButton) { saveButton.click(); } });
        modalContainer.addEventListener('click', async (e) => { const target = e.target.closest('#copy-and-open-mail-btn'); if (!target) return; const { htmlBody, recipient, subject, rowCount } = AppState.tempMailContext; if (!htmlBody) { showErrorModal({ message: 'Chyba: Nenašiel sa kontext e-mailu.' }); return; } try { const blob = new Blob([htmlBody], { type: 'text/html' }); const clipboardItem = new ClipboardItem({ 'text/html': blob }); await navigator.clipboard.write([clipboardItem]); showNotification(`Telo e-mailu (${rowCount} riadkov) bolo skopírované!`, 'success'); const mailtoLink = `mailto:${recipient}?subject=${encodeURIComponent(subject)}`; window.location.href = mailtoLink; } catch (err) { showErrorModal({ message: 'Nepodarilo sa automaticky skopírovať obsah.', details: 'Prosím, označte text v náhľade manuálne (Ctrl+A, Ctrl+C) a pokračujte. Chyba: ' + err.message }); } });
        modalContainer.addEventListener('click', (e) => { const target = e.target.closest('#show-partial-preview-btn'); if (!target) return; const { htmlBody } = AppState.tempMailContext; const partialPreviewContainer = modalContainer.querySelector('#email-partial-preview'); if (!htmlBody || !partialPreviewContainer) return; const tempDiv = document.createElement('div'); tempDiv.innerHTML = htmlBody; const table = tempDiv.querySelector('table'); if (table) { const rows = Array.from(table.querySelectorAll('tbody > tr')); const previewRows = rows.slice(0, 10); const newTbody = document.createElement('tbody'); previewRows.forEach(row => newTbody.appendChild(row.cloneNode(true))); table.querySelector('tbody').replaceWith(newTbody); partialPreviewContainer.innerHTML = tempDiv.innerHTML; partialPreviewContainer.style.display = 'block'; target.style.display = 'none'; } });
        
        // Statické taby pre #agenda-view (iba prepínanie)
        const agendaView = document.getElementById('agenda-view');
        if (agendaView) setupTabListeners(agendaView);
    }

    // === ZAČIATOK ZMENY: Zjednodušené funkcie notifikácií ===
    // Notifikácie
    function renderNotifications() { 
        if (!notificationList) return; 
        if (AppState.notifications.length === 0) { 
            notificationList.innerHTML = '<li class="empty-state">Zatiaľ žiadne nové notifikácie.</li>'; 
        } else { 
            notificationList.innerHTML = AppState.notifications.slice(0, 50).map(n => 
                `<li class="notification-item ${n.type}">
                    <i class="fas ${getIconForType(n.type)} icon"></i>
                    <div class="content">
                        <p>${n.message}</p>
                        <div class="meta">${new Date(n.timestamp).toLocaleTimeString()}</div>
                    </div>
                </li>`
            ).join('');
            
            // Automatické rolovanie na najnovšiu notifikáciu (navrch)
            notificationList.scrollTop = 0;
        } 
        // Odstránená logika pre notificationBadge
    }
    
    function addNotification(message, type = 'info') { 
        const newNotification = { id: Date.now(), message, type, timestamp: new Date() }; 
        AppState.notifications.unshift(newNotification); // Pridá na začiatok
        renderNotifications(); 
    }
    // === KONIEC ZMENY ===
    
    function getIconForType(type) { const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' }; return icons[type] || 'fa-info-circle'; }

    // Riadenie stavu UI (bez zmeny, okrem načítania elementov)
    function updateUIState() { const ouSelected = !!AppState.selectedOU; agendaLinks.forEach(link => { link.classList.toggle('disabled', !ouSelected); link.classList.toggle('active', link.dataset.agenda === AppState.selectedAgendaKey && AppState.currentView === 'agenda'); }); if (AppState.processor) AppState.processor.checkAllButtonsState(); const agendaView = document.getElementById('agenda-view'); const genTab = agendaView?.querySelector('.agenda-tab[data-tab="generovanie"]'); if (genTab) { const filesReady = AppState.selectedAgendaKey && agendaConfigs[AppState.selectedAgendaKey].dataInputs.every(input => AppState.files[input.id]); genTab.classList.toggle('is-disabled', !filesReady); } const mailBtnVp = agendaView?.querySelector('#send-mail-btn-vp'); if (mailBtnVp) { const showMailBtn = AppState.zoznamyPreObceGenerated && AppState.selectedAgendaKey === 'vp'; mailBtnVp.style.display = showMailBtn ? 'block' : 'none'; } }

    /**
     * Prepne aktívne zobrazenie v <main> kontajneri.
     * === KĽÚČOVÁ ZMENA: Odstránený prípad 'help' ===
     */
    function showView(viewName) {
        AppState.currentView = viewName;
        
        const welcomeView = document.getElementById('welcome-view');
        const agendaView = document.getElementById('agenda-view');
        // const helpView = document.getElementById('help-view'); // Už nepotrebujeme

        if (welcomeView) welcomeView.classList.remove('active');
        if (agendaView) agendaView.classList.remove('active');
        // if (helpView) helpView.classList.remove('active'); // Už nepotrebujeme
        
        switch (viewName) {
            case 'welcome':
                if (welcomeView) welcomeView.classList.add('active');
                break;
            case 'agenda':
                if (agendaView) agendaView.classList.add('active');
                break;
            // Prípad 'help' je odstránený
        }
        
        updateUIState();
    }
    
    // Hlavná logika a funkcie
    function resetAgendaState() { localStorage.removeItem('krokr-spis'); Object.assign(AppState, { spis: null, selectedAgendaKey: null, processor: null, files: {}, municipalitiesMailContent: {}, zoznamyPreObceGenerated: false, }); showWelcomeMessage(); }
    
    function resetApp() { 
        localStorage.removeItem('krokr-lastOU'); 
        localStorage.removeItem('krokr-lastAgenda'); 
        resetAgendaState(); 
        AppState.selectedOU = null; 
        AppState.okresData = null; 
        const ouLabel = document.getElementById('okresny-urad-label'); 
        const ouOptions = document.getElementById('okresny-urad-options'); 
        if (ouLabel) ouLabel.textContent = 'Prosím, vyberte OÚ'; 
        if (ouOptions) { 
            ouOptions.querySelectorAll('.custom-select-option').forEach(opt => opt.classList.remove('selected')); 
            const placeholder = ouOptions.querySelector('.custom-select-option[data-value=""]'); 
            if (placeholder) placeholder.classList.add('selected'); 
        } 
        
        // === PRIDANÁ ZMENA: Reset textu na úvodnej obrazovke ===
        const welcomePrompt = document.getElementById('welcome-prompt');
        if (welcomePrompt) {
            welcomePrompt.textContent = 'Prosím, začnite výberom okresného úradu v paneli vľavo.';
        }
        // === KONIEC PRIDANEJ ZMENY ===
        
        AppState.notifications = []; 
        renderNotifications(); 
        updateUIState(); 
        addNotification('Aplikácia bola resetovaná.', 'info'); 
    } // Zmenené na addNotification

    function setOkresnyUrad(ouKey) {
        const ouLabel = document.getElementById('okresny-urad-label'); 
        const ouOptions = document.getElementById('okresny-urad-options');
        if (!ouKey) { resetApp(); return; }
        const hasData = Object.keys(AppState.files).length > 0 || AppState.spis !== null; 
        if (AppState.selectedOU && AppState.selectedOU !== ouKey && hasData) { 
            if (!confirm("Zmenou okresného úradu prídete o všetky rozpracované dáta (nahraté súbory a spis). Naozaj chcete pokračovať?")) { 
                const previousOption = ouOptions.querySelector(`.custom-select-option[data-value="${AppState.selectedOU}"]`); 
                if (previousOption) { ouLabel.textContent = previousOption.textContent; ouOptions.querySelectorAll('.custom-select-option').forEach(opt => opt.classList.remove('selected')); previousOption.classList.add('selected'); } 
                return; 
            } 
            resetAgendaState(); 
        }
        const selectedOption = ouOptions.querySelector(`.custom-select-option[data-value="${ouKey}"]`); 
        if (selectedOption) { ouLabel.textContent = selectedOption.textContent; ouOptions.querySelectorAll('.custom-select-option').forEach(opt => opt.classList.remove('selected')); selectedOption.classList.add('selected'); }
        AppState.selectedOU = ouKey; AppState.okresData = OKRESNE_URADY[ouKey]; localStorage.setItem('krokr-lastOU', ouKey);
        if (!hasData) addNotification(`Vybraný OÚ: ${AppState.okresData.Okresny_urad}`, 'success'); // Zmenené na addNotification
        
        // === KĽÚČOVÁ ZMENA: Namiesto renderHelpCenterView len aktualizujeme hlavičku agendy ===
        if (AppState.currentView === 'agenda') {
             const agendaView = document.getElementById('agenda-view');
             const summarySpan = agendaView?.querySelector('.selection-summary strong');
             if (summarySpan) summarySpan.nextSibling.textContent = ` ${AppState.okresData.Okresny_urad}`;
        }
        // === KONIEC ZMENY ===

        // === PRIDANÁ ZMENA: Aktualizácia textu na úvodnej obrazovke ===
        const welcomePrompt = document.getElementById('welcome-prompt');
        if (welcomePrompt) {
            welcomePrompt.textContent = 'Prosím, začnite výberom agendy v paneli vľavo.';
        }
        // === KONIEC PRIDANEJ ZMENY ===

        updateUIState();
    }

    function showWelcomeMessage() { showView('welcome'); }

    /**
     * Zobrazí #agenda-view a pripojí naň čerstvé listenery.
     */
    function renderAgendaView(agendaKey) {
        const agendaConfig = agendaConfigs[agendaKey]; if (!agendaConfig) return;
        agendaViewListenersController.abort(); agendaViewListenersController = new AbortController();
        AppState.files = {}; AppState.municipalitiesMailContent = {}; AppState.zoznamyPreObceGenerated = false; AppState.selectedAgendaKey = agendaKey; localStorage.setItem('krokr-lastAgenda', agendaKey);
        showView('agenda'); 
        const currentAgendaView = document.getElementById('agenda-view'); 
        if (currentAgendaView) { setupAgendaViewListeners(currentAgendaView, agendaViewListenersController.signal); }
        
        // --- ZAČIATOK OPRAVY ---
        // 1. Vždy najprv vykreslíme tabulátory. Ak je AppState.spis null,
        //    vďaka oprave v renderAgendaTabs sa starý spis vymaže.
        renderAgendaTabs(agendaKey, agendaConfig);
        
        const globalSpis = localStorage.getItem(`krokr-spis`); 
        if (globalSpis) { 
            // 2. Ak spis existuje, dodatočne ho načítame a aktualizujeme UI.
            AppState.spis = globalSpis; 
            if (currentAgendaView) {
                currentAgendaView.querySelector('.spis-display span').textContent = AppState.spis;
            }
            // Aktualizujeme aj stav tlačidiel v processore
            if (AppState.processor) {
                AppState.processor.checkAllButtonsState();
            }
        } else { 
            // 3. Ak spis neexistuje, UI je už čisté, stačí zobraziť modal.
            showSpisModal(agendaKey, agendaConfig); 
        }
        // --- KONIEC OPRAVY ---
    }

    // showSpisModal (bez zmeny)
    function showSpisModal(agendaKey, agendaConfig, existingValue = '') { const isChanging = !!existingValue; const titleText = isChanging ? 'Zmeniť číslo spisu' : 'Nastaviť číslo spisu'; const subtitleText = isChanging ? 'Môžete upraviť existujúce číslo spisu.' : 'Prosím, zadajte číslo spisu pre túto reláciu.'; const buttonText = isChanging ? 'Uložiť zmeny' : 'Uložiť a pokračovať'; const title = `<div class="help-center-header"><i class="fas ${isChanging ? 'fa-edit' : 'fa-folder-open'}"></i><div class="title-group"><h3>${titleText}</h3><span>${subtitleText}</span></div></div>`; const content = `<p>Číslo spisu je povinné pre generovanie dokumentov a bude rovnaké pre všetky agendy. Bude automaticky vložené do všetkých exportov.<b style="color: #FF9800;"> Číslo spiu zadávajte BEZ OU.</b></p><div class="spis-input-group" style="margin-top: 1.5rem; max-width: none;"><input type="text" id="modal-spis-input" class="form-input" placeholder="Napr. BB-OKR-2025/123456" value="${existingValue}"><button id="modal-save-spis-btn" class="btn btn--primary"><i class="fas fa-save"></i> ${buttonText}</button></div><input type="hidden" id="modal-spis-context-key" value="${agendaKey}"><input type="hidden" id="modal-spis-context-changing" value="${isChanging ? 'true' : 'false'}"><input type="hidden" id="modal-spis-context-existing" value="${existingValue}">`; showModal({ title, content, autoFocusSelector: '#modal-spis-input' }); }

    /**
     * Vypĺňa pracovnú plochu dátami.
     */
    function renderAgendaTabs(agendaKey, agendaConfig) {
        const agendaView = document.getElementById('agenda-view'); if (!agendaView) { console.error("Kritická chyba: Element #agenda-view nebol nájdený počas renderAgendaTabs."); return; }
        agendaView.querySelector('.content-header h2').textContent = agendaConfig.title; 
        agendaView.querySelector('.selection-summary strong').nextSibling.textContent = ` ${AppState.okresData.Okresny_urad}`;
        
        // --- ZAČIATOK OPRAVY: Logika pre zobrazenie stavu spisu ---
        const spisDisplay = agendaView.querySelector('.spis-display');
        const spisSpan = spisDisplay ? spisDisplay.querySelector('span') : null;

        if (spisDisplay && spisSpan) {
            if (AppState.spis) {
                // Ak spis existuje, zobrazíme ho normálne
                spisSpan.textContent = AppState.spis;
                spisDisplay.classList.remove('spis-display--error');
            } else {
                // Ak spis neexistuje (napr. po resete), zobrazíme varovanie
                spisSpan.textContent = 'Nie je zadané číslo spisu !';
                spisDisplay.classList.add('spis-display--error');
            }
        }
        const fileInputsHTML = agendaConfig.dataInputs.map(inputConf => `<div class="file-input-wrapper"><div class="file-drop-zone" id="drop-zone-${inputConf.id}"><div class="file-drop-zone__prompt"><i class="fas fa-upload"></i><p><strong>${inputConf.label}</strong></p><span>Presuňte súbor sem alebo kliknite</span></div><div class="file-details"><div class="file-info"><i class="far fa-file-excel"></i><div><div class="file-name"></div><div class="file-size"></div></div><button class="btn-remove-file" data-input-id="${inputConf.id}">&times;</button></div></div></div><input type="file" id="${inputConf.id}" accept=".xlsx,.xls" class="file-input" data-dropzone-id="drop-zone-${inputConf.id}"></div>`).join(''); agendaView.querySelector('#file-inputs-container').innerHTML = fileInputsHTML;
        const generatorsHTML = Object.keys(agendaConfig.generators).map(genKey => { const genConf = agendaConfig.generators[genKey]; const isXlsx = genConf.outputType === 'xlsx'; const buttonText = isXlsx ? 'Exportovať (.xlsx)' : 'Generovať (.docx)'; let mailButtonHTML = ''; if (agendaKey === 'vp' && genKey === 'zoznamyObce') mailButtonHTML = `<div class="generator-group"><button id="send-mail-btn-vp" class="btn btn--primary" style="display: none; margin-top: 0.5rem;"><i class="fas fa-paper-plane"></i> Pripraviť e-maily obciam</button></div>`; return `<div class="doc-box"><h4>${genConf.title}</h4><p class="doc-box__description">${isXlsx ? 'Tento export vygeneruje súbor .xlsx.' : 'Generuje dokumenty na základe šablóny.'}</p><button id="${genConf.buttonId}" class="btn btn--accent" data-generator-key="${genKey}" disabled><i class="fas fa-cogs"></i> <span class="btn-text">${buttonText}</span></button>${mailButtonHTML}</div>`; }).join(''); agendaView.querySelector('#generators-container').innerHTML = generatorsHTML;
        agendaView.querySelector('#preview-container').innerHTML = `<div class="empty-state-placeholder"><i class="fas fa-file-import"></i><h4>Náhľad sa zobrazí po nahratí súborov</h4><p>Začnite nahratím vstupných súborov.</p></div>`;
        agendaView.querySelectorAll('.agenda-tab').forEach((tab, index) => { tab.classList.toggle('active', index === 0); if (tab.dataset.tab === 'generovanie') tab.classList.add('is-disabled'); }); agendaView.querySelectorAll('.agenda-tab-content').forEach((content, index) => { content.classList.toggle('active', index === 0); });
        initializeDocumentProcessor(agendaConfig); updateUIState();
    }
    
    // initializeDocumentProcessor (bez zmeny)
    // ODPOJILI SME PRIAME ODOVZDÁVANIE AppState DO dataMapper-ov,
    // ale ponechávame ho pre `checkAllButtonsState`
    function initializeDocumentProcessor(baseConfig) { const fullConfig = { sectionPrefix: AppState.selectedAgendaKey, appState: AppState, dataInputs: baseConfig.dataInputs, previewElementId: 'preview-container', dataProcessor: baseConfig.dataProcessor, generators: baseConfig.generators, onDataProcessed: () => { const agendaView = document.getElementById('agenda-view'); const genTab = agendaView?.querySelector('.agenda-tab[data-tab="generovanie"]'); if (genTab) { genTab.classList.remove('is-disabled'); showNotification('Dáta spracované. Karta "Generovanie" je teraz dostupná.', 'success'); } updateUIState(); }, onMailGenerationStart: () => { AppState.municipalitiesMailContent = {}; AppState.zoznamyPreObceGenerated = false; }, onMailDataGenerated: (groupKey, mailData) => { AppState.municipalitiesMailContent[groupKey] = mailData; }, onMailGenerationComplete: () => { AppState.zoznamyPreObceGenerated = true; updateUIState(); } }; AppState.processor = new DocumentProcessor(fullConfig); AppState.processor.loadTemplates(); if (AppState.selectedAgendaKey === 'vp') loadPscFile(); }
    async function loadPscFile() { try { const response = await fetch(TEMPLATE_PATHS.pscFile); if (!response.ok) throw new Error(`Súbor PSČ sa nepodarilo načítať: ${response.statusText}`); const arrayBuffer = await response.arrayBuffer(); AppState.processor.state.data.psc = arrayBuffer; AppState.processor.checkAndProcessData(); } catch (error) { showErrorModal({ message: 'Chyba pri automatickom načítaní súboru PSČ.', details: error.message }); } }
    
    // Logika pre odosielanie mailov (bez zmeny)
    const PREVIEW_THRESHOLD = 20; const PARTIAL_PREVIEW_COUNT = 10;
    function showMailListModal() { if (!AppState.zoznamyPreObceGenerated) { showNotification("Táto možnosť je dostupná až po vygenerovaní zoznamov pre obce.", "warning"); return; } const mailContent = AppState.municipalitiesMailContent; const ouEmails = MUNICIPALITY_EMAILS[AppState.selectedOU] || {}; let listHTML = '<ul style="list-style-type: none; padding: 0;">'; let hasContent = false; for (const obecName in mailContent) { hasContent = true; const recipientEmail = ouEmails[obecName]; const rowCount = mailContent[obecName].count; listHTML += `<li style="display: flex; align-items: center; justify-content: space-between; padding: 10px; border-bottom: 1px solid #eee;"><span><i class="fas fa-building" style="margin-right: 10px; color: #555;"></i>${obecName} <small>(${rowCount} záznamov)</small></span>`; if (recipientEmail) listHTML += `<button class="btn btn--primary prepare-mail-to-obec-btn" data-obec="${encodeURIComponent(obecName)}"><i class="fas fa-envelope"></i> Pripraviť e-mail</button>`; else listHTML += `<span style="color: var(--danger-color); font-size: 0.9em;"><i class="fas fa-exclamation-triangle"></i> Email nenájdený</span>`; listHTML += `</li>`; } listHTML += '</ul>'; if (!hasContent) { showModal({ title: 'Odoslanie pošty', content: '<p>Nenašli sa žiadne vygenerované dáta pre odoslanie.</p>'}); return; } showModal({ title: 'Odoslať zoznamy obciam', content: listHTML }); }
    const showEmailPreviewModal = (obecName) => { const mailContent = AppState.municipalitiesMailContent; const ouEmails = MUNICIPALITY_EMAILS[AppState.selectedOU] || {}; const emailData = mailContent[obecName]; if (!emailData) { showErrorModal({ message: 'Nenašli sa dáta pre e-mail pre zvolenú obec.'}); return; } const { html: htmlBody, count: rowCount } = emailData; const recipient = ouEmails[obecName]; const subject = `Zoznam subjektov pre obec ${obecName}`; AppState.tempMailContext = { htmlBody, recipient, subject, rowCount }; const modalTitle = `<div class="help-center-header"><i class="fas fa-envelope-open-text"></i><div class="title-group"><h3>Náhľad e-mailu</h3><span>Skontrolujte obsah a skopírujte ho do e-mailového klienta.</span></div></div>`; let previewContentHTML; if (rowCount > PREVIEW_THRESHOLD) previewContentHTML = `<div id="email-preview-content" style="border: 1px solid #e0e0e0; padding: 1rem; border-radius: 8px; background-color: #f9f9f9;"><p>Náhľad e-mailu pre obec <strong>${obecName}</strong> obsahuje veľký počet záznamov (<strong>${rowCount} riadkov</strong>).</p><p>Zobrazenie celej tabuľky by mohlo spomaliť Váš prehliadač. Tlačidlo nižšie skopírujte <strong>kompletné dáta</strong>.</p><button id="show-partial-preview-btn" class="btn btn--secondary" style="margin-top: 0.5rem;"><i class="fas fa-eye"></i> Zobraziť ukážku prvých ${PARTIAL_PREVIEW_COUNT} riadkov</button><div id="email-partial-preview" style="display: none; margin-top: 1rem; max-height: 25vh; overflow-y: auto;"></div></div>`; else previewContentHTML = `<div id="email-preview-content" style="border: 1px solid #e0e0e0; padding: 1rem; border-radius: 8px; background-color: #f9f9f9; max-height: 40vh; overflow-y: auto;">${htmlBody}</div>`; const modalContent = `<div style="font-size: 0.9em; display: flex; flex-direction: column; gap: 1rem;"><p><strong>Príjemca:</strong> ${recipient}</p><p><strong>Predmet:</strong> ${subject}</p><p><strong>Telo e-mailu:</strong></p>${previewContentHTML}<div style="background-color: var(--primary-color-light); padding: 1rem; border-radius: 8px; text-align: center;"><p style="margin-bottom: 0.75rem;">Kliknutím na tlačidlo sa <strong>celé telo e-mailu</strong> (všetkých ${rowCount} riadkov) skopíruje a otvorí sa Váš predvolený e-mailový program. Následne stačí obsah do tela e-mailu iba vložiť (Ctrl+V).</p><button id="copy-and-open-mail-btn" class="btn btn--primary"><i class="fas fa-copy"></i> Skopírovať telo a otvoriť e-mail</button></div></div>`; showModal({ title: modalTitle, content: modalContent, autoFocusSelector: '#copy-and-open-mail-btn' }); };

    // === KĽÚČOVÁ ZMENA: NOVÁ FUNKCIA PRE ZOBRAZENIE NÁPOVEDY V MODÁLE ===
    /**
     * Zobrazí Centrum nápovedy v modálnom okne.
     */
    function showHelpCenterModal() {
        // Krok 1: Pripravíme dynamické dáta
        const downloadListHTML = Object.entries(TEMPLATE_DOWNLOAD_FILES).map(([fileName, path]) => `
            <li class="download-item">
                <i class="fas fa-file-excel"></i>
                <span>${fileName}</span>
                <a href="${path}" download="${fileName}" class="btn btn--primary" style="padding: 0.4rem 1rem; margin-left: auto;">
                    <i class="fas fa-download"></i> Stiahnuť
                </a>
            </li>
        `).join('');
        const okresName = AppState.okresData ? AppState.okresData.Okresny_urad : 'Nevybraný';

        // Krok 2: Zavoláme funkciu, ktorá vráti HTML obsah *pre vnútro modálu*
        // Použijeme existujúcu getHelpCenterHTML, ale upravíme ju, aby neobsahovala hlavičku .content-header
        // (Pre jednoduchosť teraz vložíme celú, ale ideálne by sa `getHelpCenterHTML` refaktorovala)
        const modalBodyContent = getHelpCenterHTML({ 
            okresName: okresName, // Toto sa v modálnom okne nezobrazí, ale funkcia to vyžaduje
            downloadListHTML: downloadListHTML 
        }); 

        // Krok 3: Pripravíme titulok pre modálne okno
        const modalTitle = `
            <div class="help-center-header">
                <i class="fas fa-life-ring" style="color: var(--primary-color);"></i>
                <div class="title-group">
                    <h3>Centrum nápovedy</h3>
                    <span>${okresName}</span>
                </div>
            </div>`;

        // Krok 4: Zobrazíme modálne okno
        showModal({ title: modalTitle, content: modalBodyContent });

        // Krok 5: Aktivujeme listenery pre OBSAH V MODÁLNOM OKNE
        // Musíme nájsť práve zobrazené modálne okno
        const modalContainer = document.getElementById('modal-container');
        const modalBody = modalContainer.querySelector('.modal-body');
        if (modalBody) {
            setupTabListeners(modalBody);      // Pre taby v nápovede
            setupAccordionListeners(modalBody); // Pre akordeón v nápovede
        }
    }
    // === KONIEC ZMENY ===

    // === ODSTRÁNENÁ PÔVODNÁ FUNKCIA renderHelpCenterView ===
    // function renderHelpCenterView() { ... }
    // =======================================================
    
    // setupTabListeners a setupAccordionListeners (bez zmeny)
    function setupTabListeners(parentElement = document) { if (!parentElement) return; const tabs = parentElement.querySelectorAll('.agenda-tab'); const contents = parentElement.querySelectorAll('.agenda-tab-content'); if (tabs.length === 0) return; tabs.forEach(tab => { tab.addEventListener('click', () => { if (tab.classList.contains('is-disabled')) { showNotification('Táto karta bude dostupná po nahratí a spracovaní súborov.', 'warning'); return; } tabs.forEach(t => t.classList.remove('active')); contents.forEach(c => c.classList.remove('active')); tab.classList.add('active'); const contentEl = parentElement.querySelector(`#tab-${tab.dataset.tab}`); if (contentEl) contentEl.classList.add('active'); }); }); }
    function setupAccordionListeners(parentElement = document) { if (!parentElement) return; const accordionItems = parentElement.querySelectorAll(`.accordion-card`); if (accordionItems.length === 0) return; accordionItems.forEach(item => { const header = item.querySelector('.accordion-header'); header.addEventListener('click', () => { item.classList.toggle('active'); }); }); }

    /**
     * Pripája VŠETKY delegované listenery na #agendaView.
     */
    function setupAgendaViewListeners(view, signal) {
        if (!view) return;

        // --- 1. Zjednotený CLICK listener ---
        view.addEventListener('click', (e) => {
            const removeButton = e.target.closest('.btn-remove-file'); 
            if (removeButton) { /* ... (kód pre remove file) ... */ 
                 e.stopPropagation(); const inputId = removeButton.dataset.inputId; const input = document.getElementById(inputId); if (!input) return; const dropZone = document.getElementById(input.dataset.dropzoneId); delete AppState.files[inputId]; input.value = ''; if(dropZone) dropZone.classList.remove('loaded'); if (AppState.processor) { const inputConf = agendaConfigs[AppState.selectedAgendaKey]?.dataInputs.find(i => i.id === inputId); const stateKey = inputConf ? inputConf.stateKey : null; if (stateKey) delete AppState.processor.state.data[stateKey]; AppState.processor.state.processedData = null; const previewContainer = document.getElementById('preview-container'); if (previewContainer) previewContainer.innerHTML = `<div class="empty-state-placeholder"><i class="fas fa-eye-slash"></i><h4>Náhľad dát bol vymazaný</h4><p>Prosím, nahrajte vstupné súbory na zobrazenie náhľadu.</p></div>`; AppState.processor.checkAllButtonsState(); } updateUIState(); return; 
            }
            
            // === ZAČIATOK KĽÚČOVEJ ZMENY (REFAKTORING) ===
            const genButton = e.target.closest('button[data-generator-key]'); 
            if (genButton) { 
                 e.stopPropagation(); if (!AppState.processor) return; 
                 const genKey = genButton.dataset.generatorKey; 
                 const genConf = agendaConfigs[AppState.selectedAgendaKey]?.generators[genKey]; 
                 
                 // Vytvoríme čistý kontextový objekt namiesto odovzdávania celého AppState
                 const context = {
                     spis: AppState.spis,
                     okresData: AppState.okresData,
                     selectedOU: AppState.selectedOU
                 };

                 if (genConf) { 
                     switch (genConf.type) { 
                         case 'row': AppState.processor.generateRowByRow(genKey, context); break; 
                         case 'batch': AppState.processor.generateInBatches(genKey, context); break; 
                         case 'groupBy': AppState.processor.generateByGroup(genKey, context); break; 
                         default: showErrorModal({ message: `Neznámy typ generátora: ${genConf.type}` }); 
                     } 
                 } 
                 return; 
            }
            // === KONIEC KĽÚČOVEJ ZMENY (REFAKTORING) ===

            const mailButton = e.target.closest('#send-mail-btn-vp'); 
            if (mailButton) { /* ... (kód pre mail button) ... */ 
                 e.stopPropagation(); showMailListModal(); return; 
            }
            const spisDisplay = e.target.closest('.spis-display--editable'); 
            if (spisDisplay) { /* ... (kód pre edit spis) ... */ 
                 e.stopPropagation(); 
                 const agendaKey = AppState.selectedAgendaKey; 
                 if (!agendaKey) return; 
                 const agendaConfig = agendaConfigs[agendaKey]; 
                 
                 // --- ZAČIATOK OPRAVY ---
                 // Ak je AppState.spis null (po resete), použijeme prázdny reťazec
                 const currentValue = AppState.spis || ''; 
                 // --- KONIEC OPRAVY ---
                 
                 showSpisModal(agendaKey, agendaConfig, currentValue); 
                 return; 
            }
        }, { signal }); 

        
        // --- 2. Listenery pre nahrávanie súborov ---
        const getFileConfig = (target) => { const agendaConfig = agendaConfigs[AppState.selectedAgendaKey]; if (!agendaConfig) return null; const inputWrapper = target.closest('.file-input-wrapper'); if (!inputWrapper) return null; const input = inputWrapper.querySelector('.file-input'); if (!input) return null; const inputId = input.id; const dropZone = document.getElementById(input.dataset.dropzoneId); const fileNameEl = dropZone?.querySelector('.file-name'); const fileSizeEl = dropZone?.querySelector('.file-size'); const inputConf = agendaConfig.dataInputs.find(conf => conf.id === inputId); const stateKey = inputConf ? inputConf.stateKey : null; return { input, inputId, dropZone, fileNameEl, fileSizeEl, stateKey }; };
        const handleFile = (file, config) => { if (!file || !config || !config.stateKey) return; const { input, inputId, dropZone, fileNameEl, fileSizeEl, stateKey } = config; AppState.files[inputId] = file; if(dropZone) dropZone.classList.add('loaded'); if(fileNameEl) fileNameEl.textContent = file.name; if(fileSizeEl) fileSizeEl.textContent = formatBytes(file.size); if (AppState.processor) AppState.processor.processFile(file, stateKey); };

        view.addEventListener('change', (e) => { const input = e.target.closest('.file-input'); if (!input) return; const config = getFileConfig(input); if (config && e.target.files.length > 0) handleFile(e.target.files[0], config); }, { signal }); 
        view.addEventListener('dragover', (e) => { e.preventDefault(); const dropZone = e.target.closest('.file-drop-zone'); if (dropZone) dropZone.classList.add('active'); }, { signal }); 
        view.addEventListener('dragleave', (e) => { const dropZone = e.target.closest('.file-drop-zone'); if (dropZone) dropZone.classList.remove('active'); }, { signal }); 
        view.addEventListener('drop', (e) => { e.preventDefault(); const dropZone = e.target.closest('.file-drop-zone'); if (!dropZone) return; dropZone.classList.remove('active'); const config = getFileConfig(dropZone); if (config && e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0], config); }, { signal }); 
    }
    
    // Inicializácia z localStorage (bez zmeny)
    function initializeFromLocalStorage() { const lastOU = localStorage.getItem('krokr-lastOU'); if (lastOU) { setOkresnyUrad(lastOU); const lastAgenda = localStorage.getItem('krokr-lastAgenda'); if (lastAgenda) setTimeout(() => { renderAgendaView(lastAgenda); }, 100); } }
});

// populateOkresnyUradSelect (bez zmeny)
function populateOkresnyUradSelect(ouData) { const optionsContainer = document.getElementById('okresny-urad-options'); if (!optionsContainer) return; optionsContainer.innerHTML = ''; const placeholderOption = document.createElement('div'); placeholderOption.className = 'custom-select-option selected'; placeholderOption.textContent = ''; placeholderOption.dataset.value = ''; optionsContainer.appendChild(placeholderOption); Object.keys(ouData).forEach(key => { const option = document.createElement('div'); option.className = 'custom-select-option'; option.textContent = ouData[key].Okresny_urad; option.dataset.value = key; optionsContainer.appendChild(option); }); }