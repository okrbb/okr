// js/agendaConfigFactory.js

import { POSTOVNE, TEMPLATE_PATHS } from './config.js'; // <-- PRIDANÝ IMPORT TEMPLATE_PATHS

// =============================================================================
//  KONFIGURÁCIA PRE JEDNOTLIVÉ AGENDY
// =============================================================================

export const agendaConfigs = {
    // -------------------------------------------------------------------------
    // VECNÉ PROSTRIEDKY (vp)
    // -------------------------------------------------------------------------
    vp: {
        title: 'Vecné prostriedky',
        dataInputs: [
            { id: 'zoznam-subjektov-vp', label: 'Zoznam subjektov (.xlsx)', stateKey: 'subjekty' }
            // Súbor PSC.xlsx sa načíta automaticky v main-wizard.js
        ],
        dataProcessor: (data) => {
            if (!data || !data.subjekty || !data.psc) {
                throw new Error("Chýbajú vstupné súbory. Zoznam subjektov je nutné nahrať a súbor PSČ by sa mal načítať automaticky.");
            }

            const wbSubjekty = XLSX.read(data.subjekty, { type: 'array' });
            const wbPsc = XLSX.read(data.psc, { type: 'array' });

            const wsSubjekty = wbSubjekty.Sheets[wbSubjekty.SheetNames[0]];
            const wsPsc = wbPsc.Sheets[wbPsc.SheetNames[0]];

            let jsonSubjekty = XLSX.utils.sheet_to_json(wsSubjekty, { header: 1, defval: '', blankrows: false });
            const jsonPsc = XLSX.utils.sheet_to_json(wsPsc, { header: 1, defval: '', blankrows: false });
            
            let headerRowIndex = jsonSubjekty.findIndex(row => row.some(cell => String(cell).trim() === 'P.Č.'));
            if (headerRowIndex === -1) throw new Error('Nenašiel sa riadok s hlavičkou "P.Č."');

            const mainHeaderRow = jsonSubjekty[headerRowIndex];
            const subHeaderRow = jsonSubjekty[headerRowIndex + 1];

            const pscMap = new Map();
            const pscHeaderRow = jsonPsc[0];
            const obecIndexPsc = pscHeaderRow.findIndex(h => h === 'OBEC');
            const pscIndexPsc = pscHeaderRow.findIndex(h => h === 'PSC');
            const dpostaIndexPsc = pscHeaderRow.findIndex(h => h === 'DPOSTA');

            for (let i = 1; i < jsonPsc.length; i++) {
                const row = jsonPsc[i];
                if (row[obecIndexPsc]) {
                    pscMap.set(String(row[obecIndexPsc]).toUpperCase(), { psc: row[pscIndexPsc], dposta: row[dpostaIndexPsc] });
                }
            }
            
            let pcIndex = mainHeaderRow.findIndex(c => c === 'P.Č.');
            let dodavatelIndex = mainHeaderRow.findIndex(c => c === 'DODÁVATEĽ');
            let okresIndex = mainHeaderRow.findIndex(c => c === 'OKRES');
            let pcrdIndex = mainHeaderRow.findIndex(c => c === 'PČRD');
            let ulicaIndex = subHeaderRow.findIndex(c => c === 'ULICA');
            let popisneIndex = subHeaderRow.findIndex(c => c === 'Č. POPISNÉ');
            let mestoObecIndex = subHeaderRow.findIndex(c => c === 'MESTO (OBEC)');
            let icoIndex = mainHeaderRow.findIndex(c => c === 'IČO');
            let znackaIndex = mainHeaderRow.findIndex(c => c === 'TOVÁRENSKÁ ZNAČKA');
            let karoseriaIndex = mainHeaderRow.findIndex(c => c === 'DRUH KAROSÉRIE');
            let ecvIndex = mainHeaderRow.findIndex(c => c === 'EČV');
            let utvarIndex = mainHeaderRow.findIndex(c => c === 'ÚTVAR');
            let miestoDodaniaIndex = mainHeaderRow.findIndex(c => c === 'MIESTO DODANIA');

            const newHeader = ['P.Č.', 'DODÁVATEĽ', 'ULICA', 'Č. POPISNÉ', 'MESTO (OBEC)', 'OKRES', 'ADRESA', 'IČO', 'TOVÁRENSKÁ ZNAČKA', 'DRUH KAROSÉRIE', 'EČV', 'ÚTVAR', 'MIESTO DODANIA', 'PCRD_short', 'PSC_long'];
            const processedData = [newHeader];
            
            const dataRows = jsonSubjekty.slice(headerRowIndex + 2);

            for (const row of dataRows) {
                if(!row[pcIndex]) continue;

                let ulica = row[ulicaIndex] || '';
                let popisne = row[popisneIndex] || '';
                let mesto = row[mestoObecIndex] || '';
                let adresa = `${ulica} ${popisne}`.trim();
                
                let pcrd_short = '';
                const pcrdValue = row[pcrdIndex];
                if (pcrdValue && typeof pcrdValue === 'string' && pcrdValue.includes('-')) {
                    pcrd_short = pcrdValue.split('-')[0];
                } else {
                    pcrd_short = pcrdValue;
                }

                let psc_long = '';
                if (mesto && pscMap.has(String(mesto).toUpperCase())) {
                    const pscInfo = pscMap.get(String(mesto).toUpperCase());
                    psc_long = `${pscInfo.psc} ${pscInfo.dposta}`;
                }

                const newRow = new Array(newHeader.length).fill('');
                newRow[0] = row[pcIndex];
                newRow[1] = row[dodavatelIndex];
                newRow[2] = ulica;
                newRow[3] = popisne;
                newRow[4] = mesto;
                newRow[5] = row[okresIndex];
                newRow[6] = adresa;
                newRow[7] = row[icoIndex];
                newRow[8] = row[znackaIndex];
                newRow[9] = row[karoseriaIndex];
                newRow[10] = row[ecvIndex];
                newRow[11] = row[utvarIndex];
                newRow[12] = row[miestoDodaniaIndex];
                newRow[13] = pcrd_short;
                newRow[14] = psc_long;

                processedData.push(newRow);
            }

            if (processedData.length <= 1) {
                throw new Error("Spracovaním nevznikli žiadne dáta. Skontrolujte formát vstupného súboru.");
            }
            return processedData;
        },
        generators: {
            rozhodnutia: {
                type: 'row',
                buttonId: 'download-rozhodnutia-vp',
                templateKey: 'rozhodnutia',
                templatePath: TEMPLATE_PATHS.vp.rozhodnutie, // <-- ZMENA
                title: 'Generovanie rozhodnutí VP',
                zipName: 'rozhodnutia_VP.zip',
                dataMapper: ({ row, columnMap, appState }) => {
                    const ico = row[columnMap['IČO']] || '';
                    return {
                        ...appState.okresData,
                        Nazov_OU_upper: appState.okresData.Okresny_urad.toUpperCase(),
                        'spis-VP': appState.spis.vp,
                        ID_OU: appState.selectedOU.toLowerCase(),
                        poradoveCislo: row[columnMap['P.Č.']],
                        nazovDodavatela: row[columnMap['DODÁVATEĽ']],
                        adresa: row[columnMap['ADRESA']],
                        PSC: row[columnMap['PSC_long']],
                        ICO: ico,
                        znacka: row[columnMap['TOVÁRENSKÁ ZNAČKA']],
                        karoseria: row[columnMap['DRUH KAROSÉRIE']],
                        ECV: row[columnMap['EČV']],
                        utvar: row[columnMap['ÚTVAR']],
                        miestoDodania: row[columnMap['MIESTO DODANIA']],
                        PCRD_short: row[columnMap['PCRD_short']],
                        odsek: (!ico || String(ico).includes('/')) ? "ods. 3 písm. b)" : "ods. 1 písm. d)"
                    }
                },
                fileNameGenerator: (data) => `rozhodnutie_VP_${data.poradoveCislo}.docx`
            },
            obalky: {
                type: 'row',
                buttonId: 'download-obalky-vp',
                templateKey: 'obalky',
                templatePath: TEMPLATE_PATHS.vp.obalky, // <-- ZMENA
                title: 'Generovanie obálok VP',
                zipName: 'obalky_VP.zip',
                 dataMapper: ({ row, columnMap, appState }) => {
                     const pscMatch = (row[columnMap['PSC_long']] || '').match(/^(\d{3}\s?\d{2})\s+(.*)/);
                     return {
                        ...appState.okresData,
                        'spis-VP': appState.spis.vp,
                        nazovDodavatela: row[columnMap['DODÁVATEĽ']],
                        adresa: `${row[columnMap['ULICA']] || ''} ${row[columnMap['Č. POPISNÉ']] || ''}`.trim(),
                        PSC: row[columnMap['PSC_long']],
                        ECV: row[columnMap['EČV']],
                        poradoveCislo: row[columnMap['P.Č.']],
                        PCRD_short: row[columnMap['PCRD_short']],
                        psc: pscMatch ? pscMatch[1] : '',
                        obec: pscMatch ? pscMatch[2] : '',
                     }
                },
                fileNameGenerator: (data) => `obalka_VP_${data.poradoveCislo}.docx`
            },
            ph: {
                type: 'batch',
                buttonId: 'download-ph-vp',
                templateKey: 'ph',
                templatePath: TEMPLATE_PATHS.vp.ph, // <-- ZMENA
                batchSize: 8,
                title: 'Generovanie podacích hárkov VP',
                zipName: 'podacieHarky_VP.zip',
                dataMapper: ({ batch, columnMap, appState }) => {
                    let totalCena = 0;
                    const batchRows = batch.map(row => {
                        totalCena += POSTOVNE;
                        return {
                            A: row[columnMap['P.Č.']],
                            B: row[columnMap['DODÁVATEĽ']],
                            C: row[columnMap['ADRESA']],
                            D: row[columnMap['EČV']],
                            E: row[columnMap['PCRD_short']],
                            F: row[columnMap['PSC_long']],
                            G: row[columnMap['ÚTVAR']],
                            eur: POSTOVNE.toFixed(2)
                        }
                    });
                    return {
                        ...appState.okresData,
                        'spis-VP': appState.spis.vp,
                        ID_OU: appState.selectedOU.toLowerCase(),
                        ID_PH: "VP",
                        cena: totalCena.toFixed(2),
                        rows: batchRows,
                    }
                },
                fileNameGenerator: (_, batchIndex) => `podaci_harok_VP_${batchIndex + 1}.docx`
            },
            zoznamyDoruc: {
                type: 'groupBy',
                buttonId: 'download-zoznamy-doruc-vp',
                templateKey: 'zoznamyDoruc',
                templatePath: TEMPLATE_PATHS.zoznamyDorucenie, // <-- ZMENA
                groupByColumn: 'MESTO (OBEC)',
                title: 'Generovanie zoznamov na doručovanie',
                zipName: 'zoznamZasielokDorucenie_VP.zip',
                dataMapper: ({ groupRows, columnMap, groupKey, appState }) => {
                    const rows = groupRows.map((row, index) => ({
                        A: index + 1,
                        B: row[columnMap['DODÁVATEĽ']],
                        C: `${row[columnMap['ADRESA']]}, ${row[columnMap['PSC_long']]}`
                    }));
                    
                    return {
                        ...appState.okresData,
                        spis_OU: appState.spis.vp,
                        Okres: appState.okresData.Okresny_urad.replace('Okresný úrad', '').trim(),
                        obec: groupKey,
                        rows: rows,
                        uniqueRows: Array.from(new Set(rows.map(r => JSON.stringify(r)))).map(s => JSON.parse(s))
                    }
                },
                fileNameGenerator: (data) => `${data.obec.replace(/\s/g, '_')}_zoznam_zasielok_VP.docx`
            },
            zoznamyObce: {
                type: 'groupBy',
                buttonId: 'download-zoznamy-obce-vp',
                outputType: 'xlsx',
                groupByColumn: 'MESTO (OBEC)',
                title: 'Export zoznamov pre obce',
                zipName: 'zoznamyVP_obce.zip',
                dataMapper: ({ groupRows, columnMap, groupKey }) => {
                    const data = groupRows.map((row, index) => ({
                        'P.č.': index + 1,
                        'Dodávateľ': row[columnMap['DODÁVATEĽ']],
                        'Adresa': row[columnMap['ADRESA']],
                        'Mesto/Obec': row[columnMap['MESTO (OBEC)']],
                        'IČO': row[columnMap['IČO']],
                        'EČV': row[columnMap['EČV']]
                    }));
                    const cols = [{ wch: 5 }, { wch: 30 }, { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 10 }];
                    return { data, cols, groupKey };
                },
                fileNameGenerator: (data) => `${data.groupKey.replace(/\s/g, '_')}_vp.xlsx`
            },
        }
    },

    // -------------------------------------------------------------------------
    // PRACOVNÁ POVINNOSŤ (pp)
    // -------------------------------------------------------------------------
    pp: {
        title: 'Pracovná povinnosť',
        dataInputs: [
            { id: 'zoznam-subjektov-pp', label: 'Zoznam subjektov (.xlsx)', stateKey: 'subjekty' }
        ],
        dataProcessor: (data) => {
            if (!data || !data.subjekty) throw new Error("Chýba vstupný súbor so zoznamom subjektov.");
            
            const workbook = XLSX.read(data.subjekty, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            let json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', blankrows: true });

            let headerRowIndex = -1;
            for (let i = 0; i < json.length; i++) {
                if (json[i][2] && String(json[i][2]).includes('Por. číslo')) {
                    headerRowIndex = i;
                    break;
                }
            }
            if (headerRowIndex === -1) throw new Error('Nenašiel sa riadok s hlavičkou "Por. číslo" v stĺpci C.');

            const header = json[headerRowIndex].slice(2);
            const dataRows = json.slice(headerRowIndex + 1);

            let lastRowWithData = -1;
            for (let i = 0; i < dataRows.length; i++) {
                if (dataRows[i][2] && String(dataRows[i][2]).trim() !== '') {
                    lastRowWithData = i;
                }
            }

            header.push('Obec');
            const adresaColumnIndex = header.findIndex(h => h.includes('Miesto pobytu'));

            const processedDataRows = dataRows.slice(0, lastRowWithData + 1).map(row => {
                const newRow = row.slice(2);
                const adresaPlna = newRow[adresaColumnIndex] || '';
                let obec = 'Nezaradené';
                if (adresaPlna.includes(',')) {
                    const casti = adresaPlna.split(',');
                    if (casti.length > 1) {
                        const pscObec = casti[casti.length - 1].trim();
                        obec = pscObec.replace(/^\d{3}\s?\d{2}\s+/, '').trim();
                    }
                }
                newRow.push(obec);
                return newRow;
            });
            
            const finalData = [header, ...processedDataRows];

            if (finalData.length <= 1) throw new Error("Spracovaním nevznikli žiadne dáta.");
            return finalData;
        },
        generators: {
            rozhodnutia: {
                type: 'row',
                buttonId: 'download-rozhodnutia-pp',
                templateKey: 'rozhodnutia',
                templatePath: TEMPLATE_PATHS.pp.rozhodnutie, // <-- ZMENA
                title: 'Generovanie rozhodnutí PP',
                zipName: 'rozhodnutia_PP.zip',
                dataMapper: ({ row, columnMap, appState }) => {
                    const titul = row[columnMap['Titul']] || '';
                    const meno = row[columnMap['Meno']] || '';
                    const priezvisko = row[columnMap['Priezvisko']] || '';
                    const adresaPlna = row[columnMap['Miesto pobytu / Adresa trvalého pobytu']] || '';
                    const miestoNastupu = row[columnMap['Miesto nástupu k vojenskému útvaru']] || '';
                    const utvarMatch = miestoNastupu.match(/\d+/);
                    
                    return {
                        ...appState.okresData,
                        Nazov_OU_upper: appState.okresData.Okresny_urad.toUpperCase(),
                        'spis-PP': appState.spis.pp,
                        ID_OU: appState.selectedOU.toLowerCase(),
                        menoPriezvisko: `${titul} ${meno} ${priezvisko}`.trim(),
                        adresa: adresaPlna,
                        PSC: '',
                        rodneCislo: row[columnMap['Rodné číslo']],
                        miestoNastupu: miestoNastupu,
                        utvar_csl: utvarMatch ? utvarMatch[0] : ''
                    };
                },
                fileNameGenerator: (data) => `${data.menoPriezvisko.replace(/\s/g, '_')}_rozhodnutie_PP.docx`
            },
            obalky: {
                type: 'row',
                buttonId: 'download-obalky-pp',
                templateKey: 'obalky',
                templatePath: TEMPLATE_PATHS.pp.obalky, // <-- ZMENA
                title: 'Generovanie obálok PP',
                zipName: 'obalky_PP.zip',
                dataMapper: ({ row, columnMap, appState }) => {
                    const titul = row[columnMap['Titul']] || '';
                    const meno = row[columnMap['Meno']] || '';
                    const priezvisko = row[columnMap['Priezvisko']] || '';
                    const adresaPlna = row[columnMap['Miesto pobytu / Adresa trvalého pobytu']] || '';
                    const [adresa, psc] = adresaPlna.lastIndexOf(',') !== -1 ? 
                        [adresaPlna.substring(0, adresaPlna.lastIndexOf(',')).trim(), adresaPlna.substring(adresaPlna.lastIndexOf(',') + 1).trim()] : 
                        [adresaPlna, ''];
                    const miestoNastupu = row[columnMap['Miesto nástupu k vojenskému útvaru']] || '';
                    const utvarMatch = miestoNastupu.match(/\d+/);

                    return {
                        ...appState.okresData,
                        'spis-PP': appState.spis.pp,
                        menoPriezvisko: `${titul} ${meno} ${priezvisko}`.trim(),
                        adresa: adresa,
                        PSC: psc,
                        utvar_csl: utvarMatch ? utvarMatch[0] : ''
                    };
                },
                fileNameGenerator: (data) => `${data.menoPriezvisko.replace(/\s/g, '_')}_obalka_PP.docx`
            },
            ph: {
                type: 'batch',
                buttonId: 'download-ph-pp',
                templateKey: 'ph',
                templatePath: TEMPLATE_PATHS.pp.ph, // <-- ZMENA
                batchSize: 8,
                title: 'Generovanie podacích hárkov PP',
                zipName: 'podacieHarky_PP.zip',
                dataMapper: ({ batch, columnMap, appState }) => {
                    let totalCena = 0;
                    const batchRows = batch.map(row => {
                        totalCena += POSTOVNE;
                        const adresaPlna = row[columnMap['Miesto pobytu / Adresa trvalého pobytu']] || '';
                        const [adresa, psc] = adresaPlna.lastIndexOf(',') !== -1 ? 
                            [adresaPlna.substring(0, adresaPlna.lastIndexOf(',')).trim(), adresaPlna.substring(adresaPlna.lastIndexOf(',') + 1).trim()] : 
                            [adresaPlna, ''];
                        const miestoNastupu = row[columnMap['Miesto nástupu k vojenskému útvaru']] || '';
                        const utvarMatch = miestoNastupu.match(/\d+/);
                        
                        return {
                            A: row[columnMap['Por. číslo']],
                            B: `${row[columnMap['Meno']]} ${row[columnMap['Priezvisko']]}`.trim(),
                            C: adresa,
                            D: '',
                            E: '',
                            F: psc,
                            G: utvarMatch ? utvarMatch[0] : '',
                            eur: POSTOVNE.toFixed(2)
                        }
                    });
                    return {
                        ...appState.okresData,
                        'spis-PP': appState.spis.pp,
                        ID_OU: appState.selectedOU.toLowerCase(),
                        ID_PH: "PP",
                        cena: totalCena.toFixed(2),
                        rows: batchRows,
                    }
                },
                fileNameGenerator: (_, batchIndex) => `podaci_harok_PP_${batchIndex + 1}.docx`
            },
            zoznamyDoruc: {
                type: 'groupBy',
                buttonId: 'download-zoznamy-doruc-pp',
                templateKey: 'zoznamyDoruc',
                templatePath: TEMPLATE_PATHS.zoznamyDorucenie, // <-- ZMENA
                groupByColumn: 'Obec',
                title: 'Generovanie zoznamov na doručovanie',
                zipName: 'zoznamZasielokDorucenie_PP.zip',
                dataMapper: ({ groupRows, columnMap, groupKey, appState }) => {
                    const rows = groupRows.map((row, index) => {
                         const titul = row[columnMap['Titul']] || '';
                         const meno = row[columnMap['Meno']] || '';
                         const priezvisko = row[columnMap['Priezvisko']] || '';
                        return {
                            A: index + 1,
                            B: `${titul} ${meno} ${priezvisko}`.trim(),
                            C: row[columnMap['Miesto pobytu / Adresa trvalého pobytu']]
                        }
                    });
                    return {
                        ...appState.okresData,
                        spis_OU: appState.spis.pp,
                        Okres: appState.okresData.Okresny_urad.replace('Okresný úrad', '').trim(),
                        obec: groupKey,
                        rows: rows,
                        uniqueRows: Array.from(new Set(rows.map(r => JSON.stringify({B: r.B, C: r.C})))).map(s => JSON.parse(s))
                    }
                },
                fileNameGenerator: (data) => `${data.obec.replace(/[\\/:*?"<>|.\s]/g, '_')}_zoznam_zasielok_PP.docx`
            }
        }
    },
    
    // -------------------------------------------------------------------------
    // UBYTOVANIE (ub)
    // -------------------------------------------------------------------------
    ub: {
        title: 'Ubytovanie',
        dataInputs: [
            { id: 'zoznam-subjektov-ub', label: 'Zoznam subjektov (.xlsx)', stateKey: 'subjekty' }
        ],
        dataProcessor: (data) => {
            if (!data || !data.subjekty) throw new Error("Chýba vstupný súbor so zoznamom subjektov.");

            const workbook = XLSX.read(data.subjekty, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            let json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

            const headerIndex = json.findIndex(row => row.some(cell => String(cell).startsWith('Por. č')));
            if (headerIndex === -1) throw new Error('Nenašiel sa riadok s hlavičkou "Por. č."');
            
            const headers = json[headerIndex];
            headers.push('Obec');
            const adresaColumnIndex = headers.findIndex(h => h.includes('sídlo alebo miesto pobytu'));
            if (adresaColumnIndex === -1) throw new Error("V hlavičke chýba stĺpec s adresou ('sídlo alebo miesto pobytu').");

            const dataRows = json.slice(headerIndex + 1);

            let lastNonEmptyRow = -1;
            for (let i = 0; i < dataRows.length; i++) {
                if (!dataRows[i].every(cell => cell === "")) {
                    lastNonEmptyRow = i;
                }
            }
            
            const finalDataRows = dataRows.slice(0, lastNonEmptyRow + 1).map(row => {
                const adresaPlna = row[adresaColumnIndex] || '';
                let obec = 'Nezaradené';
                if (adresaPlna.includes(',')) {
                    const casti = adresaPlna.split(',');
                    if (casti.length > 1) {
                        const pscObec = casti[1].trim();
                        const pscMatch = pscObec.match(/^\d{3}\s?\d{2}\s+(.+)$/);
                        obec = pscMatch && pscMatch[1] ? pscMatch[1].trim() : pscObec;
                    }
                }
                row.push(obec);
                return row;
            });

            const finalData = [headers, ...finalDataRows];
            
            if (finalData.length <= 1) throw new Error("Spracovaním nevznikli žiadne dáta.");
            return finalData;
        },
        generators: {
            rozhodnutia: {
                type: 'row',
                buttonId: 'download-rozhodnutia-ub',
                templateKey: 'rozhodnutia',
                templatePath: TEMPLATE_PATHS.ub.rozhodnutie, // <-- ZMENA
                title: 'Generovanie rozhodnutí UB',
                zipName: 'rozhodnutia_UB.zip',
                dataMapper: ({ row, columnMap, appState, index }) => { // <-- Pridaný 'index'
                    const ico = row[columnMap['IČO alebo rodné číslo']] || '';
                    return {
                        ...appState.okresData,
                        Nazov_OU_upper: appState.okresData.Okresny_urad.toUpperCase(),
                        'spis-UB': appState.spis.ub,
                        ID_OU: appState.selectedOU.toLowerCase(),
                        Vlastnik: row[columnMap['obchodné meno alebo názov alebo meno a priezvisko']],
                        vAdresa: row[columnMap['sídlo alebo miesto pobytu']],
                        ICO: ico,
                        Nehnutelnost: row[columnMap['názov (identifikácia) nehnuteľnosti']],
                        nAdresa: row[columnMap['adresa, na ktorej sa nehnuteľnosť nachádza']],
                        Ziadatel: row[columnMap['názov žiadateľa']],
                        zAdresa: row[columnMap['adresa žiadateľa']],
                        odsek: String(ico).includes('/') ? "ods. 3 písm. b)" : "ods.1 písm. d)",
                        poradoveCislo: index + 1 // <-- Pridané poradové číslo pre istotu
                    };
                },
                fileNameGenerator: (data) => `UB_${(data.Vlastnik || `zaznam_${data.poradoveCislo}`).replace(/\s/g, '_')}_rozhodnutie.docx` // <-- Tu je oprava
            },
            obalky: {
                type: 'row',
                buttonId: 'download-obalky-ub',
                templateKey: 'obalky',
                templatePath: TEMPLATE_PATHS.ub.obalky, // <-- ZMENA
                title: 'Generovanie obálok UB',
                zipName: 'obalky_UB.zip',
                dataMapper: ({ row, columnMap, appState }) => {
                    const adresaPlna = row[columnMap['sídlo alebo miesto pobytu']] || '';
                    const [adresa, psc] = adresaPlna.includes(',') ? adresaPlna.split(',').map(s => s.trim()) : [adresaPlna, ''];
                    const ziadatel = row[columnMap['názov žiadateľa']] || '';
                    const utvarMatch = ziadatel.match(/\d+/);
                    return {
                        ...appState.okresData,
                        'spis-UB': appState.spis.ub,
                        Vlastnik: row[columnMap['obchodné meno alebo názov alebo meno a priezvisko']],
                        adresa: adresa,
                        PSC: psc,
                        utvar_csl: utvarMatch ? utvarMatch[0] : ''
                    };
                },
                fileNameGenerator: (data) => `UB_${data.Vlastnik.replace(/\s/g, '_')}_obalka.docx`
            },
            ph: {
                type: 'batch',
                buttonId: 'download-ph-ub',
                templateKey: 'ph',
                templatePath: TEMPLATE_PATHS.ub.ph, // <-- ZMENA
                batchSize: 8,
                title: 'Generovanie podacích hárkov UB',
                zipName: 'podacieHarky_UB.zip',
                dataMapper: ({ batch, columnMap, appState }) => {
                    let totalCena = 0;
                    const batchRows = batch.map((row, index) => {
                        totalCena += POSTOVNE;
                        const adresaPlna = row[columnMap['sídlo alebo miesto pobytu']] || '';
                        const [adresa, psc] = adresaPlna.includes(',') ? adresaPlna.split(',').map(s => s.trim()) : [adresaPlna, ''];
                        const ziadatel = row[columnMap['názov žiadateľa']] || '';
                        const utvarMatch = ziadatel.match(/\d+/);
                        return {
                            A: index + 1,
                            B: row[columnMap['obchodné meno alebo názov alebo meno a priezvisko']],
                            C: adresa,
                            D: '',
                            E: '',
                            F: psc,
                            G: utvarMatch ? utvarMatch[0] : '',
                            eur: POSTOVNE.toFixed(2)
                        };
                    });
                    return {
                        ...appState.okresData,
                        'spis-UB': appState.spis.ub,
                        ID_OU: appState.selectedOU.toLowerCase(),
                        ID_PH: "UB",
                        cena: totalCena.toFixed(2),
                        rows: batchRows,
                    };
                },
                fileNameGenerator: (_, batchIndex) => `podaci_harok_UB_${batchIndex + 1}.docx`
            },
            zoznamyDoruc: {
                type: 'groupBy',
                buttonId: 'download-zoznamy-doruc-ub',
                templateKey: 'zoznamyDoruc',
                templatePath: TEMPLATE_PATHS.zoznamyDorucenie, // <-- ZMENA
                groupByColumn: 'Obec',
                title: 'Generovanie zoznamov na doručovanie',
                zipName: 'zoznamZasielokDorucenie_UB.zip',
                dataMapper: ({ groupRows, columnMap, groupKey, appState }) => {
                    const rows = groupRows.map((row, index) => ({
                        A: index + 1,
                        B: row[columnMap['obchodné meno alebo názov alebo meno a priezvisko']],
                        C: row[columnMap['sídlo alebo miesto pobytu']]
                    }));
                    return {
                        ...appState.okresData,
                        spis_OU: appState.spis.ub,
                        Okres: appState.okresData.Okresny_urad.replace('Okresný úrad', '').trim(),
                        obec: groupKey,
                        rows: rows,
                        uniqueRows: Array.from(new Set(rows.map(r => JSON.stringify(r)))).map(s => JSON.parse(s))
                    };
                },
                fileNameGenerator: (data) => `${data.obec.replace(/[\\/:*?"<>|.\s]/g, '_')}_zoznam_zasielok_UB.docx`
            }
        }
    },

    // -------------------------------------------------------------------------
    // DORUČOVATELIA (dr)
    // -------------------------------------------------------------------------
    dr: {
        title: 'Doručovatelia',
        dataInputs: [
            { id: 'zoznam-subjektov-dr', label: 'Zoznam subjektov (.xlsx)', stateKey: 'subjekty' }
        ],
        dataProcessor: (data) => {
            if (!data || !data.subjekty) throw new Error("Chýba vstupný súbor so zoznamom subjektov.");

            const workbook = XLSX.read(data.subjekty, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            let json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

            const headerIndex = json.findIndex(row => row.some(cell => String(cell).trim().startsWith('Por. č')));
            if (headerIndex === -1) throw new Error('Nenašiel sa riadok s hlavičkou "Por. č."');

            const headers = json[headerIndex];
            
            const adresaColumnIndex = headers.findIndex(h => String(h).trim().toLowerCase() === 'adresa trvalého pobytu');
            if (adresaColumnIndex === -1) {
                throw new Error("V hlavičke chýba stĺpec s názvom 'adresa trvalého pobytu'.");
            }
            
            headers.push('Obec');

            const dataRows = json.slice(headerIndex + 1);

            let lastNonEmptyRow = -1;
            for (let i = 0; i < dataRows.length; i++) {
                if (dataRows[i].some(cell => String(cell).trim() !== '')) {
                    lastNonEmptyRow = i;
                }
            }
            
            const finalDataRows = dataRows.slice(0, lastNonEmptyRow + 1).map(row => {
                const adresaPlna = row[adresaColumnIndex] || '';
                let obec = 'Nezaradené';
                if (adresaPlna.includes(',')) {
                    const casti = adresaPlna.split(',');
                    if (casti.length > 1) {
                        const pscObec = casti[casti.length - 1].trim(); 
                        obec = pscObec.replace(/^\d{3}\s?\d{2}\s+/, '').trim();
                    }
                }
                row.push(obec);
                return row;
            });
            
            const finalData = [headers, ...finalDataRows];

            if (finalData.length <= 1) throw new Error("Spracovaním nevznikli žiadne dáta.");
            return finalData;
        },
        generators: {
            rozhodnutia: {
                type: 'row',
                buttonId: 'download-rozhodnutia-dr',
                templateKey: 'rozhodnutia',
                templatePath: TEMPLATE_PATHS.dr.rozhodnutie, // <-- ZMENA
                title: 'Generovanie rozhodnutí DR',
                zipName: 'rozhodnutia_DR.zip',
                dataMapper: ({ row, columnMap, appState }) => {
                    const findKey = (name) => Object.keys(columnMap).find(key => key.trim().toLowerCase() === name.toLowerCase());

                    return {
                        ...appState.okresData,
                        Nazov_OU_upper: appState.okresData.Okresny_urad.toUpperCase(),
                        'spis-DR': appState.spis.dr,
                        ID_OU: appState.selectedOU.toLowerCase(),
                        menoPriezvisko: row[columnMap[findKey('Titul, meno a priezvisko')]],
                        adresa: row[columnMap[findKey('adresa trvalého pobytu')]],
                        RC: row[columnMap[findKey('rodné číslo')]],
                        miestoNastupu: row[columnMap[findKey('Obec')]],
                        obec: row[columnMap[findKey('Obec')]],
                    };
                },
                fileNameGenerator: (data) => `${data.obec}_${data.menoPriezvisko.replace(/\s/g, '_')}_rozhodnutie_DR.docx`
            },
            obalky: {
                type: 'row',
                buttonId: 'download-obalky-dr',
                templateKey: 'obalky',
                templatePath: TEMPLATE_PATHS.dr.obalky, // <-- ZMENA
                title: 'Generovanie obálok DR',
                zipName: 'obalky_DR.zip',
                dataMapper: ({ row, columnMap, appState }) => {
                    const findKey = (name) => Object.keys(columnMap).find(key => key.trim().toLowerCase() === name.toLowerCase());
                    const adresaPlna = row[columnMap[findKey('adresa trvalého pobytu')]] || '';
                    
                    let adresa = adresaPlna;
                    let psc = '';
                    const lastCommaIndex = adresaPlna.lastIndexOf(',');
                    if (lastCommaIndex !== -1) {
                        adresa = adresaPlna.substring(0, lastCommaIndex).trim();
                        psc = adresaPlna.substring(lastCommaIndex + 1).trim();
                    }
                    
                    return {
                        ...appState.okresData,
                        'spis-DR': appState.spis.dr,
                        menoPriezvisko: row[columnMap[findKey('Titul, meno a priezvisko')]],
                        adresa: adresa,
                        PSC: psc,
                    };
                },
                fileNameGenerator: (data) => `${data.menoPriezvisko.replace(/\s/g, '_')}_obalka_DR.docx`
            },
            ph: {
                type: 'batch',
                buttonId: 'download-ph-dr',
                templateKey: 'ph',
                templatePath: TEMPLATE_PATHS.dr.ph, // <-- ZMENA
                batchSize: 8,
                title: 'Generovanie podacích hárkov DR',
                zipName: 'podacieHarky_DR.zip',
                dataMapper: ({ batch, columnMap, appState }) => {
                    let totalCena = 0;
                    const findKey = (name) => Object.keys(columnMap).find(key => key.trim().toLowerCase() === name.toLowerCase());
                    
                    const batchRows = batch.map((row, index) => {
                        totalCena += POSTOVNE;
                        const adresaPlna = row[columnMap[findKey('adresa trvalého pobytu')]] || '';
                        
                        let adresa = adresaPlna;
                        let psc = '';
                        const lastCommaIndex = adresaPlna.lastIndexOf(',');
                        if (lastCommaIndex !== -1) {
                            adresa = adresaPlna.substring(0, lastCommaIndex).trim();
                            psc = adresaPlna.substring(lastCommaIndex + 1).trim();
                        }

                        return {
                            A: row[columnMap[findKey('Por. č.')]] || (index + 1),
                            B: row[columnMap[findKey('Titul, meno a priezvisko')]],
                            C: adresa,
                            F: psc,
                            eur: POSTOVNE.toFixed(2)
                        };
                    });
                    return {
                        ...appState.okresData,
                        'spis-DR': appState.spis.dr,
                        ID_OU: appState.selectedOU.toLowerCase(),
                        ID_PH: "DR",
                        cena: totalCena.toFixed(2),
                        rows: batchRows,
                    };
                },
                fileNameGenerator: (_, batchIndex) => `podaci_harok_DR_${batchIndex + 1}.docx`
            },
            zoznamyDoruc: {
                type: 'groupBy',
                buttonId: 'download-zoznamy-doruc-dr',
                templateKey: 'zoznamyDoruc',
                templatePath: TEMPLATE_PATHS.zoznamyDorucenie, // <-- ZMENA
                groupByColumn: 'Obec',
                title: 'Generovanie zoznamov na doručovanie',
                zipName: 'zoznamZasielokDorucenie_DR.zip',
                dataMapper: ({ groupRows, columnMap, groupKey, appState }) => {
                    const findKey = (name) => Object.keys(columnMap).find(key => key.trim().toLowerCase() === name.toLowerCase());
                    const rows = groupRows.map((row, index) => ({
                        A: index + 1,
                        B: row[columnMap[findKey('Titul, meno a priezvisko')]],
                        C: row[columnMap[findKey('adresa trvalého pobytu')]]
                    }));
                    return {
                        ...appState.okresData,
                        spis_OU: appState.spis.dr,
                        Okres: appState.okresData.Okresny_urad.replace('Okresný úrad', '').trim(),
                        obec: groupKey,
                        rows: rows,
                        uniqueRows: Array.from(new Set(rows.map(r => JSON.stringify({B: r.B, C: r.C})))).map(s => JSON.parse(s))
                    };
                },
                fileNameGenerator: (data) => `${data.obec.replace(/[\\/:*?"<>|.\s]/g, '_')}_zoznam_zasielok_DR.docx`
            }
        }
    }
};