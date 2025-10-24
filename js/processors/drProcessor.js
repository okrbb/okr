// js/processors/drProcessor.js

/**
 * Spracováva vstupné dáta pre agendu Doručovatelia (DR).
 * Hľadá hlavičku a extrahuje dáta, pridáva stĺpec 'Obec'.
 */
export const drDataProcessor = (data) => {
    if (!data || !data.subjekty) throw new Error("Chýba vstupný súbor so zoznamom subjektov.");

    const workbook = XLSX.read(data.subjekty, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    let json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

    // === ZMENA: Robustnejšie hľadanie hlavičky (trim + lowercase) ===
    const headerIndex = json.findIndex(row => 
        row.some(cell => String(cell).trim().toLowerCase() === 'por. č.')
    );
    // === KONIEC ZMENY ===
    
    if (headerIndex === -1) throw new Error('Nenašiel sa riadok s hlavičkou "Por. č."');

    // === ZMENA: Pridanie .map() na normalizáciu všetkých hlavičiek ===
    const headers = json[headerIndex].map(h => String(h).trim());
    // === KONIEC ZMENY ===
    
    // === ZMENA: Normalizácia hľadania (hoci už bola správna, pre istotu) ===
    const adresaColumnIndex = headers.findIndex(h => String(h).trim().toLowerCase() === 'adresa trvalého pobytu');
    // === KONIEC ZMENY ===
    
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
};