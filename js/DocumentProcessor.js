import { showNotification, toggleSpinner, createProgressTracker, showErrorModal, setButtonState } from './ui.js';

export class DocumentProcessor {
    constructor(config) {
        this.config = config;
        this.state = {
            data: {},
            templates: {}, // Tento objekt sa teraz bude plniť postupne
            processedData: null,
            appState: config.appState,
        };
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
        showNotification(`Pripravuje sa šablóna: ${templateKey}...`, 'info', 2000);

        try {
            const response = await fetch(templatePath);
            if (!response.ok) {
                throw new Error(`Šablónu sa nepodarilo nájsť na ceste: ${templatePath} (Status: ${response.status})`);
            }
            const buffer = await response.arrayBuffer();
            this.state.templates[templateKey] = new Uint8Array(buffer);
            showNotification(`Šablóna '${templateKey}' je pripravená.`, 'success');
        } catch (error) {
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

    processData() {
        if (!this.config.dataProcessor) {
            showNotification('Pre túto sekciu nie je definované spracovanie dát.', 'error');
            return;
        }
        
        this.state.processedData = null;
        toggleSpinner(true);
        setTimeout(() => {
            try {
                this.state.processedData = this.config.dataProcessor(this.state.data);
                this.displayPreview();
                showNotification('Dáta boli úspešne automaticky spracované.', 'success');
                if (this.config.onDataProcessed) {
                    this.config.onDataProcessed();
                }
            } catch (error) {
                showErrorModal({
                    message: `Nastala chyba pri spracovaní dát: ${error.message}`,
                    details: error.stack
                });
            } finally {
                toggleSpinner(false);
                this.checkAllButtonsState();
            }
        }, 50);
    }
    
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

        rows.forEach(row => {
            let rowIssues = [];
            if (this.config.validators) {
                this.config.validators.forEach(validator => {
                    const cellValue = row[columnMap[validator.column]];
                    if (!validator.rule(cellValue)) {
                        rowIssues.push(validator.errorMessage);
                    }
                });
            }
            
            const isError = rowIssues.length > 0;
            if (isError) issuesCount++;
            
            tableHTML += `<tr class="${isError ? 'row-error' : ''}" title="${rowIssues.join('\n')}">`;
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
    }

    checkAllButtonsState() {
        Object.keys(this.config.generators).forEach(key => {
            const generatorConfig = this.config.generators[key];
            const btn = document.getElementById(generatorConfig.buttonId);
            if(btn) {
                // ZMENA: Kontrola načítania šablóny je odstránená, pretože to už nie je podmienka pre aktiváciu tlačidla.
                const dataProcessed = !!this.state.processedData;
                const spisFilled = (this.config.sectionPrefix && this.state.appState.spis) ? !!this.state.appState.spis[this.config.sectionPrefix] : true;
                const ouSelected = !!this.state.appState.selectedOU;

                const isReady = dataProcessed && spisFilled && ouSelected;
                btn.disabled = !isReady;
                btn.classList.toggle('ready', isReady);
            }
        });
    }
    
    async generateRowByRow(generatorKey) {
        const generator = this.config.generators[generatorKey];
        const button = document.getElementById(generator.buttonId);
        if (!this.state.processedData || this.state.processedData.length === 0) {
            showErrorModal({ message: 'Dáta neboli spracované. Najprv prosím nahrajte vstupné súbory.' });
            return;
        }
        
        setButtonState(button, 'loading', 'Generujem...');

        try {
            // === ZMENA: Lazy Loading šablóny ===
            if (generator.templateKey && generator.templatePath) {
                await this._ensureTemplateLoaded(generator.templateKey, generator.templatePath);
            }

            const dataRows = this.state.processedData.slice(1);
            const headerRow = this.state.processedData[0];
            const columnMap = this.createColumnMap(headerRow);
            
            const zip = new JSZip();
            const tracker = createProgressTracker(dataRows.length, generator.title);

            for (let i = 0; i < dataRows.length; i++) {
                const row = dataRows[i];
                if (this.isRowEmpty(row)) continue;

                const templateData = generator.dataMapper({ row, columnMap, appState: this.state.appState, index: i });
                const templateContent = this.state.templates[generator.templateKey];
                if (!templateContent) throw new Error(`Chýba šablóna pre: ${generator.title}`);
                
                const doc = this.createDocxtemplater(templateContent);
                doc.render(templateData);

                const outputBuffer = doc.getZip().generate({ type: 'uint8array' });
                const fileName = generator.fileNameGenerator(templateData, i);
                zip.file(fileName, outputBuffer);

                tracker.increment(`Generujem ${i + 1} / ${dataRows.length}: ${fileName}`);
                if(i % 10 === 0) await new Promise(r => setTimeout(r, 0));
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            saveAs(zipBlob, generator.zipName);
            tracker.close();
            showNotification('Dokumenty boli úspešne vygenerované!', 'success');

        } catch (error) {
             showErrorModal({ message: `Chyba pri generovaní dokumentov: ${error.message}`, details: error.stack });
        } finally {
            const originalButtonText = button.textContent.includes('Exportovať') ? 'Exportovať (.xlsx)' : 'Generovať (.docx)';
            setButtonState(button, 'reset', originalButtonText);
        }
    }

    async generateInBatches(generatorKey) {
        const generator = this.config.generators[generatorKey];
        const button = document.getElementById(generator.buttonId);
        if (!this.state.processedData || this.state.processedData.length === 0) {
            showErrorModal({ message: 'Dáta neboli spracované. Najprv prosím nahrajte vstupné súbory.' });
            return;
        }
        
        setButtonState(button, 'loading', 'Generujem...');
        
        try {
            // === ZMENA: Lazy Loading šablóny ===
            if (generator.templateKey && generator.templatePath) {
                await this._ensureTemplateLoaded(generator.templateKey, generator.templatePath);
            }

            const dataRows = this.state.processedData.slice(1);
            const headerRow = this.state.processedData[0];
            const columnMap = this.createColumnMap(headerRow);
            const batchSize = generator.batchSize || 8;
            const totalBatches = Math.ceil(dataRows.length / batchSize);
            
            const zip = new JSZip();
            const tracker = createProgressTracker(totalBatches, generator.title);

            for (let i = 0; i < totalBatches; i++) {
                const batchStart = i * batchSize;
                const batchEnd = batchStart + batchSize;
                const batch = dataRows.slice(batchStart, batchEnd);

                const templateData = generator.dataMapper({ batch, columnMap, appState: this.state.appState, batchIndex: i });
                const templateContent = this.state.templates[generator.templateKey];
                if (!templateContent) throw new Error(`Chýba šablóna pre: ${generator.title}`);
                
                const doc = this.createDocxtemplater(templateContent);
                doc.render(templateData);

                const outputBuffer = doc.getZip().generate({ type: 'uint8array' });
                const fileName = generator.fileNameGenerator(templateData, i);
                zip.file(fileName, outputBuffer);
                
                tracker.increment(`Generujem dávku ${i + 1} / ${totalBatches}`);
                await new Promise(r => setTimeout(r, 0));
            }
            
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            saveAs(zipBlob, generator.zipName);
            tracker.close();
            showNotification('Dokumenty boli úspešne vygenerované!', 'success');

        } catch (error) {
             showErrorModal({ message: `Chyba pri generovaní dokumentov: ${error.message}`, details: error.stack });
        } finally {
            const originalButtonText = button.textContent.includes('Exportovať') ? 'Exportovať (.xlsx)' : 'Generovať (.docx)';
            setButtonState(button, 'reset', originalButtonText);
        }
    }

    async generateByGroup(generatorKey) {
        const generator = this.config.generators[generatorKey];
        const button = document.getElementById(generator.buttonId);
        const originalButtonText = button.querySelector('.btn-text')?.textContent || 'Exportovať (.xlsx)';
        if (!this.state.processedData || this.state.processedData.length === 0) {
            showErrorModal({ message: 'Dáta neboli spracované. Najprv prosím nahrajte vstupné súbory.' });
            return;
        }

        setButtonState(button, 'loading', 'Exportujem...');
        
        try {
            // === ZMENA: Lazy Loading šablóny (ak by sa použila pre .docx v tejto metóde) ===
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
            const tracker = createProgressTracker(totalGroups, generator.title);
            let currentGroup = 0;
            
            for (const groupKey in groupedData) {
                currentGroup++;
                const groupRows = groupedData[groupKey];
                
                const templateData = generator.dataMapper({ groupRows, columnMap, groupKey, appState: this.state.appState });
                const fileName = generator.fileNameGenerator(templateData, 0);

                if (generator.outputType === 'xlsx') {
                    const excelData = templateData;
                    const ws = XLSX.utils.json_to_sheet(excelData.data);
                    ws['!cols'] = excelData.cols;
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, 'Zoznam');
                    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                    zip.file(fileName, excelBuffer);
                } else {
                    const templateContent = this.state.templates[generator.templateKey];
                    if (!templateContent) throw new Error(`Chýba šablóna pre: ${generator.title}`);
                    
                    const doc = this.createDocxtemplater(templateContent);
                    doc.render(templateData);
                    const outputBuffer = doc.getZip().generate({ type: 'uint8array' });
                    zip.file(fileName, outputBuffer);
                }
                
                tracker.increment(`Spracúvam skupinu ${currentGroup} / ${totalGroups}: ${groupKey}`);
                await new Promise(r => setTimeout(r, 0));
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            saveAs(zipBlob, generator.zipName);
            tracker.close();
            showNotification('Dokumenty boli úspešne vygenerované!', 'success');

        } catch (error) {
             showErrorModal({ message: `Chyba pri generovaní dokumentov: ${error.message}`, details: error.stack });
        } finally {
            setButtonState(button, 'reset', originalButtonText);
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
}