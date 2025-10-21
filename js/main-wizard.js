// js/main-wizard.js
import { OKRESNE_URADY, TEMPLATE_PATHS, TEMPLATE_DOWNLOAD_FILES } from './config.js';
import { showNotification, showErrorModal, showModal, formatBytes } from './ui.js';
import { agendaConfigs } from './agendaConfigFactory.js';
import { DocumentProcessor } from './DocumentProcessor.js';
import { startGuidedTour } from './tour.js';
import { MUNICIPALITY_EMAILS } from './mail-config.js';

// Globálny stav aplikácie
const AppState = {
    selectedOU: null,
    okresData: null,
    spis: {},
    selectedAgendaKey: null,
    processor: null,
    files: {},
    notifications: [],
    municipalitiesMailContent: {},
    zoznamyPreObceGenerated: false,
};

document.addEventListener('DOMContentLoaded', () => {
    // === DOM ELEMENTY ===
    const ouSelect = document.getElementById('okresny-urad');
    const agendaCards = document.querySelectorAll('.agenda-card');
    const dashboardContent = document.getElementById('dashboard-content');
    
    const resetAppBtn = document.getElementById('reset-app-btn');
    const helpCenterBtn = document.getElementById('show-help-center');
    const resetTourBtn = document.getElementById('reset-tour-btn');
    const sendMailBtn = document.getElementById('send-mail-btn');

    const notificationBellBtn = document.getElementById('notification-bell-btn');
    const notificationPanel = document.getElementById('notification-center-panel');
    const notificationList = document.getElementById('notification-list');
    const notificationBadge = document.querySelector('.notification-badge');
    const clearNotificationsBtn = document.getElementById('clear-notifications-btn');

    const sidebarSteps = {
        step1: document.getElementById('sidebar-step-1'),
        step2: document.getElementById('sidebar-step-2'),
        step3: document.getElementById('sidebar-step-3'),
    };

    // === INICIALIZÁCIA ===
    populateOkresnyUradSelect();
    initializeFromLocalStorage();
    startGuidedTour();

    // ======================================================
    // === LOGIKA PRE CENTRUM NOTIFIKÁCIÍ ===================
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
        const newNotification = {
            id: Date.now(),
            message,
            type,
            timestamp: new Date()
        };
        AppState.notifications.unshift(newNotification);
        renderNotifications();
    }

    function getIconForType(type) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        return icons[type] || 'fa-info-circle';
    }

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
        
        const mailStepActive = AppState.zoznamyPreObceGenerated && AppState.selectedAgendaKey === 'vp';
        sidebarSteps.step3.classList.toggle('is-active', mailStepActive);

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

    function setOkresnyUrad(ouKey) {
        if (!ouKey) {
            resetApp();
            return;
        }

        ouSelect.value = ouKey;
        AppState.selectedOU = ouKey;
        AppState.okresData = OKRESNE_URADY[ouKey];
        localStorage.setItem('krokr-lastOU', ouKey);
        showNotification(`Vybraný OÚ: ${AppState.okresData.Okresny_urad}`, 'success');
        if (AppState.selectedAgendaKey) {
            renderAgendaView(AppState.selectedAgendaKey);
        }
        updateUIState();
    }

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
            notifications: [],
            municipalitiesMailContent: {},
            zoznamyPreObceGenerated: false,
        });
        
        ouSelect.value = '';
        agendaCards.forEach(c => c.classList.remove('active'));
        
        showWelcomeMessage();
        updateUIState();
        renderNotifications();
        showNotification('Aplikácia bola resetovaná.', 'info');
    }

    function renderAgendaView(agendaKey) {
        const agendaConfig = agendaConfigs[agendaKey];
        if (!agendaConfig) return;

        AppState.selectedAgendaKey = agendaKey;
        AppState.files = {};
        AppState.municipalitiesMailContent = {};
        AppState.zoznamyPreObceGenerated = false;

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
            // --- TU BOLA CHYBA ---
            dataProcessor: baseConfig.dataProcessor, // Opravené z 'base' na 'baseConfig'
            // --- KONIEC OPRAVY ---
            generators: baseConfig.generators,
            onDataProcessed: () => updateUIState()
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
    // EVENT LISTENERS
    // =============================
    
    ouSelect.addEventListener('change', (e) => {
        setOkresnyUrad(e.target.value);
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

if (sendMailBtn) {
    const PREVIEW_THRESHOLD = 20; 
    const PARTIAL_PREVIEW_COUNT = 10;

    const showEmailPreviewModal = (obecName) => {
        const mailContent = AppState.municipalitiesMailContent;
        const ouEmails = MUNICIPALITY_EMAILS[AppState.selectedOU] || {};
        
        const emailData = mailContent[obecName];
        if (!emailData) {
            showErrorModal({ message: 'Nenašli sa dáta pre e-mail pre zvolenú obec.'});
            return;
        }

        const { html: htmlBody, count: rowCount } = emailData;
        const recipient = ouEmails[obecName];
        const subject = `Zoznam subjektov pre obec ${obecName}`;

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
                    <p>Zobrazenie celej tabuľky by mohlo spomaliť Váš prehliadač. Tlačidlo nižšie skopíruje <strong>kompletné dáta</strong>.</p>
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

        showModal({ title: modalTitle, content: modalContent });

        document.getElementById('copy-and-open-mail-btn').addEventListener('click', async () => {
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

        const showPartialBtn = document.getElementById('show-partial-preview-btn');
        if (showPartialBtn) {
            showPartialBtn.addEventListener('click', () => {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = htmlBody;
                
                const table = tempDiv.querySelector('table');
                if (table) {
                    const rows = Array.from(table.querySelectorAll('tbody > tr'));
                    const previewRows = rows.slice(0, PARTIAL_PREVIEW_COUNT);
                    
                    const newTbody = document.createElement('tbody');
                    previewRows.forEach(row => newTbody.appendChild(row.cloneNode(true)));
                    
                    table.querySelector('tbody').replaceWith(newTbody);
                    
                    const partialPreviewContainer = document.getElementById('email-partial-preview');
                    partialPreviewContainer.innerHTML = tempDiv.innerHTML;
                    partialPreviewContainer.style.display = 'block';
                    showPartialBtn.style.display = 'none';
                }
            });
        }
    };

    sendMailBtn.addEventListener('click', () => {
        if (!AppState.zoznamyPreObceGenerated) {
            showNotification("Táto možnosť je dostupná až po vygenerovaní zoznamov pre obce v agende 'Vecné prostriedky'.", "warning");
            return;
        }

        const mailContent = AppState.municipalitiesMailContent;
        const ouEmails = MUNICIPALITY_EMAILS[AppState.selectedOU] || {};
        
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
    });

    document.getElementById('modal-container').addEventListener('click', (e) => {
        const target = e.target.closest('.prepare-mail-to-obec-btn');
        if (!target) return;

        const obecName = decodeURIComponent(target.dataset.obec);
        showEmailPreviewModal(obecName);
    });
}

    if (resetTourBtn) {
        resetTourBtn.addEventListener('click', () => {
            localStorage.removeItem('krokr-tour-completed');
            startGuidedTour();
        });
    }

    if (helpCenterBtn) {
        helpCenterBtn.addEventListener('click', showHelpCenterModal);
    }
    
    // Zvyšok súboru ostáva bez zmeny...
    async function handleDownloadTemplates() {
        const downloadBtn = document.getElementById('download-templates-btn');
        const originalText = downloadBtn.innerHTML;
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<span class="btn-spinner"></span> Pripravujem...';

        try {
            const zip = new JSZip();
            const files = Object.entries(TEMPLATE_DOWNLOAD_FILES);

            const fetchedFiles = await Promise.all(
                files.map(async ([fileName, path]) => {
                    const response = await fetch(path);
                    if (!response.ok) {
                        throw new Error(`Súbor ${fileName} sa nepodarilo načítať na ceste: ${path} (status: ${response.status})`);
                    }
                    return { name: fileName, data: await response.arrayBuffer() };
                })
            );

            fetchedFiles.forEach(file => zip.file(file.name, file.data));

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            saveAs(zipBlob, 'vzorove_sablony.zip');
            showNotification('Vzorové súbory boli úspešne stiahnuté.', 'success');

        } catch (error) {
            showErrorModal({
                message: 'Nepodarilo sa stiahnuť vzorové súbory.',
                details: error.message
            });
        } finally {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = originalText;
        }
    }

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
                <div class="modal-tab" data-tab="download"><i class="fas fa-download"></i> Na stiahnutie</div>
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
                            <div class="accordion-header">Prečo je výber okresného úradu zablokovaný?</div>
                            <div class="accordion-content">
                                Aplikácia je navrhnutá tak, aby vás viedla procesom v logickom poradí:
                                <ul>
                                    <li>Krok 1: Vyberte úrad (tento výber sa uzamkne)</li>
                                    <li>Krok 2: Vyberte agendu</li>
                                    <li>Krok 3: Pracujte s dátami a generujte dokumenty</li>
                                </ul>
                                <p style="margin-bottom: 1rem;">Je to bezpečnostné opatrenie, aby ste si boli vedomý, že zmenou úradu prichádzate o rozpracované (nevygenerované) dáta pre predošlý úrad.</p>
                                <p>Ak chcete <b>zmeniť okresný úrad</b>, použite tlačidlo <b>"Resetovať aplikáciu"</b> v ľavom dolnom rohu.</p>
                            </div>
                        </div>
                        <div class="accordion-item">
                            <div class="accordion-header">Aké voľby si pamätá aplikácia, aby zjednodušila opakované používanie?</div>
                            <div class="accordion-content">
                                <b>Posledný vybraný okresný úrad</b>:
                                <ul>
                                    <li>Čo si pamätá? Váš výber okresného úradu (napr. Banská Bystrica, Zvolen atď.).</li>
                                    <li>Kedy si to pamätá? Ihneď, ako vyberiete úrad z ponuky. Pri ďalšej návšteve stránky bude tento úrad automaticky predvolený.</li>
                                </ul>
                                <b>Posledná zvolená agenda</b>:
                                <ul>
                                    <li>Čo si pamätá? Agendu, s ktorou ste naposledy pracovali (napr. Vecné prostriedky, Pracovná povinnosť).</li>
                                    <li>Kedy si to pamätá? Hneď po kliknutí na kartu agendy. Keď sa vrátite do aplikácie a máte už vybraný okresný úrad, automaticky sa načíta táto agenda.</li>
                                </ul>
                                <b>Dokončenie úvodného sprievodcu</b>:
                                <ul>
                                    <li>Čo si pamätá? Informáciu o tom, či ste už prešli alebo zatvorili úvodného sprievodcu aplikáciou.</li>
                                    <li>Kedy si to pamätá? Po dokončení alebo zrušení sprievodcu. Vďaka tomu sa vám sprievodca nezobrazí pri každej návšteve.</li>
                                </ul>
                                <p>Ak chcete <b>začať odznova</b>, použite tlačidlo <b>"Resetovať aplikáciu"</b> v ľavom dolnom rohu.</p>
                            </div>
                        </div>
                        <div class="accordion-item">
                            <div class="accordion-header">Čo si aplikácia nepamätá?</div>
                            <div class="accordion-content">
                                Z bezpečnostných a praktických dôvodov si aplikácia neukladá nasledujúce dáta:
                                <ul>
                                    <li><b>Nahraté .xlsx súbory</b>: Po zatvorení alebo obnovení stránky musíte vstupné súbory nahrať znova.</li>
                                    <li><b>Zadané číslo spisu</b>: Toto pole bude pri novej návšteve prázdne.</li>
                                    <li><b>Spracované dáta ani vygenerované dokumenty</b>: Všetko sa spracúva len dočasne a po opustení stránky sa tieto dáta stratia.</li>
                                </ul>
                            </div>
                        </div>
                        <div class="accordion-item">
                            <div class="accordion-header">Kedy sa pamäť aplikácie vymaže?</div>
                            <div class="accordion-content">
                                Uložené údaje (okresný úrad, agenda, stav sprievodcu) sa vymažú v týchto prípadoch:
                                <ul>
                                    <li>ak kliknete na tlačidlo <b>"Resetovať aplikáciu"</b> v ľavom dolnom rohu</li>
                                    <li>ak manuálne vymažete dáta webových stránok (cache, local storage) vo vašom prehliadači</li>
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
                                Pre viac detailov si pozrite chybové hlásenie, ktoré sa zobrazí, alebo sekciu <b>"Riešenie problémov"</b>.
                            </div>
                        </div>
                    </div>
                </div>

                <div id="tab-download" class="modal-tab-content">
                    <h4 style="margin-bottom: 1.5rem;">Vzorové vstupné súbory</h4>
                    <p>Stlačením tlačidla nižšie si stiahnete ZIP archív obsahujúci vzorové vstupné .xlsx súbory pre všetky agendy. Tieto súbory obsahujú presné názvy stĺpcov, ktoré aplikácia očakáva pre správne spracovanie dát.</p>
                    <div style="text-align: right; margin-top: 1.5rem;">
                        <button id="download-templates-btn" class="btn btn--primary"><i class="fas fa-download"></i> Stiahnuť vzory (.zip)</button>
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

        const downloadBtn = document.getElementById('download-templates-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', handleDownloadTemplates);
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
            setOkresnyUrad(lastOU);
            
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