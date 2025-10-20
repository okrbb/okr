import { OKRESNE_URADY } from './config.js';
import { showNotification, showErrorModal, showModal, formatBytes } from './ui.js';
import { agendaConfigs } from './agendaConfigFactory.js';
import { DocumentProcessor } from './DocumentProcessor.js';
import { startGuidedTour } from './tour.js';

// Globálny stav aplikácie
const AppState = {
    selectedOU: null,
    okresData: null,
    spis: {},
    selectedAgendaKey: null,
    processor: null,
    files: {},
    notifications: [] // <-- NOVÝ STAV pre notifikácie
};

document.addEventListener('DOMContentLoaded', () => {
    // === DOM ELEMENTY ===
    const ouSelect = document.getElementById('okresny-urad');
    const agendaCards = document.querySelectorAll('.agenda-card');
    const dashboardContent = document.getElementById('dashboard-content');
    
    const resetAppBtn = document.getElementById('reset-app-btn');
    const helpCenterBtn = document.getElementById('show-help-center');
    const resetTourBtn = document.getElementById('reset-tour-btn');

    // === NOVÉ: DOM ELEMENTY PRE CENTRUM NOTIFIKÁCIÍ ===
    const notificationBellBtn = document.getElementById('notification-bell-btn');
    const notificationPanel = document.getElementById('notification-center-panel');
    const notificationList = document.getElementById('notification-list');
    const notificationBadge = document.querySelector('.notification-badge');
    const clearNotificationsBtn = document.getElementById('clear-notifications-btn');

    const sidebarSteps = {
        step1: document.getElementById('sidebar-step-1'),
        step2: document.getElementById('sidebar-step-2'),
    };

    // === INICIALIZÁCIA ===
    populateOkresnyUradSelect();
    initializeFromLocalStorage();
    startGuidedTour();

    // ======================================================
    // === NOVÉ: LOGIKA PRE CENTRUM NOTIFIKÁCIÍ ============
    // ======================================================
    
    /**
     * Vykreslí notifikácie zo stavu AppState.notifications do panela.
     */
    function renderNotifications() {
        if (!notificationList) return;

        if (AppState.notifications.length === 0) {
            notificationList.innerHTML = '<li class="empty-state">Zatiaľ žiadne nové notifikácie.</li>';
        } else {
            // Zobrazujeme maximálne posledných 50 notifikácií, aby sme nepreťažili DOM
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

    /**
     * Pridá novú notifikáciu do stavu.
     * @param {string} message - Správa notifikácie.
     * @param {string} type - Typ (success, error, info, warning).
     */
    function addNotification(message, type = 'info') {
        const newNotification = {
            id: Date.now(),
            message,
            type,
            timestamp: new Date()
        };
        // Pridáme najnovšiu na začiatok poľa
        AppState.notifications.unshift(newNotification);
        renderNotifications();
    }

    /**
     * Vráti CSS triedu ikony na základe typu notifikácie.
     * @param {string} type - Typ notifikácie.
     * @returns {string} - Trieda ikony.
     */
    function getIconForType(type) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        return icons[type] || 'fa-info-circle';
    }

    // --- Event Listenery pre Centrum Notifikácií ---
    notificationBellBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Zabráni zavretiu panelu hneď po otvorení
        notificationPanel.classList.toggle('show');
    });

    clearNotificationsBtn.addEventListener('click', () => {
        AppState.notifications = [];
        renderNotifications();
        showNotification('História notifikácií bola vymazaná.', 'info');
    });

    // Počúva na udalosť odoslanú z ui.js a pridáva notifikáciu do stavu
    document.addEventListener('add-notification', (e) => {
        const { message, type } = e.detail;
        addNotification(message, type);
    });

    // Zavrie panel, ak sa klikne mimo neho
    document.addEventListener('click', (e) => {
        if (!notificationPanel.contains(e.target) && notificationPanel.classList.contains('show')) {
            notificationPanel.classList.remove('show');
        }
    });

    // ===================================
    // RIADENIE STAVU UI
    // ===================================

    function updateUIState() {
        const ouSelected = !!AppState.selectedOU;
        sidebarSteps.step1.classList.toggle('is-completed', ouSelected);
        sidebarSteps.step1.classList.toggle('is-active', !ouSelected);
        document.getElementById('ou-select-wrapper').classList.toggle('is-locked', ouSelected);
        ouSelect.disabled = ouSelected;

        const agendaSelected = !!AppState.selectedAgendaKey;
        sidebarSteps.step2.classList.toggle('is-active', ouSelected && !agendaSelected);
        sidebarSteps.step2.classList.toggle('is-completed', ouSelected && agendaSelected);

        const stepPreview = document.getElementById('workflow-step-preview');
        const stepGenerate = document.getElementById('workflow-step-generate');

        if (stepPreview && stepGenerate) {
            const spisReady = AppState.spis[AppState.selectedAgendaKey];
            const filesReady = AppState.selectedAgendaKey && agendaConfigs[AppState.selectedAgendaKey].dataInputs
                                .every(input => AppState.files[input.id]);

            stepPreview.classList.toggle('is-disabled', !filesReady);
            stepGenerate.classList.toggle('is-disabled', !filesReady || !spisReady);
        }
    }
    
    // =============================
    // HLAVNÁ LOGIKA A FUNKCIE
    // =============================

    function showWelcomeMessage() {
        dashboardContent.innerHTML = `
            <div class="welcome-message">
                <i class="fas fa-hand-pointer"></i>
                <h2>Vitajte v aplikácii</h2>
                <p>Prosím, začnite výberom okresného úradu v paneli vľavo.</p>
            </div>`;
    }

    function resetApp() {
        localStorage.removeItem('krokr-lastOU');
        localStorage.removeItem('krokr-lastAgenda');
        Object.assign(AppState, {
            selectedOU: null, okresData: null, spis: {}, 
            selectedAgendaKey: null, processor: null, files: {},
            notifications: [] // Resetujeme aj notifikácie
        });
        
        ouSelect.value = '';
        agendaCards.forEach(c => c.classList.remove('active'));
        
        showWelcomeMessage();
        updateUIState();
        renderNotifications(); // Vykreslíme prázdny stav
        showNotification('Aplikácia bola resetovaná.', 'info');
    }

    function renderAgendaView(agendaKey) {
        const agendaConfig = agendaConfigs[agendaKey];
        if (!agendaConfig) return;

        AppState.selectedAgendaKey = agendaKey;
        AppState.files = {}; // Reset files on new agenda selection
        agendaCards.forEach(card => card.classList.toggle('active', card.dataset.agenda === agendaKey));

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

        const generatorsHTML = Object.keys(agendaConfig.generators).map(genKey => {
            const genConf = agendaConfig.generators[genKey];
            const isXlsx = genConf.outputType === 'xlsx';
            const buttonText = isXlsx ? 'Exportovať (.xlsx)' : 'Generovať (.docx)';
            return `
                <div class="doc-box">
                    <h4>${genConf.title}</h4>
                    <p class="doc-box__description">${isXlsx ? 'Tento export vygeneruje súbor .xlsx.' : 'Generuje dokumenty na základe šablóny.'}</p>
                    <button id="${genConf.buttonId}" class="btn btn--accent" data-generator-key="${genKey}" disabled><i class="fas fa-cogs"></i> ${buttonText}</button>
                </div>`;
        }).join('');

        dashboardContent.innerHTML = `
            <div class="content-header">
                <h2>${agendaConfig.title}</h2>
                <div class="selection-summary">
                    <strong>Okresný úrad:</strong><br>${AppState.okresData.Okresny_urad}
                </div>
            </div>
            <div class="workflow-container">
                <section id="workflow-step-inputs" class="workflow-step">
                    <h3><i class="fas fa-sign-in-alt"></i> Krok 1: Vstupné údaje</h3>
                    <div class="input-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem;">
                        <div class="input-item">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Číslo spisu</label>
                            <div class="spis-input-group">
                                <input type="text" id="spis-input" class="form-input" placeholder="Napr. BB-OKR-2025/123456">
                                <button id="save-spis-btn" class="btn btn--primary">Uložiť</button>
                            </div>
                        </div>
                        <div class="input-item">
                             <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Vstupné súbory</label>
                             <div class="file-inputs-container" style="display: flex; flex-direction: column; gap: 1rem;">${fileInputsHTML}</div>
                        </div>
                    </div>
                </section>
                <section id="workflow-step-preview" class="workflow-step is-disabled">
                    <h3><i class="fas fa-search"></i> Krok 2: Náhľad a kontrola dát</h3>
                    <div id="preview-container" class="data-preview">
                        <div class="empty-state-placeholder">
                            <i class="fas fa-file-import"></i>
                            <h4>Náhľad sa zobrazí po nahratí súborov</h4>
                            <p>Začnite nahratím vstupných súborov v kroku č. 1.</p>
                        </div>
                    </div>
                </section>
                <section id="workflow-step-generate" class="workflow-step is-disabled">
                    <h3><i class="fas fa-file-export"></i> Krok 3: Generovanie dokumentov</h3>
                    <div id="generators-container" class="generators-grid">${generatorsHTML}</div>
                </section>
            </div>`;
        
        setupFileInputListeners();
        setupSpisInputListeners();
        initializeDocumentProcessor(agendaConfig);
        setupGeneratorButtonListeners(agendaConfig);
        updateUIState();
    }
    
    function initializeDocumentProcessor(baseConfig) {
        const fullConfig = {
            sectionPrefix: AppState.selectedAgendaKey,
            appState: AppState,
            dataInputs: baseConfig.dataInputs,
            previewElementId: 'preview-container',
            dataProcessor: baseConfig.dataProcessor,
            generators: baseConfig.generators,
            onDataProcessed: () => updateUIState()
        };
        AppState.processor = new DocumentProcessor(fullConfig);
        AppState.processor.loadTemplates();
        if (AppState.selectedAgendaKey === 'vp') loadPscFile();
    }
    
    async function loadPscFile() {
        try {
            const response = await fetch('TEMP/PSC.xlsx');
            if (!response.ok) throw new Error(`Súbor PSČ sa nepodarilo načítať: ${response.statusText}`);
            const arrayBuffer = await response.arrayBuffer();
            AppState.processor.state.data.psc = arrayBuffer;
            AppState.processor.checkAndProcessData();
        } catch (error) {
            showErrorModal({ message: 'Chyba pri automatickom načítaní súboru PSČ.', details: error.message });
        }
    }
    
    // =============================
    // EVENT LISTENERS
    // =============================
    ouSelect.addEventListener('change', (e) => {
        const selectedValue = e.target.value;
        if (!selectedValue) {
            resetApp();
            return;
        }
        AppState.selectedOU = selectedValue;
        AppState.okresData = OKRESNE_URADY[selectedValue];
        localStorage.setItem('krokr-lastOU', selectedValue);
        showNotification(`Vybraný OÚ: ${AppState.okresData.Okresny_urad}`, 'success');
        if (AppState.selectedAgendaKey) {
            renderAgendaView(AppState.selectedAgendaKey);
        }
        updateUIState();
    });

    agendaCards.forEach(card => {
        card.addEventListener('click', () => {
            if (!AppState.selectedOU) {
                showNotification("Najprv prosím vyberte okresný úrad.", "warning");
                return;
            }
            const agendaKey = card.dataset.agenda;
            localStorage.setItem('krokr-lastAgenda', agendaKey);
            renderAgendaView(agendaKey);
        });
    });

    resetAppBtn.addEventListener('click', () => {
        if (confirm("Naozaj chcete resetovať aplikáciu? Stratíte všetky neuložené dáta.")) {
            resetApp();
        }
    });

    if (resetTourBtn) {
        resetTourBtn.addEventListener('click', () => {
            localStorage.removeItem('krokr-tour-completed');
            startGuidedTour();
        });
    }

    if (helpCenterBtn) {
        helpCenterBtn.addEventListener('click', showHelpCenterModal);
    }

    // ==================================
    // FUNKCIE PRE NÁPOVEDU A LISTENERY
    // ==================================

    /**
     * **REDDIZAJN CENTRA NÁPOVEDY:** Nová funkcia s tab-based layoutom.
     */
    function showHelpCenterModal() {
        const title = `
            <div class="help-center-header">
                <i class="fas fa-life-ring"></i>
                <div class="title-group">
                    <h3>Centrum nápovedy</h3>
                    <span>Všetko, čo potrebujete vedieť na jednom mieste.</span>
                </div>
            </div>`;

        const content = `
            <div class="modal-tabs-container">
                <div class="modal-tab active" data-tab="faq"><i class="fas fa-question-circle"></i> Časté otázky</div>
                <div class="modal-tab" data-tab="troubleshooting"><i class="fas fa-wrench"></i> Riešenie problémov</div>
            </div>

            <div class="modal-tab-content-wrapper">
                <div id="tab-faq" class="modal-tab-content active">
                    <div class="accordion">
                        <div class="accordion-item">
                            <div class="accordion-header">Prečo sú tlačidlá "Generovať" neaktívne?</div>
                            <div class="accordion-content">
                                Tlačidlá sa automaticky aktivujú, keď sú splnené všetky nasledujúce podmienky:
                                <ul>
                                    <li>je vybraný okresný úrad</li>
                                    <li>je zvolená agenda</li>
                                    <li>je zadané a uložené <strong>číslo spisu</strong></li>
                                    <li>je nahratý a úspešne spracovaný <strong>vstupný .xlsx súbor</strong></li>
                                </ul>
                            </div>
                        </div>
                        <div class="accordion-item">
                            <div class="accordion-header">Ako aplikácia aplikuje §§ pri generovaní rozhodnutí?</div>
                            <div class="accordion-content">
                                Pri rozhodnutiach pre vecné prostriedky a pre ubytovanie aplikácia automaticky vkladá správny odsek a písmeno Zákona č. 319/2002 Z. z. na základe prítomnosti lomky "/" v IČO(RČ) alebo prázdnej bunky.
                                <ul>
                                    <li><b>pre PO, FOP (číslo bez / v bunke):</b> ods. 1 písm. d)</li>
                                    <li><b>pre FO (číslo s / v bunke, alebo prázdna bunka):</b> ods. 3 písm. b)</li>
                                </ul>
                            </div>
                        </div>
                        <div class="accordion-item">
                            <div class="accordion-header">Dajú sa vygenerované dokumenty editovať?</div>
                            <div class="accordion-content">
                                Áno, všetky vygenerované dokumenty .docx sú plne editovateľné (napr. v Microsoft Word alebo LibreOffice). Môžete ich upravovať podľa potreby pred ich finálnym uložením alebo tlačou.
                            </div>
                        </div>
                        <div class="accordion-item">
                            <div class="accordion-header">Čo robiť, ak sa zobrazí chyba pri spracovaní súboru?</div>
                            <div class="accordion-content">
                                Najčastejšou príčinou je nesprávny formát vstupného .xlsx súboru. Skontrolujte prosím, či:
                                <ul>
                                    <li>súbor obsahuje všetky požadované stĺpce</li>
                                    <li>názvy stĺpcov presne zodpovedajú predlohe</li>
                                    <li>dáta v súbore sú v očakávanom formáte a bunky nie sú zlúčené</li>
                                </ul>
                                Pre viac detailov si pozrite chybové hlásenie, ktoré sa zobrazí, alebo sekciu "Riešenie problémov".
                            </div>
                        </div>
                    </div>
                </div>

                <div id="tab-troubleshooting" class="modal-tab-content">
                    <div class="accordion">
                         <div class="accordion-item">
                            <div class="accordion-header">Chyba: "Nenašiel sa riadok s hlavičkou..."</div>
                            <div class="accordion-content">
                                Táto chyba znamená, že aplikácia vo vašom .xlsx súbore nenašla očakávané názvy stĺpcov. Uistite sa, že stĺpce v súbore, ktorý nahrávate, majú presne rovnaké názvy ako v pripravenej predlohe pre danú agendu. Dajte pozor na preklepy, medzery navyše alebo skryté znaky.
                            </div>
                        </div>
                         <div class="accordion-item">
                            <div class="accordion-header">Náhľad dát zobrazuje nezmyselné hodnoty.</div>
                            <div class="accordion-content">
                                Skontrolujte, či vo vašom .xlsx súbore nemáte zlúčené bunky. Aplikácia vyžaduje, aby každá informácia bola vo vlastnej, samostatnej bunke. Taktiež sa uistite, že dáta začínajú hneď pod riadkom s hlavičkou a nepredchádzajú im žiadne prázdne riadky.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        showModal({ title: title, content: content });
        // Pridanie listenera pre tlačidlo vnútri modálneho okna
        const restartTourBtn = document.getElementById('restart-tour-from-modal');
        if(restartTourBtn) {
            restartTourBtn.addEventListener('click', () => {
                document.querySelector('.modal-close-btn')?.click(); // Zavrie modálne okno
                setTimeout(() => {
                    localStorage.removeItem('krokr-tour-completed');
                    startGuidedTour();
                }, 300); // Malé oneskorenie kvôli animácii zatvorenia
            });
        }
    }

    function setupGeneratorButtonListeners(agendaConfig) {
        if (!agendaConfig.generators) return;

        Object.keys(agendaConfig.generators).forEach(genKey => {
            const genConf = agendaConfig.generators[genKey];
            const button = document.getElementById(genConf.buttonId);
            if (button) {
                button.addEventListener('click', () => {
                    if (!AppState.processor) return;
                    switch (genConf.type) {
                        case 'row': AppState.processor.generateRowByRow(genKey); break;
                        case 'batch': AppState.processor.generateInBatches(genKey); break;
                        case 'groupBy': AppState.processor.generateByGroup(genKey); break;
                        default: showErrorModal({ message: `Neznámy typ generátora: ${genConf.type}` });
                    }
                });
            }
        });
    }

    function setupFileInputListeners() {
        const agendaConfig = agendaConfigs[AppState.selectedAgendaKey];
        if (!agendaConfig) return;

        document.querySelectorAll('.file-input').forEach(input => {
            const dropZone = document.getElementById(input.dataset.dropzoneId);
            const fileNameEl = dropZone.querySelector('.file-name');
            const fileSizeEl = dropZone.querySelector('.file-size');
            const inputConf = agendaConfig.dataInputs.find(conf => conf.id === input.id);
            const stateKey = inputConf ? inputConf.stateKey : null;

            const handleFile = (file) => {
                if (!file || !stateKey) return;
                AppState.files[input.id] = file;
                dropZone.classList.add('loaded');
                fileNameEl.textContent = file.name;
                fileSizeEl.textContent = formatBytes(file.size);
                if (AppState.processor) {
                    AppState.processor.processFile(file, stateKey);
                }
            };
            
            input.addEventListener('change', (e) => handleFile(e.target.files[0]));
            dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('active'); });
            dropZone.addEventListener('dragleave', () => dropZone.classList.remove('active'));
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('active');
                if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
            });
        });

        document.querySelectorAll('.btn-remove-file').forEach(button => {
            button.addEventListener('click', (e) => {
                const inputId = e.currentTarget.dataset.inputId;
                const input = document.getElementById(inputId);
                const dropZone = document.getElementById(input.dataset.dropzoneId);
                
                delete AppState.files[inputId];
                input.value = '';
                dropZone.classList.remove('loaded');
                
                if (AppState.processor) {
                    const inputConf = agendaConfigs[AppState.selectedAgendaKey]?.dataInputs.find(i => i.id === inputId);
                    const stateKey = inputConf ? inputConf.stateKey : null;
                    if (stateKey) delete AppState.processor.state.data[stateKey];
                    
                    AppState.processor.state.processedData = null;
                    
                    // === ZMENA: Zobrazenie "empty state" po vymazaní súboru ===
                    const previewContainer = document.getElementById('preview-container');
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
            });
        });
    }

    function setupSpisInputListeners() {
        const spisInput = document.getElementById('spis-input');
        const saveSpisBtn = document.getElementById('save-spis-btn');
        if (!spisInput || !saveSpisBtn) return;
        
        if (AppState.spis[AppState.selectedAgendaKey]) {
            spisInput.value = AppState.spis[AppState.selectedAgendaKey];
        }

        const saveFileNumber = () => {
    const value = spisInput.value.trim();
    const existingValue = AppState.spis[AppState.selectedAgendaKey];

    // --- KĽÚČOVÁ ZMENA: Uložíme a notifikujeme iba vtedy, ak je hodnota nová ---
    if (value && value !== existingValue) {
        AppState.spis[AppState.selectedAgendaKey] = value;
        showNotification(`Číslo spisu bolo uložené.`, 'success');
        AppState.processor?.checkAllButtonsState();
        updateUIState();
    }
};

        saveSpisBtn.addEventListener('click', saveFileNumber);
        spisInput.addEventListener('blur', saveFileNumber);
        spisInput.addEventListener('keyup', (e) => e.key === 'Enter' && saveFileNumber());
    }

    function initializeFromLocalStorage() {
        const lastOU = localStorage.getItem('krokr-lastOU');
        if (lastOU) {
            ouSelect.value = lastOU;
            ouSelect.dispatchEvent(new Event('change'));
            
            const lastAgenda = localStorage.getItem('krokr-lastAgenda');
            if (lastAgenda) {
                setTimeout(() => {
                    const agendaCard = document.querySelector(`.agenda-card[data-agenda="${lastAgenda}"]`);
                    if (agendaCard) agendaCard.click();
                }, 100);
            }
        }
    }
});

function populateOkresnyUradSelect() {
    const select = document.getElementById('okresny-urad');
    Object.keys(OKRESNE_URADY).forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = OKRESNE_URADY[key].Okresny_urad;
        select.appendChild(option);
    });
}