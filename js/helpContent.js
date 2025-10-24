// js/helpContent.js

/**
 * Statický HTML obsah pre Centrum nápovedy.
 * Vyčlenené pre lepšiu čitateľnosť a údržbu.
 */

// --- Súkromné konštanty pre obsah tabov ---

const FAQ_HTML = `
<div id="tab-faq" class="agenda-tab-content active" style="max-width: 800px; margin: 0 auto;">
    <div class="accordion-group">
        <div class="accordion-card">
            <div class="accordion-header">
                <span><i class="fas fa-question-circle accordion-header-icon"></i> Prečo sú tlačidlá "Generovať" neaktívne?</span>
                <i class="fas fa-chevron-down accordion-header-icon"></i>
            </div>
            <div class="accordion-content">
                Tlačidlá na karte "Generovanie" sa automaticky aktivujú, keď sú splnené všetky nasledujúce podmienky:
                <ul>
                    <li>je vybraný okresný úrad</li>
                    <li>je zvolená agenda</li>
                    <li>je zadané a uložené <b>číslo spisu</b></li>
                    <li>na karte "Spracovanie" je nahratý a úspešne spracovaný <b>vstupný .xlsx súbor</b></li>
                </ul>
            </div>
        </div>
        <div class="accordion-card">
            <div class="accordion-header">
                <span><i class="fas fa-question-circle accordion-header-icon"></i> Prečo nie je výber okresného úradu zablokovaný?</span>
                <i class="fas fa-chevron-down accordion-header-icon"></i>
            </div>
            <div class="accordion-content">
                Aplikácia vám umožňuje prepínať medzi okresnými úradmi.
                <p style="margin: 1rem 0;"><b>POZOR:</b> Ak máte rozpracované dáta (nahraté súbory alebo zadaný spis) a zmeníte OÚ, aplikácia vás upozorní. Ak zmenu potvrdíte, <b>prídete o všetky rozpracované dáta</b> pre predchádzajúci OÚ.</p>
            </div>
        </div>
        <div class="accordion-card">
            <div class="accordion-header">
                <span><i class="fas fa-question-circle accordion-header-icon"></i> Aké voľby si pamätá aplikácia?</span>
                <i class="fas fa-chevron-down accordion-header-icon"></i>
            </div>
            <div class="accordion-content">
                <ul>
                    <li><b>Číslo spisu:</b> Pre každú agendu si aplikácia pamätá zadané číslo spisu, kým ho manuálne nezmeníte alebo neresetujete aplikáciu.</li>
                    <li>Posledný vybraný okresný úrad.</li>
                    <li>Posledná zvolená agenda.</li>
                    <li>Dokončenie úvodného sprievodcu.</li>
                </ul>
            </div>
        </div>
        <div class="accordion-card">
            <div class="accordion-header">
                <span><i class="fas fa-question-circle accordion-header-icon"></i> Kde nájdem tlačidlo na odoslanie mailov obciam?</span>
                <i class="fas fa-chevron-down accordion-header-icon"></i>
            </div>
            <div class="accordion-content">
                Táto funkcia je dostupná len pre agendu <b>Vecné prostriedky</b>.
                <ol style="padding-left: 20px; margin-top: 1rem;">
                    <li>Prepnite sa na kartu <b>"Generovanie"</b>.</li>
                    <li>Nájdite generátor <b>"Export zoznamov pre obce"</b>.</li>
                    <li>Najprv musíte kliknúť na tlačidlo "Exportovať (.xlsx)".</li>
                    <li>Po dokončení exportu sa hneď pod týmto tlačidlom automaticky objaví tlačidlo <b>"Pripraviť e-maily obciam"</b>.</li>
                </ol>
            </div>
        </div>
    </div>
</div>
`;

const DOWNLOAD_TAB_HTML = (downloadListHTML) => `
<div id="tab-download" class="agenda-tab-content" style="max-width: 800px; margin: 0 auto;">
    <p style="margin-bottom: 1.5rem;">Tu si môžete stiahnuť vzorové vstupné .xlsx súbory. Obsahujú presné názvy stĺpcov, ktoré aplikácia očakáva pre správne spracovanie dát.</p>
    <ul class="download-list">
        ${downloadListHTML}
    </ul>
</div>
`;

const TROUBLESHOOTING_HTML = `
<div id="tab-troubleshooting" class="agenda-tab-content" style="max-width: 800px; margin: 0 auto;">
    <div class="accordion-group">
        <div class="accordion-card">
            <div class="accordion-header">
                <span><i class="fas fa-wrench accordion-header-icon"></i> Chyba: "Nenašiel sa riadok s hlavičkou..."</span>
                <i class="fas fa-chevron-down accordion-header-icon"></i>
            </div>
            <div class="accordion-content">
                Táto chyba znamená, že aplikácia vo vašom .xlsx súbore nenašla očakávané názvy stĺpcov. Uistite sa, že stĺpce v súbore, ktorý nahrávate, majú presne rovnaké názvy ako v pripravenej predlohe pre danú agendu. Dajte pozor na preklepy, medzery navyše alebo skryté znaky.
            </div>
        </div>
            <div class="accordion-card">
            <div class="accordion-header">
                <span><i class="fas fa-wrench accordion-header-icon"></i> Náhľad dát zobrazuje nezmyselné hodnoty.</span>
                <i class="fas fa-chevron-down accordion-header-icon"></i>
            </div>
            <div class="accordion-content">
                Skontrolujte, či vo vašom .xlsx súbore nemáte zlúčené bunky. Aplikácia vyžaduje, aby každá informácia bola vo vlastnej, samostatnej bunke. Taktiež sa uistite, že dáta začínajú hneď pod riadkom s hlavičkou a nepredchádzajú im žiadne prázdne riadky.
            </div>
        </div>
    </div>
</div>
`;


/**
 * Exportovaná funkcia, ktorá generuje kompletný HTML kód pre Centrum nápovedy.
 * @param {object} params - Objekt obsahujúci dynamické dáta.
 * @param {string} params.okresName - Názov aktuálne vybraného OÚ.
 * @param {string} params.downloadListHTML - HTML reťazec pre zoznam súborov na stiahnutie.
 * @returns {string} - Kompletný HTML reťazec.
 */
export function getHelpCenterHTML({ okresName, downloadListHTML }) {
    const title = `Centrum nápovedy`;

    return `
        <div class="content-header">
            <h2><i class="fas fa-life-ring" style="color: var(--primary-color);"></i> ${title}</h2>
            <div class="header-meta">
                <div class="selection-summary">
                    <strong>Okresný úrad:</strong> ${okresName}
                </div>
            </div>
        </div>

        <div class="agenda-tabs-container">
            <button class="agenda-tab active" data-tab="faq"><i class="fas fa-question-circle"></i> Časté otázky</button>
            <button class="agenda-tab" data-tab="download"><i class="fas fa-download"></i> Na stiahnutie</button>
            <button class="agenda-tab" data-tab="troubleshooting"><i class="fas fa-wrench"></i> Riešenie problémov</button>
        </div>

        <div class="agenda-tab-content-wrapper">
            
            ${FAQ_HTML}

            ${DOWNLOAD_TAB_HTML(downloadListHTML)}

            ${TROUBLESHOOTING_HTML}
            
        </div>
    `;
}