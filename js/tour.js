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
                <span class="tour-step-indicator">Krok 1 / 4</span>
                <h3>Výber pracoviska</h3>
            </div>`,
        text: 'Vitajte! Najprv vyberte váš okresný úrad. Tým sa načítajú správne údaje o vašom pracovisku (adresa, vedúci a pod.).',
        attachTo: {
            element: '.sidebar-context', // Zmenené
            on: 'right'
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
                <span class="tour-step-indicator">Krok 2 / 4</span>
                <h3>Výber agendy</h3>
            </div>`,
        text: 'Výborne. Teraz si vyberte agendu, s ktorou chcete pracovať. Každá položka predstavuje iný typ dokumentov na generovanie.',
        attachTo: {
            element: '.sidebar-nav', // Zmenené
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

    // KROK 3 (MAIL) BOL ODSTRÁNENÝ
    
    tour.addStep({
        id: 'step3-content', // Pôvodne step4
        title: `
            <div class="tour-header">
                <span class="tour-step-indicator">Krok 3 / 4</span>
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
        id: 'step4-footer', // Pôvodne step5
        title: `
            <div class="tour-header">
                <span class="tour-step-indicator">Krok 4 / 4</span>
                <h3>Nástroje a pomoc</h3>
            </div>`,
        text: 'Tu nájdete užitočné nástroje: Centrum notifikácií, Nápovedu, opätovné spustenie tohto sprievodcu a možnosť resetovať celú aplikáciu.',
        attachTo: {
            element: '.sidebar-footer',
            on: 'top'
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