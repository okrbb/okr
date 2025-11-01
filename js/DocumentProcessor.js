// js/DocumentProcessor.js

// === ZMENA: Importujeme Asistenta namiesto showNotification ===
import { Asistent, toggleSpinner, showErrorModal, setButtonState } from './ui.js';
// === NOVÝ IMPORT ===
import { validateRow } from './Validator.js';

export class DocumentProcessor {
    constructor(config) {
        this.config = config;
        this.state = {
            data: {},
            templates: {}, // Tento objekt sa teraz bude plniť postupne
            processedData: null,
            // === NOVÝ STAV ===
            hasValidationErrors: false, // Flag pre blokovanie generovania
            // ===================
            // Ponechávame referenciu pre checkAllButtonsState
            appState: config.appState, 
        };
        
        // === ZMENA: Pridané bindovanie pre nové metódy ===
        this._showPreviewSkeleton = this._showPreviewSkeleton.bind(this);
        this._restoreEmptyState = this._restoreEmptyState.bind(this);
        // === KONIEC ZMENY ===
    }

    /**
     * === ZMENA: Optimalizácia výkonu ===
     * Táto metóda sa už nebude starať o načítavanie všetkých šablón naraz.
     * Ponechávame ju prázdnu pre zachovanie kompatibility s volaním v main-wizard.js.
     * Šablóny sa teraz načítavajú "lenivo" (lazy-loading) až priamo pri generovaní.
     */
    async loadTemplates() {
        // Tento blok je zámerne prázdny.
        this.checkAllButtonsState(); // Skontrolujeme stav tlačidiel po inicializácii
    }

    /**
     * === NOVÉ: Privátna metóda pre Lazy Loading ===
     * Zabezpečí, že konkrétna šablóna je načítaná. Ak nie je v pamäti, načíta ju.
     * @param {string} templateKey - Kľúč šablóny (napr. 'rozhodnutia').
     * @param {string} templatePath - Cesta k súboru šablóny.
     */
    async _ensureTemplateLoaded(templateKey, templatePath) {
        // Ak šablóna už existuje v stave, nerobíme nič.
        if (this.state.templates[templateKey]) {
            return;
        }

        toggleSpinner(true);
        // === ZMENA: Použitie Asistenta ===
        Asistent.log(`Pripravuje sa šablóna: ${templateKey}...`);

        try {
            const response = await fetch(templatePath);
            if (!response.ok) {
                throw new Error(`Šablónu sa nepodarilo nájsť na ceste: ${templatePath} (Status: ${response.status})`);
            }
            const buffer = await response.arrayBuffer();
            this.state.templates[templateKey] = new Uint8Array(buffer);
            Asistent.success(`Šablóna '${templateKey}' je pripravená.`);
        } catch (error) {
            // === ZMENA: Použitie Asistenta ===
            Asistent.error(`Chyba pri načítaní šablóny '${templateKey}'`, error.message);
            showErrorModal({ message: `Nastala kritická chyba pri načítaní šablóny '${templateKey}'.`, details: error.message });
            throw error; // Znovu vyhodíme chybu, aby sa proces generovania zastavil
        } finally {
            toggleSpinner(false);
        }
    }
    
    async processFile(file, stateKey) {
        if (!file) return;
        try {
            const arrayBuffer = await file.arrayBuffer();
            this.state.data[stateKey] = arrayBuffer;
            this.checkAndProcessData(); 
        } catch (error) {
             // === ZMENA: Použitie Asistenta ===
             Asistent.error(`Chyba pri načítaní súboru ${file.name}`, error.message);
             showErrorModal({ message: `Chyba pri načítaní súboru ${file.name}: ${error.message}` });
        }
        this.checkAllButtonsState();
    }
    
    checkAndProcessData() {
        const allDataLoaded = this.config.dataInputs.every(dc => this.state.data && this.state.data[dc.stateKey]);
        if (allDataLoaded) {
            this.processData();
        }
    }

