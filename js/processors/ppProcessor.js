// js/processors/ppProcessor.js

/**
 * Spracováva vstupné dáta pre agendu Pracovná Povinnosť (PP).
 * Hľadá hlavičku a extrahuje dáta, pridáva stĺpec 'Obec'.
 */
export const ppDataProcessor = (data) => {
    if (!data || !data.subjekty) throw new Error("Chýba vstupný súbor so zoznamom subjektov.");
    
    const workbook = XLSX.read(data.subjekty, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    let json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', blankrows: true });

    let headerRowIndex = -1;
    for (let i = 0; i < json.length; i++) {
        // === ZMENA: Robustnejšie hľadanie hlavičky (trim + lowercase) ===
        if (json[i][2] && String(json[i][2]).trim().toLowerCase() === 'por. číslo') {
        // === KONIEC ZMENY ===
            headerRowIndex = i;
            break;
        }
    }
    if (headerRowIndex === -1) throw new Error('Nenašiel sa riadok s hlavičkou "Por. číslo" v stĺpci C.');

    // === ZMENA: Pridanie .map() na normalizáciu všetkých hlavičiek ===
    const header = json[headerRowIndex].slice(2).map(h => String(h).trim());
    // === KONIEC ZMENY ===
    
    const dataRows = json.slice(headerRowIndex + 1);

    let lastRowWithData = -1;
    for (let i = 0; i < dataRows.length; i++) {
        if (dataRows[i][2] && String(dataRows[i][2]).trim() !== '') {
            lastRowWithData = i;
        }
    }

    header.push('Obec');
    
    // === ZMENA: Robustnejšie hľadanie stĺpca (lowercase + includes) ===
    const adresaColumnIndex = header.findIndex(h => h.toLowerCase().includes('miesto pobytu'));
    // === KONIEC ZMENY ===

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
};