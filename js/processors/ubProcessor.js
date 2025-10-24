// js/processors/ubProcessor.js

/**
 * Spracováva vstupné dáta pre agendu Ubytovanie (UB).
 * Hľadá hlavičku a extrahuje dáta, pridáva stĺpec 'Obec'.
 */
export const ubDataProcessor = (data) => {
    if (!data || !data.subjekty) throw new Error("Chýba vstupný súbor so zoznamom subjektov.");

    const workbook = XLSX.read(data.subjekty, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    let json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

    // === ZMENA (OPRAVA): Hľadá sa 'por. č.' (s bodkou na konci) ===
    const headerIndex = json.findIndex(row => 
        row.some(cell => String(cell).trim().toLowerCase() === 'por. č.')
    );
    // === KONIEC ZMENY ===

    if (headerIndex === -1) throw new Error('Nenašiel sa riadok s hlavičkou "Por. č."');
    
    // === ZMENA: Pridanie .trim() pre konzistenciu hlavičiek ===
    const headers = json[headerIndex].map(h => String(h).trim());
    // === KONIEC ZMENY ===
    
    headers.push('Obec');
    
    // === ZMENA: Robustnejšie hľadanie stĺpca (trim + lowercase + includes) ===
    const adresaColumnIndex = headers.findIndex(h => 
        String(h).trim().toLowerCase().includes('sídlo alebo miesto pobytu')
    );
    // === KONIEC ZMENY ===
    
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
};