    // === ZMENA: Použitie Skeleton Loadingu namiesto Global Spinnera ===
    processData() {
        if (!this.config.dataProcessor) {
            // === ZMENA: Použitie Asistenta ===
            Asistent.error('Pre túto sekciu nie je definované spracovanie dát.');
            return;
        }
        
        this.state.processedData = null;
        this.state.hasValidationErrors = false; // Reset chýb
        
        // Krok 1: Zobrazíme Skeleton UI
        this._showPreviewSkeleton();
        
        // Krok 2: Dáme UI čas na prekreslenie a potom spustíme spracovanie
        setTimeout(() => {
            try {
                // === ZMENA: Použitie Asistenta ===
                Asistent.log('Spracovávam dáta zo súborov...');
                this.state.processedData = this.config.dataProcessor(this.state.data);
                this.displayPreview(); // Nahrádza skeleton reálnymi dátami
                
                // === ZMENA: Hlásenie Asistentovi sa presunulo do displayPreview ===
                
                if (this.config.onDataProcessed) {
                    this.config.onDataProcessed();
                }
            } catch (error) {
                // === ZMENA: Použitie Asistenta ===
                Asistent.error(`Nastala chyba pri spracovaní dát: ${error.message}`, error.stack);
                showErrorModal({
                    message: `Nastala chyba pri spracovaní dát: ${error.message}`,
                    details: error.stack
                });
                // Ak nastane chyba, vrátime sa k pôvodnému prázdnemu stavu
                this._restoreEmptyState();
            } finally {
                // Krok 3: Aktualizujeme stav tlačidiel
                this.checkAllButtonsState();
            }
        }, 50); // 50ms stačí na prekreslenie UI
    }
    // === KONIEC ZMENY ===
    
    displayPreview() {
        const previewContainer = document.getElementById(this.config.previewElementId);
        if (!previewContainer || !this.state.processedData || this.state.processedData.length < 1) return;

        const data = this.state.processedData;
        const headers = data[0];
        const rows = data.slice(1);
        const columnMap = this.createColumnMap(headers);
        
        let issuesCount = 0;
        let tableHTML = '<table><thead><tr>';
        headers.forEach(h => tableHTML += `<th>${h}</th>`);
        tableHTML += '</tr></thead><tbody>';

        // === NOVÉ: Pole na zber chýb pre Asistenta ===
        const errorDetailsForAssistant = [];
        const MAX_ERRORS_TO_LOG = 10; // Maximálny počet chýb na výpis do Asistenta
        // ===========================================

        rows.forEach((row, index) => {
            let rowIssues = [];
            
            // === ZAČIATOK KĽÚČOVEJ ZMENY: Nová validácia ===
            const validationErrors = validateRow(this.config.sectionPrefix, row, columnMap);
            rowIssues.push(...validationErrors);
            // === KONIEC KĽÚČOVEJ ZMENY ===
            
            const isError = rowIssues.length > 0;
            if (isError) {
                issuesCount++;
                // === NOVÉ: Zbieranie chýb pre Asistenta ===
                if (errorDetailsForAssistant.length < MAX_ERRORS_TO_LOG) {
                    errorDetailsForAssistant.push({
                        // Riadok v Exceli je o 2 viac (1 hlavička + 1 indexovanie od 0)
                        // Ale pre používateľa je lepšie číslo riadku v tabuľke (index + 1)
                        rowNum: index + 1,
                        errors: validationErrors
                    });
                }
                // =======================================
            }
            
            tableHTML += `<tr class="${isError ? 'row-error' : ''}" title="${rowIssues.join('\n')}" style="--row-index: ${index};">`;
            
            headers.forEach((_, index) => {
                tableHTML += `<td>${row[index] || ''}</td>`;
            });
            tableHTML += '</tr>';
        });

        tableHTML += '</tbody></table>';

        const headerHTML = `
            <div class="data-preview-header">
                <span><i class="fas fa-list-ol"></i> Počet záznamov: <strong>${rows.length}</strong></span>
                <span style="margin-left: 20px;" class="${issuesCount > 0 ? 'text-danger' : ''}"><i class="fas fa-exclamation-triangle"></i> Potenciálne problémy: <strong>${issuesCount}</strong></span>
            </div>
        `;
        
        previewContainer.innerHTML = headerHTML + `<div class="data-preview-table-wrapper">${tableHTML}</div>`;
        
        // === NOVÉ: Hlásenie Asistentovi o výsledku kontroly ===
        this.state.hasValidationErrors = issuesCount > 0; // Nastavenie flagu

        if (issuesCount > 0) {
            Asistent.warn(`Asistent našiel ${issuesCount} chýb v dátach. Generovanie je zablokované, kým sa chyby neopravia.`);
            // Vypísanie detailov chýb
            errorDetailsForAssistant.forEach(detail => {
                Asistent.error(`Riadok ${detail.rowNum}: ${detail.errors.join(', ')}`);
            });
            if (issuesCount > MAX_ERRORS_TO_LOG) {
                Asistent.log(`...a ďalších ${issuesCount - MAX_ERRORS_TO_LOG} chýb (zobrazuje sa prvých ${MAX_ERRORS_TO_LOG}).`);
            }
        } else {
            Asistent.success('Dáta boli úspešne spracované. Neboli nájdené žiadne chyby.');
        }
        // === KONIEC ===
    }

