`#800000` **Štruktúra (HTML)**

-index.html-
--
Hlavný súbor aplikácie, ktorý definuje celú viditeľnú štruktúru stránky. Obsahuje kostru pre bočný panel (.dashboard-sidebar) a hlavný obsah (.dashboard-content). Taktiež načítava všetky potrebné CSS štýly a JavaScriptové knižnice a skripty.

**Hlavná logika (JavaScript)**

-main-wizard.js-
--
Toto je "mozog" celej aplikácie. Spúšťa sa po načítaní stránky a riadi globálny stav (AppState). Načítava dáta z JSON súborov, obsluhuje hlavné udalosti (výber OÚ, výber agendy, reset, zobrazenie nápovedy), inicializuje DocumentProcessor pre aktuálnu agendu a spravuje prepínanie medzi zobrazeniami (uvítacia obrazovka, agenda, nápoveda).

-DocumentProcessor.js-
--
Kľúčová trieda, ktorá riadi celý proces spracovania a generovania dokumentov pre zvolenú agendu. Je zodpovedná za načítanie šablón (podľa potreby, "lazy-loading"), spracovanie nahratých súborov, zobrazenie náhľadu dát a samotné generovanie .docx alebo .xlsx súborov (po riadkoch, v dávkach alebo po skupinách).

**Konfigurácia (JavaScript)**	 

-config.js-
--
Centrálny konfiguračný súbor. Definuje konštanty, ako je cena poštovného (POSTOVNE), cesty ku všetkým .docx šablónam (TEMPLATE_PATHS) a cesty k vzorovým .xlsx súborom na stiahnutie v Centre nápovedy (TEMPLATE_DOWNLOAD_FILES).

-agendaConfigFactory.js-
--
Definuje špecifickú logiku a nastavenia pre každú agendu (Vecné prostriedky, Pracovná povinnosť, atď.). Určuje, aké vstupné súbory sú potrebné, ktorý dátový procesor sa má použiť (napr. vpDataProcessor) a ako sa majú mapovať dáta pre každý generátor dokumentov.

-helpContent.js-
--
Tento súbor obsahuje funkciu getHelpCenterHTML, ktorá generuje a vracia kompletný HTML kód pre Centrum nápovedy. Definuje štruktúru tabov (FAQ, Na stiahnutie, Riešenie problémov) a ich obsah, vrátane textov a rozbaľovacích kariet.

-tour.js-
--
Inicializuje a spravuje interaktívneho sprievodcu aplikáciou pomocou knižnice Shepherd.js. Definuje jednotlivé kroky sprievodcu, ich texty a prvky, na ktoré sa majú zamerať. Ukladá do localStorage, či už bol sprievodca dokončený.

**Pomocné moduly (JavaScript)**	 

-ui.js-
--
Obsahuje pomocné funkcie na ovládanie používateľského rozhrania. Zabezpečuje zobrazovanie modálnych okien (showModal, showErrorModal), "toast" notifikácií (showNotification), prepínanie globálneho spinnera (toggleSpinner) a zmenu stavu tlačidiel (napr. 'loading', 'success').

**Spracovanie dát (JavaScript)**

-vpProcessor.js-
--
Dátový procesor pre agendu "Vecné prostriedky". Načíta dáta zo súborov 'subjekty' a 'psc', spojí ich a vygeneruje nové stĺpce ako ADRESA, PCRD_short a PSC_long.

-ppProcessor.js-
--
Dátový procesor pre agendu "Pracovná povinnosť". Nájde v Exceli riadok s hlavičkou (hľadá 'por. číslo') a extrahuje dáta, pričom pridáva nový stĺpec Obec na základe adresy.

-ubProcessor.js-
--
Dátový procesor pre agendu "Ubytovanie". Nájde v Exceli riadok s hlavičkou (hľadá 'por. č.') a extrahuje dáta, pričom pridáva nový stĺpec Obec na základe adresy.

-drProcessor.js-
--
Dátový procesor pre agendu "Doručovatelia". Nájde v Exceli riadok s hlavičkou (hľadá 'Por. č.') a extrahuje dáta, pričom pridáva nový stĺpec Obec na základe adresy trvalého pobytu.

**Štýly (CSS)**	 

-styles.css-
--
Hlavný súbor CSS. Neobsahuje priame štýly, ale pomocou @import postupne načítava všetky ostatné súbory CSS v správnom poradí.

-_variables.css-
--
Definuje globálne premenné (CSS Custom Properties) pre celú aplikáciu. Obsahuje paletu farieb (--primary-color, --accent-color), veľkosti tieňov (--box-shadow), zaoblenie rohov (--border-radius) a rýchlosť animácií (--transition).

-_layout.css-
--
Definuje základné rozloženie (layout) aplikácie. Štýluje hlavný kontajner (.dashboard-container), bočný panel (.dashboard-sidebar), oblasť s obsahom (.dashboard-content) a štruktúru tabov (.agenda-tabs-container).

-_components.css-
--
Obsahuje štýly pre všetky opakovane použiteľné komponenty. Patria sem tlačidlá (.btn), formulárové prvky (.form-input), zóny na nahrávanie súborov (.file-drop-zone), náhľadové tabuľky (.data-preview-table-wrapper), modálne okná (.modal-overlay) a nové karty pre centrum nápovedy (.accordion-card).

-_notifications.css-
--
Definuje vzhľad všetkých notifikácií. Štýluje vyskakovacie "toast" notifikácie (.notification) a panel centra notifikácií, ktorý sa zobrazí po kliknutí na zvonček (.notification-center-panel).

-_tour.css-
--
Poskytuje vlastné CSS štýly pre knižnicu Shepherd.js, aby vizuál sprievodcu (hlavička, text, tlačidlá) zodpovedal dizajnu aplikácie.

Dátové súbory (JSON)	 

-okresne_urady.json-
--
Statický dátový súbor vo formáte JSON. Obsahuje zoznam všetkých okresných úradov, ich adresy, kontaktné údaje a mená vedúcich, mapované podľa skratky (napr. "BB", "BS").

-emaily_obci.json-
--
Statický dátový súbor vo formáte JSON. Obsahuje zoznam e-mailových adries pre jednotlivé obce, roztriedený podľa príslušného okresného úradu (napr. "BB", "BS").

