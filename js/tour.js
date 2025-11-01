// js/tour.js

/**
 * Inicializuje a spúšťa interaktívneho sprievodcu aplikáciou pomocou knižnice Shepherd.js.
 * Sprievodca sa zobrazí iba v prípade, že ho používateľ ešte nedokončil.
 */
export function startGuidedTour() {
    // Nezobrazovať sprievodcu, ak už bol dokončený
    if (localStorage.getItem('krokr-tour-completed') === 'true') {
        return;
    }

    const tour = new Shepherd.Tour({
        useModalOverlay: true,
        defaultStepOptions: {
            classes: 'shepherd-custom-theme',
            scrollTo: { behavior: 'smooth', block: 'center' },
            cancelIcon: {
                enabled: true,
                label: 'Zavrieť sprievodcu'
            }
        }
    });

    // Definícia krokov sprievodcu s novou, konzistentnou hlavičkou
    tour.addStep({
        id: 'step1-ou',
        title: `
            <div class="tour-header">
                <span class="tour-step-indicator">Krok 1 / 5</span>
                <h3>Výber pracoviska</h3>
            </div>`,
        text: 'Vitajte! Najprv vyberte váš okresný úrad. Tým sa načítajú správne údaje o vašom pracovisku (adresa, vedúci a pod.).',
        attachTo: {
            element: '#ou-select-wrapper', 
            on: 'bottom'
        },
        buttons: [{
            text: 'Ďalej',
            action: tour.next
        }]
    });

    tour.addStep({
        id: 'step2-agenda',
        title: `
            <div class="tour-header">
                <span class="tour-step-indicator">Krok 2 / 5</span>
                <h3>Výber agendy</h3>
            </div>`,
        text: 'Výborne. Teraz si vyberte agendu, s ktorou chcete pracovať. Každá položka predstavuje iný typ dokumentov na generovanie.',
        attachTo: {
            element: '.sidebar-nav', // Tento zostáva, je stále v bočnom paneli
            on: 'right'
        },
        buttons: [{
            text: 'Späť',
            secondary: true,
            action: tour.back
        }, {
            text: 'Ďalej',
            action: tour.next
        }]
    });

    // === ZAČIATOK ZMENY: Aktualizácia textu pre Asistenta ===
    tour.addStep({
        id: 'step3-history',
        title: `
            <div class="tour-header">
                <span class="tour-step-indicator">Krok 3 / 5</span>
                <h3>Asistent</h3>
            </div>`,
        text: 'Tu bude Asistent zobrazovať všetky dôležité informácie, úspechy alebo chyby, ktoré sa stanú počas práce s aplikáciou.',
        attachTo: {
            element: '.sidebar-notifications', //
            on: 'right'
        },
        buttons: [{
            text: 'Späť',
            secondary: true,
            action: tour.back
        }, {
            text: 'Ďalej',
            action: tour.next
        }]
    });
    // === KONIEC ZMENY ===

    tour.addStep({
        // === ZMENA: Aktualizované ID a číslovanie ===
        id: 'step4-content',
        title: `
            <div class="tour-header">
                <span class="tour-step-indicator">Krok 4 / 5</span>
                <h3>Pracovná plocha</h3>
            </div>`,
        text: 'Po výbere agendy sa tu zobrazí pracovná plocha rozdelená na karty "Spracovanie" (pre vkladanie súborov) a "Generovanie" (pre export dokumentov).', // Upravený text
        attachTo: {
            element: '#dashboard-content',
            on: 'left'
        },
        buttons: [{
            text: 'Späť',
            secondary: true,
            action: tour.back
        }, {
            text: 'Ďalej',
            action: tour.next
        }]
    });

    tour.addStep({
        // === ZMENA: Aktualizované ID a číslovanie ===
        id: 'step5-footer',
        title: `
            <div class="tour-header">
                <span class="tour-step-indicator">Krok 5 / 5</span>
                <h3>Nástroje a pomoc</h3>
            </div>`,
        text: 'Tu nájdete užitočné nástroje: Centrum nápovedy, opätovné spustenie tohto sprievodcu, zmazanie histórie Asistenta a možnosť resetovať celú aplikáciu.',
        attachTo: {
            element: '.header-actions',
            on: 'bottom'
        },
        buttons: [{
            text: 'Späť',
            secondary: true,
            action: tour.back
        }, {
            text: 'Dokončiť',
            action: tour.complete
        }]
    });

    // Uloží informáciu o dokončení, aby sa sprievodca znova nezobrazoval
    const setTourCompleted = () => {
        localStorage.setItem('krokr-tour-completed', 'true');
    };
    
    tour.on('complete', setTourCompleted);
    tour.on('cancel', setTourCompleted);

    tour.start();
}