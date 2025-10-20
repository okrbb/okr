export const POSTOVNE = 4.35;

export const OKRESNE_URADY = {
    "BB": {
        Okresny_urad: "Banská Bystrica",
        Odbor_OU: "Odbor krízového riadenia",
        Adresa_OU: "Nám. Ľ. Štúra 5943/1",
        PSC_OU: "974 05 Banská Bystrica",
        Kontakt_OU: "048/43 06 341",
        veduci: "Mgr. Mário Banič",
        OU_v: "V Banskej Bystrici"
    },
    "BS": {
        Okresny_urad: "Banská Štiavnica",
        Odbor_OU: "Odbor krízového riadenia",
        Adresa_OU: "Križovatka 4",
        PSC_OU: "969 01 Banská Štiavnica",
        Kontakt_OU: "09616 45 776",
        veduci: "Mgr. Adriana Melicherčíková",
        OU_v: "V Banskej Štiavnici"
    },
    "BR": {
        Okresny_urad: "Brezno",
        Odbor_OU: "Odbor krízového riadenia",
        Adresa_OU: "Nám. gen. M. R. Štefánika 40",
        PSC_OU: "977 01 Brezno",
        Kontakt_OU: "09616 22 940",
        veduci: "Ing. Gabriela Kupcová",
        OU_v: "V Brezne"
    },
    "DT": {
        Okresny_urad: "Detva",
        Odbor_OU: "Odbor krízového riadenia",
        Adresa_OU: "J. G. Tajovského 1462/9",
        PSC_OU: "962 12 Detva",
        Kontakt_OU: "045/53 21 143",
        veduci: "Ing. Peter Fekiač",
        OU_v: "V Detve"
    },
    "KA": {
        Okresny_urad: "Krupina",
        Odbor_OU: "Odbor krízového riadenia",
        Adresa_OU: "ČSA 2190/3",
        PSC_OU: "963 01 Krupina",
        Kontakt_OU: "045/53 34 817",
        veduci: "Ing. Dáša Oppová",
        OU_v: "V Krupine"
    },
    "LC": {
        Okresny_urad: "Lučenec",
        Odbor_OU: "Odbor krízového riadenia",
        Adresa_OU: "Námestie republiky 26",
        PSC_OU: "984 36 Lučenec",
        Kontakt_OU: "09616 52 170",
        veduci: "Ing. Ervín Jakubec",
        OU_v: "V Lučenci"
    },
    "PT": {
        Okresny_urad: "Poltár",
        Odbor_OU: "Odbor krízového riadenia",
        Adresa_OU: "Železničná 2",
        PSC_OU: "987 01 Poltár",
        Kontakt_OU: "09616 55 764",
        veduci: "Ing. Marek Chromek",
        OU_v: "V Poltári"
    },
    "RA": {
        Okresny_urad: "Revúca",
        Odbor_OU: "Odbor krízového riadenia",
        Adresa_OU: "Komenského 40",
        PSC_OU: "050 01 Revúca",
        Kontakt_OU: "09616 72 940",
        veduci: "Ing. Róbert Jóry",
        OU_v: "V Revúcej"
    },
    "RS": {
        Okresny_urad: "Rimavská Sobota",
        Odbor_OU: "Odbor krízového riadenia",
        Adresa_OU: "Hostinského 4",
        PSC_OU: "979 01 Rimavská Sobota",
        Kontakt_OU: "09616 82 940",
        veduci: "Ing. Lukáš Rapčan",
        OU_v: "V Rimavskej Sobote"
    },
    "VK": {
        Okresny_urad: "Veľký Krtíš",
        Odbor_OU: "Odbor krízového riadenia",
        Adresa_OU: "Lučenská 33",
        PSC_OU: "990 01 Veľký Krtíš",
        Kontakt_OU: "09616 92 940",
        veduci: "Ing. Blanka Šuloková",
        OU_v: "Vo Veľkom Krtíši"
    },
    "ZV": {
        Okresny_urad: "Zvolen",
        Odbor_OU: "Odbor krízového riadenia",
        Adresa_OU: "Študentská 2084/12",
        PSC_OU: "961 08 Zvolen",
        Kontakt_OU: "09616 32 940",
        veduci: "Ing. Mária Jakubová",
        OU_v: "Vo Zvolene"
    },
    "ZC": {
        Okresny_urad: "Žarnovica",
        Odbor_OU: "Odbor krízového riadenia",
        Adresa_OU: "Bystrická 53",
        PSC_OU: "966 81 Žarnovica",
        Kontakt_OU: "09616 45 743",
        veduci: "Ing. Štefan Stripaj",
        OU_v: "V Žarnovici"
    },
    "ZH": {
        Okresny_urad: "Žiar nad Hronom",
        Odbor_OU: "Odbor krízového riadenia",
        Adresa_OU: "Nám. Matice slovenskej 8",
        PSC_OU: "965 01 Žiar nad Hronom",
        Kontakt_OU: " 09616 42 941",
        veduci: "Ing. Milan Kapusta",
        OU_v: "V Žiari nad Hronom"
    }
};

/**
 * Centrálna konfigurácia ciest k šablónam dokumentov.
 */
export const TEMPLATE_PATHS = {
    // Spoločné šablóny
    zoznamyDorucenie: 'TEMP/TEMP_ZOZNAMY_DORUCENIE.docx',
    
    // Vecné prostriedky (VP)
    vp: {
        rozhodnutie: 'TEMP/VP/TEMP_ROZHODNUTIE_VP.docx',
        obalky: 'TEMP/VP/TEMP_OBALKY_VP.docx',
        ph: 'TEMP/VP/TEMP_pHAROK_VP.docx',
    },
    // Pracovná povinnosť (PP)
    pp: {
        rozhodnutie: 'TEMP/PP/TEMP_ROZHODNUTIE_PP.docx',
        obalky: 'TEMP/PP/TEMP_OBALKY_PP.docx',
        ph: 'TEMP/PP/TEMP_pHAROK_PP.docx',
    },
    // Ubytovanie (UB)
    ub: {
        rozhodnutie: 'TEMP/UB/TEMP_ROZHODNUTIE_UB.docx',
        obalky: 'TEMP/UB/TEMP_OBALKY_UB.docx',
        ph: 'TEMP/UB/TEMP_pHAROK_UB.docx',
    },
    // Doručovatelia (DR)
    dr: {
        rozhodnutie: 'TEMP/DR/TEMP_ROZHODNUTIE_DR.docx',
        obalky: 'TEMP/DR/TEMP_OBALKY_DR.docx',
        ph: 'TEMP/DR/TEMP_pHAROK_DR.docx',
    }
};