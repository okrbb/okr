// js/main-wizard.js
// ===== ZMENA IMPORTU: Odstránené OKRESNE_URADY =====
import { TEMPLATE_PATHS, TEMPLATE_DOWNLOAD_FILES } from './config.js';
import { showNotification, showErrorModal, showModal, formatBytes } from './ui.js';
import { agendaConfigs } from './agendaConfigFactory.js';
import { DocumentProcessor } from './DocumentProcessor.js';
import { startGuidedTour } from './tour.js';
// ===== ZMENA IMPORTU: Odstránené MUNICIPALITY_EMAILS =====
// import { MUNICIPALITY_EMAILS } from './mail-config.js'; 
// ===== ZMENA IMPORTU =====
import { getHelpCenterHTML } from './helpContent.js';
// =========================

// Globálny stav aplikácie
const AppState = {
    selectedOU: null,
    okresData: null,
    spis: null, // ZMENA: Z {} na null. Jeden spis pre celú aplikáciu.
    selectedAgendaKey: null,
    processor: null,
    files: {}, // Ukladá nahraté súbory per agenda
    notifications: [],
    municipalitiesMailContent: {}, // Ukladá pripravené maily
    zoznamyPreObceGenerated: false,
    currentView: 'welcome', // 'welcome', 'agenda', 'help'
    
    // === OPRAVA: Presunuté z predošlej opravy ===
    tempMailContext: {} 
};

// ===== NOVÁ FUNKCIA: Načítanie statických JSON dát =====
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
        // Zobrazíme chybu cez UI funkciu, ak je už dostupná
        if (typeof showErrorModal === 'function') {
            showErrorModal({ 
                title: 'Kritická chyba aplikácie', 
                message: 'Nepodarilo sa načítať základné konfiguračné súbory (dáta OÚ alebo e-maily obcí). Aplikácia nemôže pokračovať. Skúste obnoviť stránku (F5).',
                details: error.message
            });
        } else {
            // Fallback, ak sa skript preruší skôr
            alert(`Kritická chyba: Nepodarilo sa načítať dáta. ${error.message}`);
        }
        return null;
    }
}
// =======================================================


