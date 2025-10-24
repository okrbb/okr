// js/processors/vpProcessor.js

/**
 * Spracováva vstupné dáta pre agendu Vecné Prostriedky (VP).
 * Očakáva 'subjekty' (XLSX) a 'psc' (XLSX) v objekte data.
 * Pridáva stĺpce ADRESA, PCRD_short a PSC_long.
 */
export const vpDataProcessor = (data) => {
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
};