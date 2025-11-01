// js/Validator.js

/**
 * Normalizuje reťazec hlavičky: odstráni okolité medzery, 
 * prevedie na malé písmená a nahradí viacnásobné medzery jednou.
 * @param {string} header - Názov hlavičky.
 * @returns {string} Normalizovaný reťazec.
 */
function normalizeHeader(header) {
    if (!header) return '';
    
    // 1. Prevedie na reťazec, orezáva biele znaky, prevedie na malé.
    let normalized = String(header).trim().toLowerCase();
    
    // 2. Nahradí akúkoľvek sekvenciu ne-písmen/ne-čísiel/ne-medzier JEDNOU medzerou.
    normalized = normalized.replace(/[^a-z0-9\s]+/g, ' '); 
    
    // 3. Nahradí viacnásobné medzery jednou a orezáva výsledok.
    return normalized.replace(/\s+/g, ' ').trim();
}

/**
 * Pomocná funkcia na nájdenie kľúča (názvu stĺpca) v columnMap bez ohľadu na veľkosť písmen a medzery.
 * @param {object} columnMap - Objekt mapujúci názvy stĺpcov na ich indexy.
 * @param {string} name - Očakávaný názov stĺpca.
 */
function findKey(columnMap, name) {
    // Normalizovaný názov z požiadavky
    const normalizedName = normalizeHeader(name);
    
    // Vyhľadá kľúč, ktorý sa zhoduje s normalizovaným názvom.
    const foundKey = Object.keys(columnMap).find(key => normalizeHeader(key) === normalizedName);
    
    // Ak sa kľúč nenašiel, skúsime to bez normalizácie na malé písmená (fallback pre extrémne prípady)
    if (!foundKey) {
        return Object.keys(columnMap).find(key => String(key).trim() === name.trim()) || null;
    }
    
    return foundKey || null; 
}

/**
 * Validuje IČO alebo rodné číslo len na prítomnosť a formát.
 *
 * Pre RČ (9 alebo 10 číslic): vyžaduje len prítomnosť a dĺžku.
 * Pre IČO (8 číslic): vyžaduje len prítomnosť a dĺžku.
 *
 * @param {string} id - Rodné číslo alebo IČO.
 * @returns {string|null} - Vráti chybovú správu, ak je neplatné, inak null.
 */
function validateIdentifier(id) {
    if (!id || String(id).trim() === '') {
        return "Chýbajúce IČO alebo rodné číslo.";
    }
    
    const cleanId = String(id).trim().replace(/[^0-9]/g, '');

    // 1. Kontrola pre IČO (presne 8 číslic)
    if (cleanId.length === 8) {
        return null; // IČO je v poriadku
    }
    
    // 2. Kontrola pre Rodné číslo (9 alebo 10 číslic)
    if (cleanId.length === 9 || cleanId.length === 10) {
        return null; // RČ je v poriadku
    }
    
    return `Neplatný identifikátor: Očakáva sa 8 číslic (IČO) alebo 9/10 číslic (Rodné číslo). Zadané: "${id}".`;
}

/**
 * Všeobecná kontrola, ktorá povoľuje aj hodnotu 0 (pre Č. popisné, EČV).
 * **VÝRAZNÁ ÚPRAVA: Uprednostňuje kontrolu čistej numerickej nuly.**
 * * @param {Array<string>} row - Riadok dát.
 * @param {object} columnMap - Mapa stĺpcov.
 * @param {string} keyName - Názov kľúča na hľadanie.
 * @param {string} errorMessage - Chybová správa pri chýbaní.
 * @param {Array} errors - Pole pre pridanie chýb.
 */
function checkValueOrZero(row, columnMap, keyName, errorMessage, errors) {
    const key = findKey(columnMap, keyName);
    if (!key) {
        errors.push(`Nenašiel sa stĺpec '${keyName}'.`);
        return;
    }

    const value = row[columnMap[key]];
    const strValue = String(value).trim();
    
    // KĽÚČOVÁ ZMENA: Ak je hodnota NUMERICKÁ 0 (alebo reťazec "0"), akceptujeme ju okamžite.
    // To je potrebné, pretože sheet_to_json môže konvertovať 0 na reálnu numerickú nulu.
    if (value === 0 || value === '0' || strValue === '0' || strValue === '0.0') {
        return; 
    }
    
    // Ak hodnota neexistuje (null/undefined) alebo je prázdny reťazec, hlási sa chyba.
    if (!value || strValue === '') {
        errors.push(errorMessage);
    }
}


/**
 * Validuje jeden riadok dát na základe kľúča agendy.
 * @param {string} agendaKey - Kľúč agendy (napr. 'dr', 'pp', 'ub', 'vp').
 * @param {Array<string>} row - Pole hodnôt v riadku.
 * @param {object} columnMap - Objekt mapujúci názvy stĺpcov na ich indexy.
 * @returns {Array<string>} - Pole chybových správ pre daný riadok.
 */