// ===== ZMENA: Celý DOMContentLoaded je teraz 'async' =====
document.addEventListener('DOMContentLoaded', async () => {
    
    // Zobrazíme spinner hneď na začiatku
    const spinner = document.getElementById('spinner-overlay');
    if (spinner) spinner.style.display = 'flex';

    // === INICIALIZÁCIA DÁT ===
    const staticData = await loadStaticData();
    if (!staticData) {
         if (spinner) spinner.style.display = 'none'; // Skry spinner ak nastala chyba
         return; // Zastavíme vykonávanie
    }
    
    // Uložíme načítané dáta do lokálnych konštánt, ktoré bude zvyšok skriptu používať
    const OKRESNE_URADY = staticData.ouData;
    const MUNICIPALITY_EMAILS = staticData.emailData;
    // ==========================

    // === DOM ELEMENTY ===
    // === ZMENA: Odstránený ouSelect, nahradený komponentmi pre vlastný select ===
    // const ouSelect = document.getElementById('okresny-urad');
    const agendaNav = document.getElementById('agenda-navigation');
    const agendaLinks = agendaNav.querySelectorAll('.nav-link');
    const dashboardContent = document.getElementById('dashboard-content');
    
    // === NOVÉ DOM ELEMENTY PRE ZOBRAZENIA ===
    const welcomeView = document.getElementById('welcome-view');
    const agendaView = document.getElementById('agenda-view');
    const helpView = document.getElementById('help-view');
    // ========================================
    
    const resetAppBtn = document.getElementById('reset-app-btn');
    const helpCenterBtn = document.getElementById('show-help-center');
    const resetTourBtn = document.getElementById('reset-tour-btn');

    const notificationBellBtn = document.getElementById('notification-bell-btn');
    const notificationPanel = document.getElementById('notification-center-panel');
    const notificationList = document.getElementById('notification-list');
    const notificationBadge = document.querySelector('.notification-badge');
    const clearNotificationsBtn = document.getElementById('clear-notifications-btn');

    // === INICIALIZÁCIA ===
    populateOkresnyUradSelect(OKRESNE_URADY); 
    initializeFromLocalStorage();
    startGuidedTour();
    updateUIState(); // Zabezpečí správny počiatočný stav

    // === PRIPOJENIE STATICKÝCH LISTENEROV (Iba raz) ===
    setupStaticListeners();
    // ==================================================

    // Skryjeme spinner po inicializácii
    if (spinner) spinner.style.display = 'none';

    
    /**
     * === NOVÁ FUNKCIA: Pripája listenery, ktoré sa nemenia ===
     */
    function setupStaticListeners() {
        // Notifikácie
        notificationBellBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notificationPanel.classList.toggle('show');
        });
        clearNotificationsBtn.addEventListener('click', () => {
            AppState.notifications = [];
            renderNotifications();
            showNotification('História notifikácií bola vymazaná.', 'info');
        });
        document.addEventListener('add-notification', (e) => {
            const { message, type } = e.detail;
            addNotification(message, type);
        });
        document.addEventListener('click', (e) => {
            if (!notificationPanel.contains(e.target) && notificationPanel.classList.contains('show')) {
                notificationPanel.classList.remove('show');
            }
        });

        // === ZMENA: Úprava listenerov pre vlastný select ===
        const ouSelectWrapper = document.getElementById('ou-select-wrapper');
        const ouTrigger = document.getElementById('okresny-urad-trigger');
        const ouOptions = document.getElementById('okresny-urad-options');
        const ouLabel = document.getElementById('okresny-urad-label');

        if (ouTrigger && ouOptions && ouSelectWrapper && ouLabel) {
            // 1. Otvorenie/zatvorenie zoznamu
            ouTrigger.addEventListener('click', (e) => {
                e.stopPropagation(); // Zastaví propagáciu, aby sa hneď nezavrel
                const isOpen = ouOptions.classList.toggle('active');
                ouSelectWrapper.classList.toggle('is-open', isOpen);
                ouTrigger.setAttribute('aria-expanded', isOpen);
            });
            
            // 2. Výber možnosti
            ouOptions.addEventListener('click', (e) => {
                const targetOption = e.target.closest('.custom-select-option');
                if (!targetOption) return;
                
                const selectedValue = targetOption.dataset.value;
                const selectedText = targetOption.textContent;

                // Aktualizácia UI
                ouLabel.textContent = selectedText;
                ouOptions.classList.remove('active');
                ouSelectWrapper.classList.remove('is-open');
                ouTrigger.setAttribute('aria-expanded', 'false');
                
                // Aktualizácia .selected triedy
                ouOptions.querySelectorAll('.custom-select-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                targetOption.classList.add('selected');

                // Volanie existujúcej logiky, len ak sa hodnota zmenila
                if (AppState.selectedOU !== selectedValue) {
                    setOkresnyUrad(selectedValue);
                }
            });
        }
        
        // 3. Zatvorenie pri kliknutí mimo
        document.addEventListener('click', (e) => {
            if (ouOptions && !ouSelectWrapper.contains(e.target)) {
                ouOptions.classList.remove('active');
                ouSelectWrapper.classList.remove('is-open');
                if(ouTrigger) ouTrigger.setAttribute('aria-expanded', 'false');
            }
        });
        // === KONIEC ZMENY ===

        // Hlavná navigácia a ovládacie prvky
        /* === ODSTRÁNENÉ: Pôvodný listener pre ouSelect ===
        ouSelect.addEventListener('change', (e) => {
            setOkresnyUrad(e.target.value);
        });
        */
        agendaLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                if (link.classList.contains('disabled')) {
                    showNotification("Najprv prosím vyberte okresný úrad.", "warning");
                    return;
                }
                if (link.classList.contains('active') && AppState.currentView !== 'help') {
                    return;
                }
                
                // === PRIDANÝ SCROLL TOP (Požiadavka používateľa) ===
                if (dashboardContent) {
                    dashboardContent.scrollTo({ top: 0, behavior: 'smooth' });
                }
                // === KONIEC PRIDANIA ===
                
                const agendaKey = link.dataset.agenda;
                renderAgendaView(agendaKey);
            });
        });
        resetAppBtn.addEventListener('click', () => {
            if (confirm("Naozaj chcete resetovať aplikáciu? Stratíte všetky neuložené dáta a výbery.")) {
                resetApp();
            }
        });
        helpCenterBtn.addEventListener('click', () => {
            // === PRIDANÝ SCROLL TOP (Požiadavka používateľa) ===
            if (dashboardContent) {
                dashboardContent.scrollTo({ top: 0, behavior: 'smooth' });
            }
            // === KONIEC PRIDANIA ===
            
            AppState.selectedAgendaKey = null; 
            updateUIState();
            renderHelpCenterView();
        });
        resetTourBtn.addEventListener('click', () => {
            localStorage.removeItem('krokr-tour-completed');
            startGuidedTour();
        });

        // Listenery pre modálne okná
        const modalContainer = document.getElementById('modal-container');

        // Delegovaný listener pre mailové tlačidlo
        modalContainer.addEventListener('click', (e) => {
            const target = e.target.closest('.prepare-mail-to-obec-btn');
            if (!target) return;
            const obecName = decodeURIComponent(target.dataset.obec);
            showEmailPreviewModal(obecName);
        });
        
        // === NOVÉ: Delegovaný listener pre Spis modal (Save Button) ===
        modalContainer.addEventListener('click', (e) => {
            const target = e.target.closest('#modal-save-spis-btn');
            if (!target) return;

            // Tlačidlo bolo kliknuté, nájdeme kontext
            const modalInput = modalContainer.querySelector('#modal-spis-input');
            const contextKeyEl = modalContainer.querySelector('#modal-spis-context-key');
            const contextChangingEl = modalContainer.querySelector('#modal-spis-context-changing');
            const contextExistingEl = modalContainer.querySelector('#modal-spis-context-existing');

            if (!modalInput || !contextKeyEl || !contextChangingEl || !contextExistingEl) {
                console.error("Spis modal save failed: Could not find context elements.");
                return;
            }

            const agendaKey = contextKeyEl.value;
            const isChanging = contextChangingEl.value === 'true';
            const existingValue = contextExistingEl.value;
            
            // Logika, ktorá bola predtým v 'saveSpisAndProceed'
            const spisValue = modalInput.value.trim();
            if (spisValue) {
                if (isChanging && spisValue === existingValue) {
                    // Nebola vykonaná žiadna zmena
                    document.querySelector('.modal-overlay .modal-close-btn')?.click();
                    return;
                }

                AppState.spis = spisValue;
                localStorage.setItem(`krokr-spis`, spisValue);
                document.querySelector('.modal-overlay .modal-close-btn')?.click();

                if (isChanging) {
                    const spisDisplaySpan = agendaView.querySelector('.spis-display span');
                    if (spisDisplaySpan) spisDisplaySpan.textContent = spisValue;
                    showNotification(`Číslo spisu bolo zmenené na ${spisValue}.`, 'success');
                } else {
                    showNotification(`Číslo spisu ${spisValue} bolo uložené.`, 'success');
                    // Musíme načítať zvyšok agendy
                    const agendaConfig = agendaConfigs[agendaKey];
                    if (agendaConfig) {
                        renderAgendaTabs(agendaKey, agendaConfig);
                    }
                }
            } else {
                showNotification("Prosím, zadajte platné číslo spisu.", "warning");
            }
        });

        // === NOVÉ: Delegovaný listener pre Spis modal (Enter key) ===
        modalContainer.addEventListener('keyup', (e) => {
            if (e.key !== 'Enter') return;
            
            // Overíme, či sme v správnom inpute
            const target = e.target.closest('#modal-spis-input');
            if (!target) return;

            // Ak stlačil Enter, simulujeme kliknutie na Save
            const saveButton = modalContainer.querySelector('#modal-save-spis-btn');
            if (saveButton) {
                saveButton.click();
            }
        });
        // === KONIEC ZMIEN V MODAL LISTENEROCH ===

        // === Presunutý listener z predošlej opravy ===
        modalContainer.addEventListener('click', async (e) => {
            const target = e.target.closest('#copy-and-open-mail-btn');
            if (!target) return;

            // Získame kontext uložený v AppState
            const { htmlBody, recipient, subject, rowCount } = AppState.tempMailContext;
            
            if (!htmlBody) {
                showErrorModal({ message: 'Chyba: Nenašiel sa kontext e-mailu.' });
                return;
            }

            try {
                const blob = new Blob([htmlBody], { type: 'text/html' });
                const clipboardItem = new ClipboardItem({ 'text/html': blob });
                await navigator.clipboard.write([clipboardItem]);
                
                showNotification(`Telo e-mailu (${rowCount} riadkov) bolo skopírované!`, 'success');
                
                const mailtoLink = `mailto:${recipient}?subject=${encodeURIComponent(subject)}`;
                window.location.href = mailtoLink;

            } catch (err) {
                showErrorModal({
                    message: 'Nepodarilo sa automaticky skopírovať obsah.',
                    details: 'Prosím, označte text v náhľade manuálne (Ctrl+A, Ctrl+C) a pokračujte. Chyba: ' + err.message
                });
            }
        });

        // === Presunutý listener z predošlej opravy ===
        modalContainer.addEventListener('click', (e) => {
            const target = e.target.closest('#show-partial-preview-btn');
            if (!target) return;

            const { htmlBody } = AppState.tempMailContext;
            const partialPreviewContainer = modalContainer.querySelector('#email-partial-preview');

            if (!htmlBody || !partialPreviewContainer) return;

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlBody;
            
            const table = tempDiv.querySelector('table');
            if (table) {
                const rows = Array.from(table.querySelectorAll('tbody > tr'));
                // PREVIEW_THRESHOLD a PARTIAL_PREVIEW_COUNT sú definované vyššie
                const previewRows = rows.slice(0, 10); // 10 je PARTIAL_PREVIEW_COUNT
                
                const newTbody = document.createElement('tbody');
                previewRows.forEach(row => newTbody.appendChild(row.cloneNode(true)));
                
                table.querySelector('tbody').replaceWith(newTbody);
                
                partialPreviewContainer.innerHTML = tempDiv.innerHTML;
                partialPreviewContainer.style.display = 'block';
                target.style.display = 'none'; // Skryjeme tlačidlo
            }
        });

        // Listenery pre statické prvky #agenda-view
        setupTabListeners(agendaView); // Pripája taby pre hlavnú agendu
        
        // === ZAČIATOK KĽÚČOVEJ OPRAVY ===
        // Zjednotený click handler pre #agenda-view
        if (agendaView) {
            agendaView.addEventListener('click', (e) => {
                // 1. Logika pre "Remove File" (presunuté zo setupFileInputListeners)
                const removeButton = e.target.closest('.btn-remove-file');
                if (removeButton) {
                    e.stopPropagation(); // Zabráni ďalšiemu spracovaniu
                    
                    const inputId = removeButton.dataset.inputId;
                    const input = document.getElementById(inputId);
                    if (!input) return;

                    const dropZone = document.getElementById(input.dataset.dropzoneId);
                    
                    delete AppState.files[inputId];
                    input.value = '';
                    dropZone.classList.remove('loaded');
                    
                    if (AppState.processor) {
                        const inputConf = agendaConfigs[AppState.selectedAgendaKey]?.dataInputs.find(i => i.id === inputId);
                        const stateKey = inputConf ? inputConf.stateKey : null;
                        if (stateKey) delete AppState.processor.state.data[stateKey];
                        
                        AppState.processor.state.processedData = null;
                        
                        const previewContainer = agendaView.querySelector('#preview-container');
                        if (previewContainer) {
                            previewContainer.innerHTML = `
                                <div class="empty-state-placeholder">
                                    <i class="fas fa-eye-slash"></i>
                                    <h4>Náhľad dát bol vymazaný</h4>
                                    <p>Prosím, nahrajte vstupné súbory na zobrazenie náhľadu.</p>
                                </div>
                            `;
                        }
                        
                        AppState.processor.checkAllButtonsState();
                    }
                    updateUIState();
                    return; // Končíme spracovanie kliku
                }

                // 2. Logika pre Generátory (presunuté zo setupGeneratorButtonListeners)
                const genButton = e.target.closest('button[data-generator-key]');
                if (genButton) {
                    e.stopPropagation();
                    if (!AppState.processor) return;
                    
                    const genKey = genButton.dataset.generatorKey;
                    const genConf = agendaConfigs[AppState.selectedAgendaKey]?.generators[genKey];
                    
                    if (genConf) {
                        switch (genConf.type) {
                            case 'row': AppState.processor.generateRowByRow(genKey); break;
                            case 'batch': AppState.processor.generateInBatches(genKey); break;
                            case 'groupBy': AppState.processor.generateByGroup(genKey); break;
                            default: showErrorModal({ message: `Neznámy typ generátora: ${genConf.type}` });
                        }
                    }
                    return;
                }

                // 3. Logika pre Mail Tlačidlo (presunuté zo setupGeneratorButtonListeners)
                const mailButton = e.target.closest('#send-mail-btn-vp');
                if (mailButton) {
                    e.stopPropagation();
                    showMailListModal();
                    return;
                }

                // 4. Logika pre Edit Spis (presunuté zo setupSpisEditListener)
                const spisDisplay = e.target.closest('.spis-display--editable');
                if (spisDisplay) {
                    e.stopPropagation();
                    const agendaKey = AppState.selectedAgendaKey;
                    if (!agendaKey) return;
                    
                    const agendaConfig = agendaConfigs[agendaKey];
                    const currentValue = AppState.spis; 
                    
                    showSpisModal(agendaKey, agendaConfig, currentValue);
                    return;
                }
            });
        }
        
        // Funkcie setupSpisEditListener() a setupGeneratorButtonListeners() už nie sú potrebné
        // setupSpisEditListener();
        // setupGeneratorButtonListeners();
        
        // setupFileInputListeners teraz pripája iba 'change' a drag/drop listenery
        setupFileInputListeners();
        // === KONIEC KĽÚČOVEJ OPRAVY ===
    }

    // ======================================================
    // === LOGIKA PRE CENTRUM NOTIFIKÁCIÍ (Bezo zmeny) =====
    // ======================================================
    
    function renderNotifications() {
        if (!notificationList) return;
        if (AppState.notifications.length === 0) {
            notificationList.innerHTML = '<li class="empty-state">Zatiaľ žiadne nové notifikácie.</li>';
        } else {
            notificationList.innerHTML = AppState.notifications.slice(0, 50).map(n => `
                <li class="notification-item ${n.type}">
                    <i class="fas ${getIconForType(n.type)} icon"></i>
                    <div class="content">
                        <p>${n.message}</p>
                        <div class="meta">${new Date(n.timestamp).toLocaleTimeString()}</div>
                    </div>
                </li>
            `).join('');
        }
        const unreadCount = AppState.notifications.length;
        notificationBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        notificationBadge.style.display = unreadCount > 0 ? 'block' : 'none';
    }

    function addNotification(message, type = 'info') {
        const newNotification = { id: Date.now(), message, type, timestamp: new Date() };
        AppState.notifications.unshift(newNotification);
        renderNotifications();
    }

    function getIconForType(type) {
        const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
        return icons[type] || 'fa-info-circle';
    }
    
    // ... (Listenery presunuté do setupStaticListeners) ...

    // ===================================
    // RIADENIE STAVU UI (Bezo zmeny)
    // ===================================

    function updateUIState() {
        const ouSelected = !!AppState.selectedOU;

        // 1. Ovládanie navigácie agend
        agendaLinks.forEach(link => {
            link.classList.toggle('disabled', !ouSelected);
            // ZMENA: Kontroluje AppState.currentView
            link.classList.toggle('active', link.dataset.agenda === AppState.selectedAgendaKey && AppState.currentView === 'agenda');
        });

        // 2. Ovládanie generátorov (ak existujú)
        // Toto sa teraz spolieha na DocumentProcessor.checkAllButtonsState(),
        // ktoré sa volá pri spracovaní dát.
        if (AppState.processor) {
            AppState.processor.checkAllButtonsState();
        }
        
        // 3. Ovládanie karty "Generovanie" (ak existuje)
        // ZMENA: Hľadáme v kontexte agendaView
        const genTab = agendaView.querySelector('.agenda-tab[data-tab="generovanie"]');
        if (genTab) {
            const filesReady = AppState.selectedAgendaKey && agendaConfigs[AppState.selectedAgendaKey].dataInputs
                                .every(input => AppState.files[input.id]);
            genTab.classList.toggle('is-disabled', !filesReady);
        }

        // 4. Špeciálne ovládanie pre tlačidlo Mail
        // ZMENA: Hľadáme v kontexte agendaView
        const mailBtnVp = agendaView.querySelector('#send-mail-btn-vp');
        if (mailBtnVp) {
            const showMailBtn = AppState.zoznamyPreObceGenerated && AppState.selectedAgendaKey === 'vp';
            mailBtnVp.style.display = showMailBtn ? 'block' : 'none';
        }
    }

    // ===================================
    // === NOVÁ FUNKCIA: Prepínanie zobrazení ===
    // ===================================
    
    /**
     * Prepne aktívne zobrazenie v <main> kontajneri.
     * @param {'welcome' | 'agenda' | 'help'} viewName - Názov zobrazenia.
     */
    function showView(viewName) {
        AppState.currentView = viewName;
        
        welcomeView.classList.remove('active');
        agendaView.classList.remove('active');
        helpView.classList.remove('active');
        
        switch (viewName) {
            case 'welcome':
                welcomeView.classList.add('active');
                break;
            case 'agenda':
                agendaView.classList.add('active');
                break;
            case 'help':
                helpView.classList.add('active');
                break;
        }
        
        // Aktualizujeme aj bočnú navigáciu
        updateUIState();
    }
    
    // =============================
    // HLAVNÁ LOGIKA A FUNKCIE (Upravené)
    // =============================

    function resetAgendaState() {
        localStorage.removeItem('krokr-spis');
        Object.assign(AppState, {
            spis: null,
            selectedAgendaKey: null,
            processor: null,
            files: {},
            municipalitiesMailContent: {},
            zoznamyPreObceGenerated: false,
        });
        
        // ZMENA: Už nemažeme innerHTML, iba prepneme zobrazenie
        showWelcomeMessage();
    }

    function resetApp() {
        localStorage.removeItem('krokr-lastOU');
        localStorage.removeItem('krokr-lastAgenda');
        resetAgendaState(); 

        AppState.selectedOU = null;
        AppState.okresData = null;
        
        // === ZMENA: Reset vlastného selectu ===
        const ouLabel = document.getElementById('okresny-urad-label');
        const ouOptions = document.getElementById('okresny-urad-options');
        if (ouLabel) {
            ouLabel.textContent = '';
        }
        if (ouOptions) {
            ouOptions.querySelectorAll('.custom-select-option').forEach(opt => opt.classList.remove('selected'));
            const placeholder = ouOptions.querySelector('.custom-select-option[data-value=""]');
            if (placeholder) placeholder.classList.add('selected');
        }
        // === KONIEC ZMENY ===
        
        AppState.notifications = [];
        renderNotifications();
        
        updateUIState();
        showNotification('Aplikácia bola resetovaná.', 'info');
    }

    function setOkresnyUrad(ouKey) {
        // === PRIDANÉ: Definície pre vlastný select ===
        const ouLabel = document.getElementById('okresny-urad-label');
        const ouOptions = document.getElementById('okresny-urad-options');
        // === KONIEC PRIDANIA ===
        
        if (!ouKey) {
            resetApp();
            return;
        }

        const hasData = Object.keys(AppState.files).length > 0 || AppState.spis !== null;
        if (AppState.selectedOU && AppState.selectedOU !== ouKey && hasData) {
            if (!confirm("Zmenou okresného úradu prídete o všetky rozpracované dáta (nahraté súbory a spis). Naozaj chcete pokračovať?")) {
                
                // === ZMENA: Vráti výber na pôvodný OÚ ===
                const previousOption = ouOptions.querySelector(`.custom-select-option[data-value="${AppState.selectedOU}"]`);
                if (previousOption) {
                    ouLabel.textContent = previousOption.textContent;
                    ouOptions.querySelectorAll('.custom-select-option').forEach(opt => opt.classList.remove('selected'));
                    previousOption.classList.add('selected');
                }
                // === KONIEC ZMENY ===
                
                return;
            }
            resetAgendaState();
        }

        // === ZMENA: Aktualizácia UI (label a .selected triedy) ===
        const selectedOption = ouOptions.querySelector(`.custom-select-option[data-value="${ouKey}"]`);
        if (selectedOption) {
            ouLabel.textContent = selectedOption.textContent;
            ouOptions.querySelectorAll('.custom-select-option').forEach(opt => opt.classList.remove('selected'));
            selectedOption.classList.add('selected');
        }
        // === KONIEC ZMENY ===

        AppState.selectedOU = ouKey;
        AppState.okresData = OKRESNE_URADY[ouKey];
        localStorage.setItem('krokr-lastOU', ouKey);
        
        if (!hasData) {
            showNotification(`Vybraný OÚ: ${AppState.okresData.Okresny_urad}`, 'success');
        }

        // ZMENA: Ak sme boli v nápovede, prekreslíme ju (alebo ak sme v agende, prekreslíme hlavičku)
        if (AppState.currentView === 'help') {
            renderHelpCenterView();
        } else if (AppState.currentView === 'agenda') {
            // Aktualizujeme hlavičku agendy, ak je zobrazená
            agendaView.querySelector('.selection-summary strong').nextSibling.textContent = ` ${AppState.okresData.Okresny_urad}`;
        }

        updateUIState();
    }

    /**
     * ZMENA: Už iba prepne zobrazenie
     */
    function showWelcomeMessage() {
        showView('welcome');
    }

    /**
     * Krok 1: Kontrola spisu. Buď zobrazí modal, alebo načíta zo session.
     */
    function renderAgendaView(agendaKey) {
        const agendaConfig = agendaConfigs[agendaKey];
        if (!agendaConfig) return;

        AppState.files = {};
        AppState.municipalitiesMailContent = {};
        AppState.zoznamyPreObceGenerated = false;
        AppState.selectedAgendaKey = agendaKey;
        localStorage.setItem('krokr-lastAgenda', agendaKey);
        
        // ZMENA: Prepne zobrazenie (updateUIState sa volá vnútri showView)
        showView('agenda'); 

        const globalSpis = localStorage.getItem(`krokr-spis`);
        
        if (globalSpis) {
            AppState.spis = globalSpis;
            // ZMENA: renderAgendaTabs už nerenderuje shell, iba vypĺňa dáta
            renderAgendaTabs(agendaKey, agendaConfig);
        } else {
            showSpisModal(agendaKey, agendaConfig);
        }
    }

    /**
     * Krok 2 (Alternatíva A): Zobrazí modal na zadanie/zmenu spisu.
     * === ZMENENÁ FUNKCIA ===
     */
    function showSpisModal(agendaKey, agendaConfig, existingValue = '') {
        const isChanging = !!existingValue;
        
        const titleText = isChanging ? 'Zmeniť číslo spisu' : 'Nastaviť číslo spisu'; // ZMENA
        const subtitleText = isChanging ? 'Môžete upraviť existujúce číslo spisu.' : 'Prosím, zadajte číslo spisu pre túto reláciu.';
        const buttonText = isChanging ? 'Uložiť zmeny' : 'Uložiť a pokračovať';

        const title = `
            <div class="help-center-header">
                <i class="fas ${isChanging ? 'fa-edit' : 'fa-folder-open'}"></i>
                <div class="title-group">
                    <h3>${titleText}</h3>
                    <span>${subtitleText}</span>
                </div>
            </div>`;
        
        const content = `
            <p>Číslo spisu je povinné pre generovanie dokumentov a bude rovnaké pre všetky agendy. Bude automaticky vložené do všetkých exportov.<b style="color: #FF9800;"> Číslo spiu zadávajte BEZ OU.</b></p>
            <div class="spis-input-group" style="margin-top: 1.5rem; max-width: none;">
                <input type="text" id="modal-spis-input" class="form-input" placeholder="Napr. BB-OKR-2025/123456" value="${existingValue}">
                <button id="modal-save-spis-btn" class="btn btn--primary"><i class="fas fa-save"></i> ${buttonText}</button>
            </div>
            
            <input type="hidden" id="modal-spis-context-key" value="${agendaKey}">
            <input type="hidden" id="modal-spis-context-changing" value="${isChanging ? 'true' : 'false'}">
            <input type="hidden" id="modal-spis-context-existing" value="${existingValue}">
        `;
        
        // === ZMENA: Posielame autoFocusSelector do showModal ===
        showModal({ title, content, autoFocusSelector: '#modal-spis-input' });
        // === KONIEC ZMENY ===

        // === ODSTRÁNENÉ VŠETKY getElementById a addEventListener ===
        // Logika bola presunutá do setupStaticListeners (delegácia)
        // a do ui.js (auto-focus)
    }


    /**
     * Krok 3: Vypĺňa *existujúcu* pracovnú plochu dátami.
     */
    function renderAgendaTabs(agendaKey, agendaConfig) {
        
        // 1. Aktualizácia hlavičky (už je vo view)
        agendaView.querySelector('.content-header h2').textContent = agendaConfig.title;
        agendaView.querySelector('.selection-summary strong').nextSibling.textContent = ` ${AppState.okresData.Okresny_urad}`;
        agendaView.querySelector('.spis-display span').textContent = AppState.spis;

        // 2. Generovanie a vloženie dynamického obsahu (Vstupné súbory)
        const fileInputsHTML = agendaConfig.dataInputs.map(inputConf => `
            <div class="file-input-wrapper">
                <div class="file-drop-zone" id="drop-zone-${inputConf.id}">
                    <div class="file-drop-zone__prompt">
                        <i class="fas fa-upload"></i>
                        <p><strong>${inputConf.label}</strong></p>
                        <span>Presuňte súbor sem alebo kliknite</span>
                    </div>
                    <div class="file-details">
                        <div class="file-info">
                            <i class="far fa-file-excel"></i>
                            <div>
                                <div class="file-name"></div>
                                <div class="file-size"></div>
                            </div>
                            <button class="btn-remove-file" data-input-id="${inputConf.id}">&times;</button>
                        </div>
                    </div>
                </div>
                <input type="file" id="${inputConf.id}" accept=".xlsx,.xls" class="file-input" data-dropzone-id="drop-zone-${inputConf.id}">
            </div>
        `).join('');
        agendaView.querySelector('#file-inputs-container').innerHTML = fileInputsHTML;

        // 3. Generovanie a vloženie dynamického obsahu (Generátory)
        const generatorsHTML = Object.keys(agendaConfig.generators).map(genKey => {
            const genConf = agendaConfig.generators[genKey];
            const isXlsx = genConf.outputType === 'xlsx';
            const buttonText = isXlsx ? 'Exportovať (.xlsx)' : 'Generovať (.docx)';
            
            let mailButtonHTML = '';
            // ŠPECIÁLNA LOGIKA PRE VP MAIL
            if (agendaKey === 'vp' && genKey === 'zoznamyObce') {
                mailButtonHTML = `
                    <div class="generator-group">
                        <button id="send-mail-btn-vp" class="btn btn--primary" style="display: none; margin-top: 0.5rem;">
                            <i class="fas fa-paper-plane"></i> Pripraviť e-maily obciam
                        </button>
                    </div>
                `;
            }

            // --- KĽÚČOVÁ ZMENA: Odstránenie progress bar elementu ---
            return `
                <div class="doc-box">
                    <h4>${genConf.title}</h4>
                    <p class="doc-box__description">${isXlsx ? 'Tento export vygeneruje súbor .xlsx.' : 'Generuje dokumenty na základe šablóny.'}</p>
                    <button id="${genConf.buttonId}" class="btn btn--accent" data-generator-key="${genKey}" disabled>
                        <i class="fas fa-cogs"></i> <span class="btn-text">${buttonText}</span>
                    </button>
                    ${mailButtonHTML}
                </div>`;
            // --- KONIEC KĽÚČOVEJ ZMENY ---
        }).join('');
        agendaView.querySelector('#generators-container').innerHTML = generatorsHTML;

        // 4. Reset náhľadu
        agendaView.querySelector('#preview-container').innerHTML = `
            <div class="empty-state-placeholder">
                <i class="fas fa-file-import"></i>
                <h4>Náhľad sa zobrazí po nahratí súborov</h4>
                <p>Začnite nahratím vstupných súborov.</p>
            </div>
        `;
        
        // 5. Reset stavu tabov
        agendaView.querySelectorAll('.agenda-tab').forEach((tab, index) => {
            tab.classList.toggle('active', index === 0);
            if (tab.dataset.tab === 'generovanie') tab.classList.add('is-disabled');
        });
        agendaView.querySelectorAll('.agenda-tab-content').forEach((content, index) => {
            content.classList.toggle('active', index === 0);
        });
        
        // 6. Pripojenie listenerov pre DYNAMICKÝ obsah
        // === ZMENA: Odstránené volanie setupFileInputListeners() ===
        // (Všetko je už pripojené na #agendaView)
        // === KONIEC ZMENY ===
        
        // 7. Inicializácia procesora
        initializeDocumentProcessor(agendaConfig);
        
        // 8. Aktualizácia UI
        updateUIState();
    }
    
    function initializeDocumentProcessor(baseConfig) {
        const fullConfig = {
            sectionPrefix: AppState.selectedAgendaKey,
            appState: AppState,
            dataInputs: baseConfig.dataInputs,
            previewElementId: 'preview-container', // Stále posielame ID
            dataProcessor: baseConfig.dataProcessor,
            generators: baseConfig.generators,
            onDataProcessed: () => {
                // ZMENA: Hľadáme v kontexte agendaView
                const genTab = agendaView.querySelector('.agenda-tab[data-tab="generovanie"]');
                if (genTab) {
                    genTab.classList.remove('is-disabled');
                    showNotification('Dáta spracované. Karta "Generovanie" je teraz dostupná.', 'success');
                }
                updateUIState(); // Aktivuje aj samotné tlačidlá generátorov
            },
            
            // === NOVÉ CALLBACKY PRE DECOUPLING ODOSIELANIA MAILOV ===
            onMailGenerationStart: () => {
                // Volá sa pred začiatkom generovania 'zoznamyObce'
                AppState.municipalitiesMailContent = {};
                AppState.zoznamyPreObceGenerated = false;
            },
            onMailDataGenerated: (groupKey, mailData) => {
                // Volá sa pre každú obec v rámci generovania 'zoznamyObce'
                AppState.municipalitiesMailContent[groupKey] = mailData;
            },
            onMailGenerationComplete: () => {
                // Volá sa po úspešnom dokončení generovania 'zoznamyObce'
                AppState.zoznamyPreObceGenerated = true;
                // Musíme zavolať updateUIState(), aby sa zobrazilo tlačidlo mailu
                updateUIState(); 
            }
            // === KONIEC NOVÝCH CALLBACKOV ===
        };
        AppState.processor = new DocumentProcessor(fullConfig);
        AppState.processor.loadTemplates();
        if (AppState.selectedAgendaKey === 'vp') loadPscFile();
    }
    
    async function loadPscFile() {
        try {
            const response = await fetch(TEMPLATE_PATHS.pscFile);
            if (!response.ok) throw new Error(`Súbor PSČ sa nepodarilo načítať: ${response.statusText}`);
            const arrayBuffer = await response.arrayBuffer();
            AppState.processor.state.data.psc = arrayBuffer;
            AppState.processor.checkAndProcessData();
        } catch (error) {
            showErrorModal({ message: 'Chyba pri automatickom načítaní súboru PSČ.', details: error.message });
        }
    }
    
    // =============================
    // EVENT LISTENERS (Presunuté/Upravené)
    // =============================
    
    // ... (Väčšina listenerov je presunutá do setupStaticListeners) ...

    // ======================================================
    // === LOGIKA PRE ODOSIELANIE MAILOV (ZMENA) ===
    // ======================================================

    const PREVIEW_THRESHOLD = 20; 
    const PARTIAL_PREVIEW_COUNT = 10;

    /**
     * Zobrazí modálne okno so zoznamom obcí na odoslanie mailu.
     * Volá sa kliknutím na #send-mail-btn-vp.
     */
    function showMailListModal() {
        if (!AppState.zoznamyPreObceGenerated) {
            showNotification("Táto možnosť je dostupná až po vygenerovaní zoznamov pre obce.", "warning");
            return;
        }

        const mailContent = AppState.municipalitiesMailContent;
        const ouEmails = MUNICIPALITY_EMAILS[AppState.selectedOU] || {}; // <-- Používa lokálnu const
        
        let listHTML = '<ul style="list-style-type: none; padding: 0;">';
        let hasContent = false;

        for (const obecName in mailContent) {
            hasContent = true;
            const recipientEmail = ouEmails[obecName];
            const rowCount = mailContent[obecName].count;

            listHTML += `<li style="display: flex; align-items: center; justify-content: space-between; padding: 10px; border-bottom: 1px solid #eee;">
                <span><i class="fas fa-building" style="margin-right: 10px; color: #555;"></i>${obecName} <small>(${rowCount} záznamov)</small></span>`;

            if (recipientEmail) {
                listHTML += `<button class="btn btn--primary prepare-mail-to-obec-btn" data-obec="${encodeURIComponent(obecName)}">
                    <i class="fas fa-envelope"></i> Pripraviť e-mail
                </button>`;
            } else {
                listHTML += `<span style="color: var(--danger-color); font-size: 0.9em;"><i class="fas fa-exclamation-triangle"></i> Email nenájdený</span>`;
            }
            listHTML += `</li>`;
        }
        listHTML += '</ul>';

        if (!hasContent) {
             showModal({ title: 'Odoslanie pošty', content: '<p>Nenašli sa žiadne vygenerované dáta pre odoslanie.</p>'});
             return;
        }
        
        showModal({ title: 'Odoslať zoznamy obciam', content: listHTML });
    }

    /**
     * Zobrazí náhľad konkrétneho e-mailu pre obec.
     * Volá sa kliknutím na .prepare-mail-to-obec-btn v modálnom okne.
     * === ZMENENÁ FUNKCIA (OPRAVA) ===
     */
    const showEmailPreviewModal = (obecName) => {
        const mailContent = AppState.municipalitiesMailContent;
        const ouEmails = MUNICIPALITY_EMAILS[AppState.selectedOU] || {}; // <-- Používa lokálnu const
        
        const emailData = mailContent[obecName];
        if (!emailData) {
            showErrorModal({ message: 'Nenašli sa dáta pre e-mail pre zvolenú obec.'});
            return;
        }

        const { html: htmlBody, count: rowCount } = emailData;
        const recipient = ouEmails[obecName];
        const subject = `Zoznam subjektov pre obec ${obecName}`;
        
        // === ZMENA: Uložíme kontext do AppState pre delegované listenery ===
        AppState.tempMailContext = { htmlBody, recipient, subject, rowCount };
        // === KONIEC ZMENY ===

        const modalTitle = `
            <div class="help-center-header">
                <i class="fas fa-envelope-open-text"></i>
                <div class="title-group">
                    <h3>Náhľad e-mailu</h3>
                    <span>Skontrolujte obsah a skopírujte ho do e-mailového klienta.</span>
                </div>
            </div>`;

        let previewContentHTML;

        if (rowCount > PREVIEW_THRESHOLD) {
            previewContentHTML = `
                <div id="email-preview-content" style="border: 1px solid #e0e0e0; padding: 1rem; border-radius: 8px; background-color: #f9f9f9;">
                    <p>Náhľad e-mailu pre obec <strong>${obecName}</strong> obsahuje veľký počet záznamov (<strong>${rowCount} riadkov</strong>).</p>
                    <p>Zobrazenie celej tabuľky by mohlo spomaliť Váš prehliadač. Tlačidlo nižšie skopírujte <strong>kompletné dáta</strong>.</p>
                    <button id="show-partial-preview-btn" class="btn btn--secondary" style="margin-top: 0.5rem;"><i class="fas fa-eye"></i> Zobraziť ukážku prvých ${PARTIAL_PREVIEW_COUNT} riadkov</button>
                    <div id="email-partial-preview" style="display: none; margin-top: 1rem; max-height: 25vh; overflow-y: auto;"></div>
                </div>`;
        } else {
            previewContentHTML = `
                <div id="email-preview-content" style="border: 1px solid #e0e0e0; padding: 1rem; border-radius: 8px; background-color: #f9f9f9; max-height: 40vh; overflow-y: auto;">
                    ${htmlBody}
                </div>`;
        }

        const modalContent = `
            <div style="font-size: 0.9em; display: flex; flex-direction: column; gap: 1rem;">
                <p><strong>Príjemca:</strong> ${recipient}</p>
                <p><strong>Predmet:</strong> ${subject}</p>
                <p><strong>Telo e-mailu:</strong></p>
                ${previewContentHTML}
                <div style="background-color: var(--primary-color-light); padding: 1rem; border-radius: 8px; text-align: center;">
                    <p style="margin-bottom: 0.75rem;">Kliknutím na tlačidlo sa <strong>celé telo e-mailu</strong> (všetkých ${rowCount} riadkov) skopíruje a otvorí sa Váš predvolený e-mailový program. Následne stačí obsah do tela e-mailu iba vložiť (Ctrl+V).</p>
                    <button id="copy-and-open-mail-btn" class="btn btn--primary"><i class="fas fa-copy"></i> Skopírovať telo a otvoriť e-mail</button>
                </div>
            </div>
        `;

        // === ZMENA: Posielame autoFocusSelector do showModal ===
        showModal({ title: modalTitle, content: modalContent, autoFocusSelector: '#copy-and-open-mail-btn' });
        // === KONIEC ZMENY ===

        // === ODSTRÁNENÉ VŠETKY document.getElementById(...).addEventListener(...) ===
        // Logika bola presunutá do setupStaticListeners
    };

    // ... (Listener pre #modal-container je v setupStaticListeners) ...

    // ===================================
    // Zvyšok Event Listenerov
    // ===================================
    
    // ... (Listener pre Nápovedu je v setupStaticListeners) ...
    // ... (Listener pre Reset Tour je v setupStaticListeners) ...
    
    // ======================================================
    // === NOVÁ FUNKCIA PRE NÁPOVEDU (VÝRAZNE ZMENENÉ) ===
    // ======================================================
    
    /**
     * ZMENA: Vkladá obsah do #help-view a prepína zobrazenie.
     */
    function renderHelpCenterView() {
        // Krok 1: Pripravíme dynamické dáta
        const downloadListHTML = Object.entries(TEMPLATE_DOWNLOAD_FILES).map(([fileName, path]) => {
            return `
                <li class="download-item">
                    <i class="fas fa-file-excel"></i>
                    <span>${fileName}</span>
                    <a href="${path}" download="${fileName}" class="btn btn--primary" style="padding: 0.4rem 1rem; margin-left: auto;">
                        <i class="fas fa-download"></i> Stiahnuť
                    </a>
                </li>
            `;
        }).join('');
        const okresName = AppState.okresData ? AppState.okresData.Okresny_urad : 'Nevybraný';

        // Krok 2: Zavoláme funkciu, ktorá vráti celý HTML obsah
        const content = getHelpCenterHTML({
            okresName: okresName,
            downloadListHTML: downloadListHTML
        });

        // Krok 3: Vykreslíme obsah do #help-view
        helpView.innerHTML = content;
        
        // Krok 4: Prepne zobrazenie
        showView('help');

        // Krok 5: Aktivujeme listenery pre NOVÝ OBSAH v #help-view
        setupTabListeners(helpView);
        setupAccordionListeners(helpView);
    }


    /**
     * Aktivuje prepínanie kariet (používa sa pre Agendy aj Nápovedu)
     * ZMENA: Akceptuje parentElement pre skenovanie tabov.
     */
    function setupTabListeners(parentElement = document) {
        const tabs = parentElement.querySelectorAll('.agenda-tab');
        const contents = parentElement.querySelectorAll('.agenda-tab-content');
        if (tabs.length === 0) return;
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                if (tab.classList.contains('is-disabled')) {
                    showNotification('Táto karta bude dostupná po nahratí a spracovaní súborov.', 'warning');
                    return;
                }
                
                tabs.forEach(t => t.classList.remove('active'));
                contents.forEach(c => c.classList.remove('active'));
                
                tab.classList.add('active');
                // ZMENA: Hľadáme ID v kontexte parentElement
                const contentEl = parentElement.querySelector(`#tab-${tab.dataset.tab}`);
                if (contentEl) {
                    contentEl.classList.add('active');
                }
            });
        });
    }

    /**
     * Aktivuje logiku akordeónu (nová pomocná funkcia - ZMENENÁ)
     * ZMENA: Akceptuje parentElement pre skenovanie akordeónu.
     */
    function setupAccordionListeners(parentElement = document) {
        // ZMENA: Hľadáme všetky .accordion-card v celom dashboard-content
        const accordionItems = parentElement.querySelectorAll(`.accordion-card`); 
        if (accordionItems.length === 0) return;

        accordionItems.forEach(item => {
            const header = item.querySelector('.accordion-header');
            header.addEventListener('click', () => {
                // Umožní otvoriť viacero položiek naraz
                item.classList.toggle('active');
            });
        });
    }

    // Funkcia `handleDownloadTemplates` sa už nepoužíva
    // Funkcia `showHelpCenterModal` sa už nepoužíva

    /**
     * === ZMENA: Táto funkcia bola odstránená ===
     * Jej logika bola presunutá do zjednoteného 'click' listenera
     * v setupStaticListeners.
     */
    // function setupGeneratorButtonListeners() { ... }


    /**
     * === ZMENA: Táto funkcia bola odstránená ===
     * Jej logika bola presunutá do zjednoteného 'click' listenera
     * v setupStaticListeners.
     */
    // function setupSpisEditListener() { ... }


    /**
     * === ZMENA: Táto funkcia teraz pripája listenery na #agendaView ===
     * Pripája iba 'change' a drag/drop listenery.
     * 'click' listener pre .btn-remove-file bol presunutý.
     */
    function setupFileInputListeners() {
        // === ZMENA: Listener je pripojený na #agendaView ===
        if (!agendaView) return;

        // Pomocná funkcia na získanie kontextu
        const getFileConfig = (target) => {
            const agendaConfig = agendaConfigs[AppState.selectedAgendaKey];
            if (!agendaConfig) return null;
            
            const inputWrapper = target.closest('.file-input-wrapper');
            if (!inputWrapper) return null;
            
            const input = inputWrapper.querySelector('.file-input');
            if (!input) return null;
            
            const inputId = input.id;
            const dropZone = document.getElementById(input.dataset.dropzoneId);
            const fileNameEl = dropZone?.querySelector('.file-name');
            const fileSizeEl = dropZone?.querySelector('.file-size');
            const inputConf = agendaConfig.dataInputs.find(conf => conf.id === inputId);
            const stateKey = inputConf ? inputConf.stateKey : null;

            return { input, inputId, dropZone, fileNameEl, fileSizeEl, stateKey };
        };

        // Pomocná funkcia na spracovanie súboru
        const handleFile = (file, config) => {
            if (!file || !config || !config.stateKey) return;
            const { input, inputId, dropZone, fileNameEl, fileSizeEl, stateKey } = config;

            AppState.files[inputId] = file;
            dropZone.classList.add('loaded');
            fileNameEl.textContent = file.name;
            fileSizeEl.textContent = formatBytes(file.size);
            if (AppState.processor) {
                AppState.processor.processFile(file, stateKey);
            }
        };

        // 1. Listener pre <input type="file"> (delegovaný)
        agendaView.addEventListener('change', (e) => {
            const input = e.target.closest('.file-input');
            if (!input) return;
            
            const config = getFileConfig(input);
            if (config && e.target.files.length > 0) {
                handleFile(e.target.files[0], config);
            }
        });

        // 2. Listenery pre Drag & Drop (delegované)
        agendaView.addEventListener('dragover', (e) => {
            e.preventDefault();
            const dropZone = e.target.closest('.file-drop-zone');
            if (dropZone) dropZone.classList.add('active');
        });

        agendaView.addEventListener('dragleave', (e) => {
            const dropZone = e.target.closest('.file-drop-zone');
            if (dropZone) dropZone.classList.remove('active');
        });

        agendaView.addEventListener('drop', (e) => {
            e.preventDefault();
            const dropZone = e.target.closest('.file-drop-zone');
            if (!dropZone) return;
            
            dropZone.classList.remove('active');
            const config = getFileConfig(dropZone);
            if (config && e.dataTransfer.files.length) {
                handleFile(e.dataTransfer.files[0], config);
            }
        });

        // 3. Listener pre tlačidlo "Remove file" (delegovaný)
        // === TÁTO ČASŤ BOLA PRESUNUTÁ DO setupStaticListeners ===
        // agendaView.addEventListener('click', (e) => { ... });
    }

    function initializeFromLocalStorage() {
        const lastOU = localStorage.getItem('krokr-lastOU');
        if (lastOU) {
            setOkresnyUrad(lastOU);
            
            const lastAgenda = localStorage.getItem('krokr-lastAgenda');
            if (lastAgenda) {
                setTimeout(() => {
                    // Už neklikáme, ale rovno voláme render
                    // AppState.currentView = 'agenda'; // Toto je už riešené v renderAgendaView
                    renderAgendaView(lastAgenda);
                }, 100);
            }
        }
    }
});

// ===== ZMENA: Funkcia teraz prijíma dáta ako parameter =====
function populateOkresnyUradSelect(ouData) {
    // === ZMENA: Celá funkcia je prepísaná pre vlastný select ===
    const optionsContainer = document.getElementById('okresny-urad-options');
    if (!optionsContainer) return;
    optionsContainer.innerHTML = ''; // Vyčistiť

    // 1. Pridanie "placeholder" voľby
    const placeholderOption = document.createElement('div');
    placeholderOption.className = 'custom-select-option selected'; // Predvolená je vybraná
    placeholderOption.textContent = '';
    placeholderOption.dataset.value = '';
    optionsContainer.appendChild(placeholderOption);

    // 2. Pridanie ostatných volieb
    Object.keys(ouData).forEach(key => {
        const option = document.createElement('div');
        option.className = 'custom-select-option';
        option.textContent = ouData[key].Okresny_urad;
        option.dataset.value = key; // Použijeme data-atribút
        optionsContainer.appendChild(option);
    });
    // === KONIEC ZMENY ===
}