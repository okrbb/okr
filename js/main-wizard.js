import { OKRESNE_URADY } from './config.js';
import { initFileDropZones, showNotification, showErrorModal, showModal } from './ui.js';
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
};

document.addEventListener('DOMContentLoaded', () => {
    // === DOM ELEMENTY ===
    const agendaCards = document.querySelectorAll('.agenda-card');
    const ouSelect = document.getElementById('okresny-urad');
    const dashboardContent = document.getElementById('dashboard-content');
    const resetAppBtn = document.getElementById('reset-app-btn');
    const helpCenterBtn = document.getElementById('show-help-center');
    const resetTourBtn = document.getElementById('reset-tour-btn');


    // === INICIALIZÁCIA ===
    populateOkresnyUradSelect();
    startGuidedTour();

    // =============================
    // HLAVNÁ LOGIKA A FUNKCIE
    // =============================

    function showWelcomeMessage() {
        dashboardContent.innerHTML = `
            <div class="welcome-message">
                <i class="fas fa-hand-pointer"></i>
                <h2>Vitajte v aplikácii</h2>
                <p>Prosím, v paneli vľavo vyberte okresný úrad a následne agendu, s ktorou chcete pracovať.</p>
            </div>`;
    }

    function resetApp() {
        AppState.selectedOU = null;
        AppState.okresData = null;
        AppState.spis = {};
        AppState.selectedAgendaKey = null;
        AppState.processor = null;
        
        ouSelect.value = '';
        agendaCards.forEach(c => c.classList.remove('active'));
        ouSelect.disabled = false;

        showWelcomeMessage();
        showNotification('Aplikácia bola resetovaná.', 'info');
    }

    function renderAgendaView(agendaKey) {
        const agendaConfig = agendaConfigs[agendaKey];
        if (!agendaConfig) return;

        AppState.selectedAgendaKey = agendaKey;
        
        agendaCards.forEach(card => {
            card.classList.toggle('active', card.dataset.agenda === agendaKey);
        });

        let fileInputsHTML = agendaConfig.dataInputs.map(inputConf => `
            <div class="file-drop-zone">
                <label for="${inputConf.id}">${inputConf.label} <i class="fas fa-check-circle file-icon-success"></i></label>
                <input type="file" id="${inputConf.id}" accept=".xlsx,.xls" class="file-input">
                <span class="file-drop-zone__prompt">Presuňte súbor sem alebo kliknite</span>
            </div>
        `).join('');

        let generatorsHTML = Object.keys(agendaConfig.generators).map(genKey => {
            const genConf = agendaConfig.generators[genKey];
            const isXlsx = genConf.outputType === 'xlsx';
            const buttonText = isXlsx ? 'Exportovať' : 'Generovať';
            return `
                <div class="doc-box">
                    <h4>${genConf.title}</h4>
                    <p class="doc-box__description">${isXlsx ? 'Tento export vygeneruje súbor .xlsx a nevyžaduje šablónu.' : 'Šablóna pre tento dokument sa načíta automaticky.'}</p>
                    <button id="${genConf.buttonId}" class="btn btn--main" data-generator-key="${genKey}" disabled>${buttonText}</button>
                </div>`;
        }).join('');

        dashboardContent.innerHTML = `
            <div class="card">
                <div class="card__header">
                    <h2>${agendaConfig.title}</h2>
                    <div class="selection-summary"><strong>Úrad:</strong> ${AppState.okresData.Okresny_urad}</div>
                </div>
                
                <h3 class="card__subheader">Číslo spisu</h3>
                <div class="card__file-number" style="margin-bottom: 2rem;">
                    <input type="text" id="spis-input" name="spis" placeholder="Zadajte číslo spisu" class="form-input">
                    <button id="save-spis-btn" class="btn btn--secondary">Ulož</button>
                </div>

                <h3 class="card__subheader">Vstupné súbory</h3>
                <div class="card__row" style="margin-bottom: 2rem;">${fileInputsHTML}</div>
                
                <h3 class="card__subheader">Náhľad spracovaných dát</h3>
                <div id="preview-container" class="data-preview"></div>
                
                <h3 class="card__subheader" style="margin-top: 2rem;">Generovanie dokumentov</h3>
                <div id="generators-container" class="card__group">${generatorsHTML}</div>
            </div>
        `;

        initFileDropZones();
        setupSpisInputListeners();
        initializeDocumentProcessor(agendaConfig);
    }
    
    function initializeDocumentProcessor(baseConfig) {
        const fullConfig = {
            sectionPrefix: AppState.selectedAgendaKey,
            appState: AppState,
            dataInputs: baseConfig.dataInputs.map(input => ({
                elementId: input.id, 
                stateKey: input.stateKey
            })),
            previewElementId: 'preview-container',
            dataProcessor: baseConfig.dataProcessor,
            generators: baseConfig.generators
        };

        AppState.processor = new DocumentProcessor(fullConfig);
        AppState.processor.loadTemplates();

        if (AppState.selectedAgendaKey === 'vp') {
            loadPscFile();
        }
    }
    
    async function loadPscFile() {
        try {
            const response = await fetch('TEMP/PSC.xlsx');
            if (!response.ok) throw new Error(`Súbor PSČ sa nepodarilo načítať. Status: ${response.status}`);
            
            const arrayBuffer = await response.arrayBuffer();
            AppState.processor.state.data = AppState.processor.state.data || {};
            AppState.processor.state.data['psc'] = arrayBuffer;
            
            showNotification('Súbor PSČ bol automaticky načitaný.', 'info');
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
        AppState.selectedOU = selectedValue;
        AppState.okresData = OKRESNE_URADY[selectedValue] || null;

        if (selectedValue) {
            showNotification(`Vybraný okresný úrad: ${AppState.okresData.Okresny_urad}`, 'success');
            document.dispatchEvent(new CustomEvent('ou-selected', { detail: AppState }));
            if (AppState.selectedAgendaKey) {
                renderAgendaView(AppState.selectedAgendaKey);
            }
        } else {
            resetApp();
        }
    });

    agendaCards.forEach(card => {
        card.addEventListener('click', () => {
            if (!AppState.selectedOU) {
                showNotification("Najprv prosím vyberte okresný úrad.", "warning");
                return;
            }
            const agendaKey = card.dataset.agenda;
            ouSelect.disabled = true;
            renderAgendaView(agendaKey);
        });
    });

    helpCenterBtn.addEventListener('click', () => {
        const helpCenterContent = `
            <div class="modal-tabs">
                <button class="modal-tab active" data-tab="faq"><i class="fas fa-question-circle"></i> Časté otázky (FAQ)</button>
                <button class="modal-tab" data-tab="guides"><i class="fas fa-book-open"></i> Sprievodcovia</button>
                <button class="modal-tab" data-tab="troubleshooting"><i class="fas fa-wrench"></i> Riešenie problémov</button>
            </div>
            
            <div class="modal-tab-content active" id="tab-faq">
                <div class="faq-item">
                    <h4>Prečo je tlačidlo "Generovať" neaktívne?</h4>
                    <p>Tlačidlo sa aktivuje až po splnení všetkých potrebných krokov:
                        <ol style="margin-left: 20px; margin-top: 0.5rem;">
                            <li>Musí byť vybraný okresný úrad.</li>
                            <li>Musí byť zvolená agenda.</li>
                            <li>Musí byť zadané číslo spisu.</li>
                            <li>Musí byť nahratý platný vstupný .xlsx súbor.</li>
                        </ol>
                    </p>
                </div>
                <div class="faq-item">
                     <h4>Rožlišuje aplikácia §§ pri generovaní rozhodnutí?</h4>
                    <p>Áno, pri rozhodnutiach pre vecné prostriedky a pre ubytovanie aplikácia automaticky vkladá správny "ods. a písm." z § 18 zákona č. 319/2002 Z. z. Na základe prítomnosti lomky "/" v IČO(RČ) alebo prázdnej bunky rozlišuje, či ide o fyzickú osobu (FO - prázdna bunka alebo číslo s /) alebo právnickú osobu (PO/FOP - číslo bez /).</p>
                    <ul style="margin-left: 20px; margin-top: 0.5rem;">
                        <li><b>Pre PO, FOP:</b> ods. 1 písm. d)</li>
                        <li><b>Pre FO:</b> ods. 3 písm. b)</li>
                    </ul>
                </div>
                <div class="faq-item">
                    <h4>V akom tvare sa zadáva číslo spisu?</h4> 
                    <p>Číslo spisu zadávate v tvare: kód okresu, kód odboru, rok, číslo spisu. Napr.: BB-OKR-2025/123456.</p>
                </div>
                <div class="faq-item">
                    <h4>Môžem upraviť vygenerované dokumenty?</h4> 
                    <p>Áno, všetky vygenerované .docx súbory sú plne editovateľné v textovom editore (napr. MS Word).</p>
                </div>
            </div>

            <div class="modal-tab-content" id="tab-guides">
                <p>Tu nájdete presné požiadavky na štruktúru vstupných .xlsx súborov pre každú agendu. <strong>Názvy stĺpcov musia presne sedieť.</strong></p>
                <div class="accordion">
                    <div class="accordion-item">
                        <div class="accordion-header"><i class="fas fa-truck"></i> Vecné prostriedky (VP)</div>
                        <div class="accordion-content">
                            <p>Táto agenda vyžaduje špecifickú štruktúru s <strong>dvojriadkovou hlavičkou</strong>.</p>
                            <h5>Hlavná hlavička (prvý riadok):</h5>
                            <table class="help-table">
                                <thead><tr><th>Povinný stĺpec</th><th>Popis</th></tr></thead>
                                <tbody>
                                    <tr><td><code>P.Č.</code></td><td>Poradové číslo. Kľúčový stĺpec, ktorý musí byť prítomný.</td></tr>
                                    <tr><td><code>DODÁVATEĽ</code></td><td>Názov subjektu (firmy alebo osoby).</td></tr>
                                    <tr><td><code>OKRES</code></td><td>Okres subjektu.</td></tr>
                                    <tr><td><code>PČRD</code></td><td>PČRD (napr. 12345-M).</td></tr>
                                    <tr><td><code>IČO</code></td><td>IČO firmy alebo rodné číslo osoby (formát s lomkou, napr. 123456/7890).</td></tr>
                                    <tr><td><code>TOVÁRENSKÁ ZNAČKA</code></td><td>Značka vozidla (napr. Škoda).</td></tr>
                                    <tr><td><code>DRUH KAROSÉRIE</code></td><td>Typ karosérie (napr. Combi).</td></tr>
                                    <tr><td><code>EČV</code></td><td>Evidenčné číslo vozidla.</td></tr>
                                    <tr><td><code>ÚTVAR</code></td><td>Príslušný útvar.</td></tr>
                                    <tr><td><code>MIESTO DODANIA</code></td><td>Miesto, kam má byť prostriedok dodaný.</td></tr>
                                </tbody>
                            </table>
                            <h5>Pod-hlavička (druhý riadok, priamo pod hlavnou hlavičkou):</h5>
                            <table class="help-table">
                                <thead><tr><th>Povinný stĺpec (pod stĺpcom DODÁVATEĽ)</th><th>Popis</th></tr></thead>
                                <tbody>
                                    <tr><td><code>ULICA</code></td><td>Ulica sídla/bydliska subjektu.</td></tr>
                                    <tr><td><code>Č. POPISNÉ</code></td><td>Popisné číslo.</td></tr>
                                    <tr><td><code>MESTO (OBEC)</code></td><td>Mesto alebo obec.</td></tr>
                                </tbody>
                            </table>
                            <a href="/public/templates/sablona_vp.xlsx" class="btn btn--secondary" download><i class="fas fa-download"></i> Stiahnuť šablónu</a>
                        </div>
                    </div>

                    <div class="accordion-item">
                        <div class="accordion-header"><i class="fas fa-briefcase"></i> Pracovná povinnosť (PP)</div>
                        <div class="accordion-content">
                            <p>Hlavička tabuľky musí začínať v <strong>stĺpci C</strong>. Stĺpce A a B sú ignorované.</p>
                            <table class="help-table">
                                <thead><tr><th>Povinný stĺpec</th><th>Popis</th></tr></thead>
                                <tbody>
                                    <tr><td><code>Por. číslo</code></td><td>Poradové číslo.</td></tr>
                                    <tr><td><code>Titul</code></td><td>Titul osoby (nepovinné).</td></tr>
                                    <tr><td><code>Meno</code></td><td>Meno osoby.</td></tr>
                                    <tr><td><code>Priezvisko</code></td><td>Priezvisko osoby.</td></tr>
                                    <tr><td><code>Miesto pobytu / Adresa trvalého pobytu</code></td><td>Kompletná adresa vrátane PSČ a obce, oddelená čiarkou.</td></tr>
                                    <tr><td><code>Rodné číslo</code></td><td>Rodné číslo osoby.</td></tr>
                                    <tr><td><code>Miesto nástupu k vojenskému útvaru</code></td><td>Textové pole s miestom nástupu.</td></tr>
                                </tbody>
                            </table>
                            <a href="/public/templates/sablona_pp.xlsx" class="btn btn--secondary" download><i class="fas fa-download"></i> Stiahnuť šablónu</a>
                        </div>
                    </div>

                    <div class="accordion-item">
                        <div class="accordion-header"><i class="fas fa-bed"></i> Ubytovanie (UB)</div>
                        <div class="accordion-content">
                            <table class="help-table">
                                <thead><tr><th>Povinný stĺpec</th><th>Popis</th></tr></thead>
                                <tbody>
                                    <tr><td><code>Por. č.</code></td><td>Poradové číslo.</td></tr>
                                    <tr><td><code>obchodné meno alebo názov alebo meno a priezvisko</code></td><td>Názov subjektu poskytujúceho ubytovanie.</td></tr>
                                    <tr><td><code>sídlo alebo miesto pobytu</code></td><td>Adresa subjektu, oddelená čiarkou.</td></tr>
                                    <tr><td><code>IČO alebo rodné číslo</code></td><td>Identifikátor subjektu.</td></tr>
                                    <tr><td><code>názov (identifikácia) nehnuteľnosti</code></td><td>Popis nehnuteľnosti.</td></tr>
                                    <tr><td><code>adresa, na ktorej sa nehnuteľnosť nachádza</code></td><td>Adresa ubytovacieho zariadenia.</td></tr>
                                    <tr><td><code>názov žiadateľa</code></td><td>Subjekt, pre ktorý sa ubytovanie poskytuje.</td></tr>
                                    <tr><td><code>adresa žiadateľa</code></td><td>Adresa žiadateľa.</td></tr>
                                </tbody>
                            </table>
                            <a href="/public/templates/sablona_ub.xlsx" class="btn btn--secondary" download><i class="fas fa-download"></i> Stiahnuť šablónu</a>
                        </div>
                    </div>
                    
                    <div class="accordion-item">
                        <div class="accordion-header"><i class="fas fa-envelopes-bulk"></i> Doručovatelia (DR)</div>
                        <div class="accordion-content">
                            <table class="help-table">
                                <thead><tr><th>Povinný stĺpec</th><th>Popis</th></tr></thead>
                                <tbody>
                                    <tr><td><code>Por. č.</code></td><td>Poradové číslo.</td></tr>
                                    <tr><td><code>Titul, meno a priezvisko</code></td><td>Celé meno doručovateľa.</td></tr>
                                    <tr><td><code>adresa trvalého pobytu</code></td><td>Kompletná adresa vrátane PSČ a obce, oddelená čiarkou.</td></tr>
                                    <tr><td><code>rodné číslo</code></td><td>Rodné číslo doručovateľa.</td></tr>
                                </tbody>
                            </table>
                            <a href="/public/templates/sablona_dr.xlsx" class="btn btn--secondary" download><i class="fas fa-download"></i> Stiahnuť šablónu</a>
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal-tab-content" id="tab-troubleshooting">
                <div class="troubleshooting-item">
                    <h4>Chybové hlásenie: "Nenašiel sa riadok s hlavičkou..."</h4>
                    <p><strong>Príčina:</strong> Aplikácia vo vašom .xlsx súbore nenašla presný názov stĺpca, ktorý potrebuje na spracovanie dát.</p>
                    <p><strong>Riešenie:</strong> Otvorte si váš súbor a skontrolujte, či názvy stĺpcov presne zodpovedajú šablóne v sekcii "Sprievodcovia agendami". Dávajte pozor na preklepy, medzery navyše alebo diakritiku.</p>
                </div>
            </div>
        `;

        const titleHTML = `
            <div class="help-center-header">
                <i class="fas fa-life-ring"></i>
                <div class="title-group">
                    <h3>Centrum nápovedy</h3>
                    <span>Všetko, čo potrebujete vedieť na jednom mieste.</span>
                </div>
            </div>`;

        showModal({
            title: titleHTML,
            content: helpCenterContent
        });
    });

    resetTourBtn.addEventListener('click', () => {
        localStorage.removeItem('krokr-tour-completed');
        showNotification('Sprievodca bol resetovaný a spustí sa.', 'info');
        startGuidedTour();
    });
    
    document.addEventListener('click', (e) => {
        if (e.target.matches('.help-icon') && e.target.dataset.helpTopic === 'agenda-info') {
            const titleHTML = `
                <div class="help-center-header">
                    <i class="fas fa-info-circle"></i>
                    <div class="title-group">
                        <h3>Popis Agend</h3>
                        <span>Prehľad dostupných agend a ich využitie.</span>
                    </div>
                </div>`;
            
            showModal({
                title: titleHTML,
                content: `
                    <ul class="agenda-info-list">
                        <li>
                            <i class="fas fa-truck"></i>
                            <div>
                                <strong>Vecné prostriedky (VP)</strong>
                                <p>Generovanie rozhodnutí a súvisiacich dokumentov pre subjekty poskytujúce vecné prostriedky (napr. vozidlá, techniku) na plnenie úloh obrany štátu v čase vojny alebo vojnového stavu.</p>
                            </div>
                        </li>
                        <li>
                            <i class="fas fa-briefcase"></i>
                            <div>
                                <strong>Pracovná povinnosť (PP)</strong>
                                <p>Generovanie rozhodnutí a súvisiacich dokumentov pre subjekty, ktoré sú povinné plniť pracovnú povinnosť v čase vojny alebo vojnového stavu pre potreby obrany štátu.</p>
                            </div>
                        </li>
                        <li>
                            <i class="fas fa-bed"></i>
                            <div>
                                <strong>Ubytovanie (UB)</strong>
                                <p>Spracovanie podkladov a rozhodnutí pre subjekty povinné poskytnúť v čase vojny alebo vojnového stavu ubytovanie príslušníkom ozbrojených síl.</p>
                            </div>
                        </li>
                        <li>
                            <i class="fas fa-envelopes-bulk"></i>
                            <div>
                                <strong>Doručovatelia (DR)</strong>
                                <p>Agenda pre správu a generovanie dokumentov pre osoby určené na doručovanie písomností.</p>
                            </div>
                        </li>
                    </ul>
                `
            });
        }
    });

    resetAppBtn.addEventListener('click', () => {
        if (confirm("Naozaj chcete resetovať aplikáciu? Stratíte všetky neuložené dáta.")) {
            resetApp();
        }
    });

    function setupSpisInputListeners() {
        const spisInput = document.getElementById('spis-input');
        const saveSpisBtn = document.getElementById('save-spis-btn');
        if (!spisInput || !saveSpisBtn) return;

        if (AppState.spis[AppState.selectedAgendaKey]) {
            spisInput.value = AppState.spis[AppState.selectedAgendaKey];
        }

        const saveFileNumber = () => {
            const value = spisInput.value.trim();
            const key = AppState.selectedAgendaKey;

            if (value && key) {
                const newValue = value === "0" ? " " : value;
                if (AppState.spis[key] !== newValue) {
                    AppState.spis[key] = newValue;
                    showNotification(`Číslo spisu "${AppState.spis[key]}" pre agendu ${key.toUpperCase()} bolo uložené.`, 'success');
                    if (AppState.processor) {
                        AppState.processor.checkAllButtonsState();
                    }
                }
            }
        };

        saveSpisBtn.addEventListener('click', saveFileNumber);
        spisInput.addEventListener('blur', saveFileNumber);
        spisInput.addEventListener('keyup', (e) => e.key === 'Enter' && saveFileNumber());
    }
});

// === POMOCNÉ FUNKCIE ===
function populateOkresnyUradSelect() {
    const select = document.getElementById('okresny-urad');
    if (!select) return;
    Object.keys(OKRESNE_URADY).forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = OKRESNE_URADY[key].Okresny_urad;
        select.appendChild(option);
    });
}