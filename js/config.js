// js/config.js
export const POSTOVNE = 4.35;

// OBJEKT OKRESNE_URADY BOL PREMIESTNENÝ DO DATA/okresne_urady.json

/**
 * Centrálna konfigurácia ciest k šablónam dokumentov.
 */
export const TEMPLATE_PATHS = {
    // Spoločné šablóny
    zoznamyDorucenie: 'DATA/TEMP_ZOZNAMY_DORUCENIE.docx',
    pscFile: 'DATA/PSC.xlsx',
    
    // Vecné prostriedky (VP)
    vp: {
        rozhodnutie: 'DATA/VP/TEMP_ROZHODNUTIE_VP.docx',
        obalky: 'DATA/VP/TEMP_OBALKY_VP.docx',
        ph: 'DATA/VP/TEMP_pHAROK_VP.docx',
    },
    // Pracovná povinnosť (PP)
    pp: {
        rozhodnutie: 'DATA/PP/TEMP_ROZHODNUTIE_PP.docx',
        obalky: 'DATA/PP/TEMP_OBALKY_PP.docx',
        ph: 'DATA/PP/TEMP_pHAROK_PP.docx',
    },
    // Ubytovanie (UB)
    ub: {
        rozhodnutie: 'DATA/UB/TEMP_ROZHODNUTIE_UB.docx',
        obalky: 'DATA/UB/TEMP_OBALKY_UB.docx',
        ph: 'DATA/UB/TEMP_pHAROK_UB.docx',
    },
    // Doručovatelia (DR)
    dr: {
        rozhodnutie: 'DATA/DR/TEMP_ROZHODNUTIE_DR.docx',
        obalky: 'DATA/DR/TEMP_OBALKY_DR.docx',
        ph: 'DATA/DR/TEMP_pHAROK_DR.docx',
    }
};

/**
 * Cesty k vzorovým .xlsx súborom na stiahnutie v Centre nápovedy.
 */
export const TEMPLATE_DOWNLOAD_FILES = {
    'VP_vzor.xlsx': 'public/templates/VP_vzor.xlsx',
    'PP_vzor.xlsx': 'public/templates/PP_vzor.xlsx',
    'UB_vzor.xlsx': 'public/templates/UB_vzor.xlsx',
    'DR_vzor.xlsx': 'public/templates/DR_vzor.xlsx'
};
