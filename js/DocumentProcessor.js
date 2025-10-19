import { showNotification, toggleSpinner, createProgressTracker, showErrorModal, setButtonState } from './ui.js';

export class DocumentProcessor {
    constructor(config) {
        this.config = config;
        this.state = {
            data: null,
            templates: {},
            processedData: null,
            appState: config.appState,
        };
        this.init();
    }

    init() {
        this.config.dataInputs.forEach(inputConfig => {
            const el = document.getElementById(inputConfig.elementId);
            el.addEventListener('change', (e) => this.handleFileLoad(e, inputConfig.stateKey));
        });

        Object.keys(this.config.generators).forEach(key => {
            const generatorConfig = this.config.generators[key];
            const el = document.getElementById(generatorConfig.buttonId);
            if(el) {
                el.addEventListener('click', () => {
                    const generator = this.config.generators[key];
                    if (!generator) return;

                    switch (generator.type) {
                        case 'batch':
                            this.generateInBatches(key);
                            break;
                        case 'groupBy':
                            this.generateByGroup(key);
                            break;
                        default: // 'row' by default
                            this.generateRowByRow(key);
                            break;
                    }
                });
            }
        });

        document.addEventListener('ou-selected', (e) => {
            this.state.appState = e.detail;
            this.checkAllButtonsState();
        });
    }

    async loadTemplates() {
        toggleSpinner(true);
        const promises = [];
        const templatesToLoad = new Map();

        Object.values(this.config.generators).forEach(genConf => {
            if (genConf.templatePath && genConf.templateKey) {
                if (!templatesToLoad.has(genConf.templateKey)) {
                    templatesToLoad.set(genConf.templateKey, genConf.templatePath);
                }
            }
        });

        for (const [key, path] of templatesToLoad.entries()) {
            const promise = fetch(path)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Šablónu sa nepodarilo nájsť na ceste: ${path} (Status: ${response.status})`);
                    }
                    return response.arrayBuffer();
                })
                .then(buffer => {
                    this.state.templates[key] = new Uint8Array(buffer);
                });
            promises.push(promise);
        }

        try {
            await Promise.all(promises);
            if (promises.length > 0) {
                showNotification('Všetky šablóny boli úspešne načítané.', 'success');
            }
        } catch (error) {
            showErrorModal({ message: 'Nastala kritická chyba pri načítaní šablón.', details: error.message });
        } finally {
            toggleSpinner(false);
            this.checkAllButtonsState();
        }
    }

    async handleFileLoad(event, stateKey) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const arrayBuffer = await file.arrayBuffer();
        this.state.data = this.state.data || {};
        this.state.data[stateKey] = arrayBuffer;
        // Odstránili sme notifikáciu o načítaní súboru, pretože je nadbytočná.
        
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
        if (this.state.processedData) {
            return;
        }

        toggleSpinner(true);
        setTimeout(() => {
            try {
                this.state.processedData = this.config.dataProcessor(this.state.data);
                this.displayPreview();
                showNotification('Dáta boli úspešne automaticky spracované.', 'success');
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
                <span class="preview-stat preview-stat--total">
                    <i class="fas fa-list-ol"></i> Počet záznamov: <strong>${rows.length}</strong>
                </span>
                <span class="preview-stat ${issuesCount > 0 ? 'preview-stat--issues' : ''}">
                    <i class="fas fa-exclamation-triangle"></i> Potenciálne problémy: <strong>${issuesCount}</strong>
                </span>
            </div>
        `;
        
        previewContainer.innerHTML = headerHTML + `<div class="data-preview-table">${tableHTML}</div>`;
    }

    checkAllButtonsState() {
        Object.keys(this.config.generators).forEach(key => {
            const generatorConfig = this.config.generators[key];
            const btn = document.getElementById(generatorConfig.buttonId);
            if(btn) {
                const templateLoaded = generatorConfig.templateKey ? !!this.state.templates[generatorConfig.templateKey] : true;
                const dataProcessed = !!this.state.processedData;
                const spisFilled = (this.config.sectionPrefix && this.state.appState.spis) ? !!this.state.appState.spis[this.config.sectionPrefix] : true;
                const ouSelected = !!this.state.appState.selectedOU;

                const isReady = templateLoaded && dataProcessed && spisFilled && ouSelected;
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
            setButtonState(button, 'reset', 'Generovať');
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
            setButtonState(button, 'reset', 'Generovať');
        }
    }

    async generateByGroup(generatorKey) {
        const generator = this.config.generators[generatorKey];
        const button = document.getElementById(generator.buttonId);
        const originalButtonText = button.querySelector('.btn-text')?.textContent || 'Exportovať';
        if (!this.state.processedData || this.state.processedData.length === 0) {
            showErrorModal({ message: 'Dáta neboli spracované. Najprv prosím nahrajte vstupné súbory.' });
            return;
        }

        setButtonState(button, 'loading', 'Exportujem...');
        
        try {
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