export function validateRow(agendaKey, row, columnMap) {
    const errors = [];

    switch (agendaKey) {
        
        case 'vp': {
            // === LOGIKA VECNÉ PROSTRIEDKY ===
            const dodavatelKey = findKey(columnMap, 'DODÁVATEĽ');
            const ulicaKey = findKey(columnMap, 'ULICA');
            const obecKey = findKey(columnMap, 'MESTO (OBEC)');
            const okresKey = findKey(columnMap, 'OKRES');
            const icoKey = findKey(columnMap, 'IČO');
            
            // 1. Dodávateľ (Prísna kontrola)
            if (!dodavatelKey || !row[columnMap[dodavatelKey]] || String(row[columnMap[dodavatelKey]]).trim() === '') {
                errors.push("Chýbajúci názov Dodávateľa.");
            }

            // 2. IČO / RČ
            if (!icoKey) {
                errors.push("Nenašiel sa stĺpec 'IČO'.");
            } else {
                const idError = validateIdentifier(row[columnMap[icoKey]]);
                if (idError) errors.push(idError.replace('Chýbajúce IČO alebo rodné číslo.', 'Chýbajúce IČO/RČ.'));
            }
            
            // 3. EČV (Povoľuje 0)
            checkValueOrZero(row, columnMap, 'EČV', "Chýbajúce EČV.", errors);

            // 4. Adresa (Ulica, Č. popisné, Mesto(obec))
            if (!ulicaKey || !row[columnMap[ulicaKey]] || String(row[columnMap[ulicaKey]]).trim() === '') {
                errors.push("Chýbajúca Ulica.");
            }
            // Č. POPISNÉ (Povoľuje 0)
            checkValueOrZero(row, columnMap, 'Č. POPISNÉ', "Chýbajúce Č. popisné.", errors);

            if (!obecKey || !row[columnMap[obecKey]] || String(row[columnMap[obecKey]]).trim() === '') {
                errors.push("Chýbajúce Mesto (Obec).");
            }

            // 5. Okres
            if (!okresKey || !row[columnMap[okresKey]] || String(row[columnMap[okresKey]]).trim() === '') {
                errors.push("Chýbajúci Okres.");
            }

            break;
        }
        
        case 'dr': {
            // Logika Doručovateľov 
            const menoKey = findKey(columnMap, 'Titul, meno a priezvisko');
            const rcKey = findKey(columnMap, 'rodné číslo');
            const adresaKey = findKey(columnMap, 'adresa trvalého pobytu');
            const obecKey = findKey(columnMap, 'Obec'); 

            // 1. Validácia Meno a Priezvisko
            if (!menoKey || !row[columnMap[menoKey]] || String(row[columnMap[menoKey]]).trim() === '') {
                errors.push("Chýbajúce meno a priezvisko.");
            }

            // 2. Validácia Rodné číslo (prítomnosť + formát)
            if (!rcKey) {
                errors.push("Nenašiel sa stĺpec 'rodné číslo'.");
            } else {
                const rcValue = String(row[columnMap[rcKey]] || '').trim();
                const rcError = validateIdentifier(rcValue);
                if (rcError) errors.push(rcError.replace('Neplatný identifikátor: Očakáva sa 8 číslic (IČO) alebo ', 'Neplatné RČ: ').replace('Chýbajúce IČO alebo rodné číslo.', 'Chýbajúce Rodné číslo.'));
            }

            // 3. Validácia Adresa
            if (!adresaKey || !row[columnMap[adresaKey]] || String(row[columnMap[adresaKey]]).trim() === '') {
                errors.push("Chýbajúca adresa trvalého pobytu.");
            }

            // 4. Validácia Miesto nástupu (odvodená Obec)
            if (!obecKey) {
                 errors.push("Nenašiel sa odvodený stĺpec 'Obec'. Chyba v spracovaní.");
            } else if (row[columnMap[obecKey]] === 'Nezaradené') {
                errors.push("Z adresy sa nepodarilo určiť obec (miesto nástupu). Skontrolujte formát adresy (napr. chýbajúca čiarka pred PSČ).");
            }
            
            break;
        }

        case 'ub': {
            // === LOGIKA UBYTOVANIA ===
            const vlastnikKey = findKey(columnMap, 'obchodné meno alebo názov alebo meno a priezvisko');
            const sidloKey = findKey(columnMap, 'sídlo alebo miesto pobytu');
            const idKey = findKey(columnMap, 'IČO alebo rodné číslo');
            const nehnutelnostKey = findKey(columnMap, 'názov (identifikácia) nehnuteľnosti');
            const nAdresaKey = findKey(columnMap, 'adresa, na ktorej sa nehnuteľnosť nachádza');
            const ziadatelKey = findKey(columnMap, 'názov žiadateľa');
            const zAdresaKey = findKey(columnMap, 'adresa žiadateľa');
            
            // 1. Vlastník
            if (!vlastnikKey || !row[columnMap[vlastnikKey]] || String(row[columnMap[vlastnikKey]]).trim() === '') {
                errors.push("Chýbajúce meno/názov vlastníka.");
            }

            // 2. Sídlo/Pobyt
            if (!sidloKey || !row[columnMap[sidloKey]] || String(row[columnMap[sidloKey]]).trim() === '') {
                errors.push("Chýbajúce sídlo/miesto pobytu.");
            }

            // 3. IČO/RČ (Kontrola prítomnosti a formátu)
            if (!idKey) {
                errors.push("Nenašiel sa stĺpec 'IČO alebo rodné číslo'.");
            } else {
                const idError = validateIdentifier(row[columnMap[idKey]]);
                if (idError) errors.push(idError);
            }

            // 4. Názov nehnuteľnosti
            if (!nehnutelnostKey || !row[columnMap[nehnutelnostKey]] || String(row[columnMap[nehnutelnostKey]]).trim() === '') {
                errors.push("Chýbajúci názov/identifikácia nehnuteľnosti.");
            }

            // 5. Adresa nehnuteľnosti
            if (!nAdresaKey || !row[columnMap[nAdresaKey]] || String(row[columnMap[nAdresaKey]]).trim() === '') {
                errors.push("Chýbajúca adresa nehnuteľnosti.");
            }

            // 6. Názov žiadateľa
            if (!ziadatelKey || !row[columnMap[ziadatelKey]] || String(row[columnMap[ziadatelKey]]).trim() === '') {
                errors.push("Chýbajúci názov žiadateľa.");
            }

            // 7. Adresa žiadateľa
            if (!zAdresaKey || !row[columnMap[zAdresaKey]] || String(row[columnMap[zAdresaKey]]).trim() === '') {
                errors.push("Chýbajúca adresa žiadateľa.");
            }

            break;
        }

        case 'pp': {
            // === LOGIKA PRACOVNEJ POVINNOSTI ===
            const menoKey = findKey(columnMap, 'Meno');
            const priezviskoKey = findKey(columnMap, 'Priezvisko');
            const rcKey = findKey(columnMap, 'Rodné číslo');
            const adresaKey = findKey(columnMap, 'Miesto pobytu / Adresa trvalého pobytu');
            const ouKey = findKey(columnMap, 'OÚ');
            const miestoNastupuKey = findKey(columnMap, 'Miesto nástupu k vojenskému útvaru');
            const vzdelanieKey = findKey(columnMap, 'Požadované vzdelanie na funkciu');

            // 1. Meno
            if (!menoKey || !row[columnMap[menoKey]] || String(row[columnMap[menoKey]]).trim() === '') {
                errors.push("Chýbajúce Meno.");
            }

            // 2. Priezvisko
            if (!priezviskoKey || !row[columnMap[priezviskoKey]] || String(row[columnMap[priezviskoKey]]).trim() === '') {
                errors.push("Chýbajúce Priezvisko.");
            }

            // 3. Rodné číslo
            if (!rcKey) {
                errors.push("Nenašiel sa stĺpec 'Rodné číslo'.");
            } else {
                const rcValue = String(row[columnMap[rcKey]] || '').trim();
                const rcError = validateIdentifier(rcValue);
                if (rcError) errors.push(rcError.replace('Neplatný identifikátor: Očakáva sa 8 číslic (IČO) alebo ', 'Neplatné RČ: ').replace('Chýbajúce IČO alebo rodné číslo.', 'Chýbajúce Rodné číslo.'));
            }

            // 4. Miesto pobytu / Adresa trvalého pobytu
            if (!adresaKey || !row[columnMap[adresaKey]] || String(row[columnMap[adresaKey]]).trim() === '') {
                errors.push("Chýbajúce Miesto pobytu / Adresa trvalého pobytu.");
            }

            // 5. OÚ
            if (!ouKey || !row[columnMap[ouKey]] || String(row[columnMap[ouKey]]).trim() === '') {
                errors.push("Chýbajúci Okresný úrad (OÚ).");
            }

            // 6. Miesto nástupu k vojenskému útvaru
            if (!miestoNastupuKey || !row[columnMap[miestoNastupuKey]] || String(row[columnMap[miestoNastupuKey]]).trim() === '') {
                errors.push("Chýbajúce Miesto nástupu k vojenskému útvaru.");
            }

            // 7. Požadované vzdelanie
            if (!vzdelanieKey || !row[columnMap[vzdelanieKey]] || String(row[columnMap[vzdelanieKey]]).trim() === '') {
                errors.push("Chýbajúce Požadované vzdelanie na funkciu.");
            }
            
            break;
        }
    }

    return errors;
}