    // === ZMENA: `checkAllButtonsState` teraz kontroluje aj `hasValidationErrors` ===
    checkAllButtonsState() {
        Object.keys(this.config.generators).forEach(key => {
            const generatorConfig = this.config.generators[key];
            const btn = document.getElementById(generatorConfig.buttonId);
            if(btn) {
                const dataProcessed = !!this.state.processedData;
                const hasErrors = this.state.hasValidationErrors; // Nový flag
                const spisFilled = !!this.state.appState.spis; 
                const ouSelected = !!this.state.appState.selectedOU;

                // Generovanie je pripravené, LEN AK nie sú chyby
                const isReady = dataProcessed && spisFilled && ouSelected && !hasErrors;
                
                btn.disabled = !isReady;
                btn.classList.toggle('ready', isReady);
            }
        });
    }
    // === KONIEC ZMENY ===
    
    // ... (Metódy generateRowByRow, generateInBatches, generateByGroup zostávajú bezo zmeny) ...
    // ... (Tu preskočený kód pre stručnosť, ale je prítomný v súbore) ...
    
    // === ZAČIATOK KĽÚČOVEJ ZMENY (REFAKTORING) ===
    async generateRowByRow(generatorKey, context) {
    // === KONIEC KĽÚČOVEJ ZMENY (REFAKTORING) ===
        const generator = this.config.generators[generatorKey];
        const button = document.getElementById(generator.buttonId);
        
        const originalButtonText = button.querySelector('.btn-text')?.textContent || (generator.outputType === 'xlsx' ? 'Exportovať (.xlsx)' : 'Generovať (.docx)');

        const docBox = button.closest('.doc-box');
        
        // --- ODSTRÁNENÁ LOGIKA PRE PROGRESS BAR A PROGRESS FILL ---

        if (!this.state.processedData || this.state.processedData.length === 0) {
            // === ZMENA: Použitie Asistenta ===
            Asistent.error('Dáta neboli spracované. Najprv prosím nahrajte vstupné súbory.');
            showErrorModal({ message: 'Dáta neboli spracované. Najprv prosím nahrajte vstupné súbory.' });
            return;
        }

        // === NOVÁ KONTROLA ===
        if (this.state.hasValidationErrors) {
            Asistent.error('Generovanie zablokované. V dátach sú stále chyby.');
            showErrorModal({ message: 'Generovanie nie je možné spustiť, kým sú v dátach chyby (označené červenou v náhľade).' });
            return;
        }
        // =======================
        
        // Nastavenie loading s pôvodným textom.
        setButtonState(button, 'loading', originalButtonText); 

        if (docBox) {
            docBox.classList.remove('is-success', 'is-error');
        }

        try {
            if (generator.templateKey && generator.templatePath) {
                await this._ensureTemplateLoaded(generator.templateKey, generator.templatePath);
            }

            const dataRows = this.state.processedData.slice(1);
            const headerRow = this.state.processedData[0];
            const columnMap = this.createColumnMap(headerRow);
            
            const zip = new JSZip();
            
            const dataLength = dataRows.length;
            
            // --- ODSTRÁNENÁ LOGIKA PRE PROGRESS BAR, POUŽÍVAME JEDNODUCHÝ SPIN ---
            
            // === ZMENA: Pridanie pauzy pre responzívnosť UI ===
            const pauseDuration = 1; // 1ms pauza
            const pauseBatchSize = 20; // Každých 20 dokumentov
            // === KONIEC ZMENY ===

            for (let i = 0; i < dataLength; i++) {
                const row = dataRows[i];
                if (this.isRowEmpty(row)) continue;

                // === ZAČIATOK KĽÚČOVEJ ZMENY (REFAKTORING) ===
                // Namiesto appState posielame čistý kontext
                const templateData = generator.dataMapper({ row, columnMap, ...context, index: i });
                // === KONIEC KĽÚČOVEJ ZMENY (REFAKTORING) ===

                const templateContent = this.state.templates[generator.templateKey];
                if (!templateContent) throw new Error(`Chýba šablóna pre: ${generator.title}`);
                
                const doc = this.createDocxtemplater(templateContent);
                doc.render(templateData);

                const outputBuffer = doc.getZip().generate({ type: 'uint8array' });
                const fileName = generator.fileNameGenerator(templateData, i);
                zip.file(fileName, outputBuffer);
                
                // === ZMENA: Vloženie pauzy po dávke ===
                if ((i + 1) % pauseBatchSize === 0 && i + 1 < dataLength) {
                    // Aktualizujeme text tlačidla, aby používateľ videl progres
                    const btnTextSpan = button.querySelector('.btn-text');
                    if(btnTextSpan) {
                        btnTextSpan.textContent = `Generujem... (${i + 1}/${dataLength})`;
                    }
                    // Uvoľníme vlákno
                    await new Promise(r => setTimeout(r, pauseDuration));
                }
                // === KONIEC ZMENY ===
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            saveAs(zipBlob, generator.zipName);
            // === ZMENA: Použitie Asistenta ===
            Asistent.success(`${generator.title} bolo úspešne dokončené!`);

            // --- KĽÚČOVÁ ZMENA: Nastavíme stav na úspech, text sa NEMENÍ ---
            setButtonState(button, 'success', originalButtonText); 
            
            if (docBox) {
                docBox.classList.remove('is-processing');
            }

        } catch (error) {
             // === ZMENA: Použitie Asistenta ===
             Asistent.error(`Chyba pri generovaní (row): ${error.message}`, error.stack);
             showErrorModal({ message: `Chyba pri generovaní dokumentov: ${error.message}`, details: error.stack });
             if (docBox) {
                docBox.classList.remove('is-processing');
             }
             setButtonState(button, 'reset', originalButtonText);
        } finally {
            // Resetuje tlačidlo do pôvodného stavu (po krátkom zobrazení úspechu)
            if (button.classList.contains('is-success')) {
                setTimeout(() => {
                    // KĽÚČOVÉ: Vrátime tlačidlo na pôvodnú farbu a stav (oranžový/zelený)
                    setButtonState(button, 'reset', originalButtonText); 
                }, 1000); // 1 sekunda trvania zeleného stavu
            } else if (button.classList.contains('is-loading')) { // Ak proces zlyhal skôr, než skončil
                setButtonState(button, 'reset', originalButtonText);
            }
        }
    }
    
    // === ZAČIATOK KĽÚČOVEJ ZMENY (REFAKTORING) ===
    async generateInBatches(generatorKey, context) {
    // === KONIEC KĽÚČOVEJ ZMENY (REFAKTORING) ===
        const generator = this.config.generators[generatorKey];
        const button = document.getElementById(generator.buttonId);

        const originalButtonText = button.querySelector('.btn-text')?.textContent || (generator.outputType === 'xlsx' ? 'Exportovať (.xlsx)' : 'Generovať (.docx)');

        const docBox = button.closest('.doc-box');

        if (!this.state.processedData || this.state.processedData.length === 0) {
            // === ZMENA: Použitie Asistenta ===
            Asistent.error('Dáta neboli spracované. Najprv prosím nahrajte vstupné súbory.');
            showErrorModal({ message: 'Dáta neboli spracované. Najprv prosím nahrajte vstupné súbory.' });
            return;
        }
        
        // === NOVÁ KONTROLA ===
        if (this.state.hasValidationErrors) {
            Asistent.error('Generovanie zablokované. V dátach sú stále chyby.');
            showErrorModal({ message: 'Generovanie nie je možné spustiť, kým sú v dátach chyby (označené červenou v náhľade).' });
            return;
        }
        // =======================
        
        // Nastavenie loading s pôvodným textom.
        setButtonState(button, 'loading', originalButtonText); 
        
        if (docBox) {
            docBox.classList.remove('is-success', 'is-error');
        }
        
        try {
            if (generator.templateKey && generator.templatePath) {
                await this._ensureTemplateLoaded(generator.templateKey, generator.templatePath);
            }

            const dataRows = this.state.processedData.slice(1);
            const headerRow = this.state.processedData[0];
            const columnMap = this.createColumnMap(headerRow);
            const batchSize = generator.batchSize || 8;
            const totalBatches = Math.ceil(dataRows.length / batchSize);
            
            const zip = new JSZip();
            const pauseDuration = 20; 

            for (let i = 0; i < totalBatches; i++) {
                const batchStart = i * batchSize;
                const batchEnd = batchStart + batchSize;
                const batch = dataRows.slice(batchStart, batchEnd);

                // === ZAČIATOK KĽÚČOVEJ ZMENY (REFAKTORING) ===
                const templateData = generator.dataMapper({ batch, columnMap, ...context, batchIndex: i });
                // === KONIEC KĽÚČOVEJ ZMENY (REFAKTORING) ===
                
                const templateContent = this.state.templates[generator.templateKey];
                if (!templateContent) throw new Error(`Chýba šablóna pre: ${generator.title}`);
                
                const doc = this.createDocxtemplater(templateContent);
                doc.render(templateData);

                const outputBuffer = doc.getZip().generate({ type: 'uint8array' });
                const fileName = generator.fileNameGenerator(templateData, i);
                zip.file(fileName, outputBuffer);
                
                await new Promise(r => setTimeout(r, pauseDuration));
            }
            
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            saveAs(zipBlob, generator.zipName);
            // === ZMENA: Použitie Asistenta ===
            Asistent.success(`${generator.title} bolo úspešne dokončené!`);

            // --- KĽÚČOVÁ ZMENA: Nastavíme stav na úspech, text sa NEMENÍ ---
            setButtonState(button, 'success', originalButtonText); 
            
            if (docBox) {
                docBox.classList.remove('is-processing');
            }

        } catch (error) {
             // === ZMENA: Použitie Asistenta ===
             Asistent.error(`Chyba pri generovaní (batch): ${error.message}`, error.stack);
             showErrorModal({ message: `Chyba pri generovaní dokumentov: ${error.message}`, details: error.stack });
             if (docBox) {
                docBox.classList.remove('is-processing');
             }
             setButtonState(button, 'reset', originalButtonText);
        } finally {
             // Resetuje tlačidlo do pôvodného stavu (po krátkom zobrazení úspechu)
            if (button.classList.contains('is-success')) {
                setTimeout(() => {
                    // KĽÚČOVÉ: Vrátime tlačidlo na pôvodnú farbu a stav
                    setButtonState(button, 'reset', originalButtonText); 
                }, 1000); // 1 sekunda trvania zeleného stavu
            } else if (button.classList.contains('is-loading')) { // Ak proces zlyhal skôr, než skončil
                setButtonState(button, 'reset', originalButtonText);
            }
        }
    }

    // === ZAČIATOK KĽÚČOVEJ ZMENY (REFAKTORING) ===
    async generateByGroup(generatorKey, context) {
    // === KONIEC KĽÚČOVEJ ZMENY (REFAKTORING) ===
        const generator = this.config.generators[generatorKey];
        const button = document.getElementById(generator.buttonId);
        const originalButtonText = button.querySelector('.btn-text')?.textContent || (generator.outputType === 'xlsx' ? 'Exportovať (.xlsx)' : 'Generovať (.docx)');
        
        const docBox = button.closest('.doc-box');

        if (!this.state.processedData || this.state.processedData.length === 0) {
            // === ZMENA: Použitie Asistenta ===
            Asistent.error('Dáta neboli spracované. Najprv prosím nahrajte vstupné súbory.');
            showErrorModal({ message: 'Dáta neboli spracované. Najprv prosím nahrajte vstupné súbory.' });
            return;
        }

        // === NOVÁ KONTROLA ===
        if (this.state.hasValidationErrors) {
            Asistent.error('Generovanie zablokované. V dátach sú stále chyby.');
            showErrorModal({ message: 'Generovanie nie je možné spustiť, kým sú v dátach chyby (označené červenou v náhľade).' });
            return;
        }
        // =======================

        // Nastavenie loading s pôvodným textom.
        setButtonState(button, 'loading', originalButtonText); 

        if (docBox) {
            docBox.classList.remove('is-success', 'is-error');
        }
        
        try {
            if (generator.templateKey && generator.templatePath) {
                await this._ensureTemplateLoaded(generator.templateKey, generator.templatePath);
            }
        
            const dataRows = this.state.processedData.slice(1);
            const headerRow = this.state.processedData[0];
            const columnMap = this.createColumnMap(headerRow);
            const groupByColumn = generator.groupByColumn;
            
            if (columnMap[groupByColumn] === undefined) {
                throw new Error(`Chýbajúci stĺpec pre zoskupenie: '${groupByColumn}'`);
            }

            const groupedData = dataRows.reduce((acc, row) => {
                const key = row[columnMap[groupByColumn]] || 'Nezaradené';
                if (!acc[key]) acc[key] = [];
                acc[key].push(row);
                return acc;
            }, {});

            const zip = new JSZip();
            const totalGroups = Object.keys(groupedData).length;
            
            const pauseDuration = 20; 
            
            // === ZMENA: Volanie callbacku na resetovanie stavu mailov ===
            if (generatorKey === 'zoznamyObce' && this.config.onMailGenerationStart) {
                this.config.onMailGenerationStart();
            }
            // ========================================================

            for (const groupKey in groupedData) {
                const groupRows = groupedData[groupKey];
                
                // === ZAČIATOK KĽÚČOVEJ ZMENY (REFAKTORING) ===
                const templateData = generator.dataMapper({ groupRows, columnMap, groupKey, ...context });
                // === KONIEC KĽÚČOVEJ ZMENY (REFAKTORING) ===
                
                const fileName = generator.fileNameGenerator(templateData, 0);

                if (generator.outputType === 'xlsx') {
                    // ... (XLSX logika bezo zmeny) ...
                    const excelData = templateData;
                    const ws = XLSX.utils.json_to_sheet(excelData.data);
                    ws['!cols'] = excelData.cols;
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, 'Zoznam');
                    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                    zip.file(fileName, excelBuffer);

                    // ... (logika pre maily bezo zmeny) ...
                    if (generatorKey === 'zoznamyObce') {
                        const headers = Object.keys(excelData.data[0]);
                        const tableHeader = headers.map(h => `<th style="border: 1px solid #dddddd; text-align: left; padding: 8px;">${h}</th>`).join('');
                        const tableRows = excelData.data.map(row => {
                            const cells = headers.map(h => `<td style="border: 1px solid #dddddd; text-align: left; padding: 8px;">${row[h]}</td>`).join('');
                            return `<tr>${cells}</tr>`;
                        }).join('');
                        
                        // === ZAČIATOK ZMENY: Oddelenie šablóny e-mailu ===
                        const tableHTML = `
                            <table style="width: 100%; border-collapse: collapse; font-family: sans-serif; font-size: 14px;">
                                <thead>
                                    <tr style="background-color: #f2f2f2;">
                                        ${tableHeader}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableRows}
                                </tbody>
                            </table>
                        `;
                        
                        // Použije šablónu z configu, ak existuje, inak pošle len tabuľku
                        const mailBody = (typeof generator.emailTemplate === 'function') 
                            ? generator.emailTemplate(tableHTML) 
                            : tableHTML;
                        // === KONIEC ZMENY ===
                        
                        // === ZMENA: Volanie callbacku namiesto priameho zápisu ===
                        if (this.config.onMailDataGenerated) {
                            const mailData = {
                                html: mailBody,
                                count: groupRows.length
                            };
                            this.config.onMailDataGenerated(groupKey, mailData);
                        }
                        // =======================================================
                    }
                } else {
                    // ... (DOCX logika bezo zmeny) ...
                    const templateContent = this.state.templates[generator.templateKey];
                    if (!templateContent) throw new Error(`Chýba šablóna pre: ${generator.title}`);
                    
                    const doc = this.createDocxtemplater(templateContent);
                    doc.render(templateData);
                    const outputBuffer = doc.getZip().generate({ type: 'uint8array' });
                    zip.file(fileName, outputBuffer);
                }
                
                await new Promise(r => setTimeout(r, pauseDuration));
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            saveAs(zipBlob, generator.zipName);
            
            // === ZMENA: Volanie callbacku o dokončení ===
            if (generatorKey === 'zoznamyObce' && this.config.onMailGenerationComplete) {
                this.config.onMailGenerationComplete();
                // Odstránené volanie this.config.onDataProcessed();
            }
            // =========================================

            // === ZMENA: Použitie Asistenta ===
            Asistent.success(`${generator.title} bolo úspešne dokončené!`);

            // --- KĽÚČOVÁ ZMENA: Nastavíme stav na úspech, text sa NEMENÍ ---
            setButtonState(button, 'success', originalButtonText); 

            if (docBox) {
                docBox.classList.remove('is-processing');
            }

        } catch (error) {
             // === ZMENA: Použitie Asistenta ===
             Asistent.error(`Chyba pri generovaní (group): ${error.message}`, error.stack);
             showErrorModal({ message: `Chyba pri generovaní dokumentov: ${error.message}`, details: error.stack });
             if (docBox) {
                docBox.classList.remove('is-processing');
             }
             setButtonState(button, 'reset', originalButtonText);
        } finally {
            // Resetuje tlačidlo do pôvodného stavu (po krátkom zobrazení úspechu)
            if (button.classList.contains('is-success')) {
                setTimeout(() => {
                    // KĽÚČOVÉ: Vrátime tlačidlo na pôvodnú farbu a stav
                    setButtonState(button, 'reset', originalButtonText); 
                }, 1000); // 1 sekunda trvania zeleného stavu
            } else if (button.classList.contains('is-loading')) { // Ak proces zlyhal skôr, než skončil
                setButtonState(button, 'reset', originalButtonText);
            }
        }
    }

    createColumnMap(headerRow) {
        const map = {};
        if (!headerRow) return map;
        headerRow.forEach((header, index) => {
            if (header) map[header.trim()] = index;
        });
        return map;
    }

    isRowEmpty(row) {
        return !row || row.every(cell => cell === null || String(cell).trim() === '');
    }
    
    createDocxtemplater(templateContent) {
        const zip = new PizZip(templateContent);
        return new window.docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            nullGetter: () => "",
            delimiters: {
                start: '{{',
                end: '}}'
            }
        });
    }
    
    // === NOVÁ POMOCNÁ METÓDA PRE SKELETON ===
    _showPreviewSkeleton() {
        const previewContainer = document.getElementById(this.config.previewElementId);
        if (!previewContainer) return;

        const skeletonHTML = `
            <div class="data-preview-header">
                <div class="skeleton skeleton-text" style="width: 180px; height: 1.2em; margin-bottom: 0;"></div>
            </div>
            <div class="data-preview-table-wrapper" style="padding: 1rem; border: 1px solid var(--border-color); background: var(--light-color);">
                <div class="skeleton skeleton-text" style="width: 95%; margin-bottom: 1rem;"></div>
                <div class="skeleton skeleton-text" style="width: 100%; margin-bottom: 1rem;"></div>
                <div class="skeleton skeleton-text" style="width: 80%; margin-bottom: 1rem;"></div>
                <div class="skeleton skeleton-text" style="width: 90%; margin-bottom: 1rem;"></div>
                <div class="skeleton skeleton-text" style="width: 75%; margin-bottom: 0;"></div>
            </div>
        `;
        previewContainer.innerHTML = skeletonHTML;
    }
    
    // === NOVÁ POMOCNÁ METÓDA PRE OBNOVU STAVU ===
    _restoreEmptyState() {
        const previewContainer = document.getElementById(this.config.previewElementId);
        if (!previewContainer) return;
        previewContainer.innerHTML = `
            <div class="empty-state-placeholder">
                <i class="fas fa-exclamation-triangle"></i>
                <h4>Spracovanie zlyhalo</h4>
                <p>Skontrolujte konzolu pre chyby a nahrajte súbor znova.</p>
            </div>
        `;
    }
}