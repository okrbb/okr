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

    // Definícia krokov sprievodcu
    tour.addStep({
        id: 'step1-ou',
        title: 'Krok 1: Výber úradu',
        text: 'Vitajte! Začnite výberom vášho okresného úradu. Tým sa načítajú správne údaje o vašom pracovisku (adresa, vedúci oddelenia atď.).',
        attachTo: {
            element: '.select-item',
            on: 'right'
        },
        buttons: [{
            text: 'Ďalej',
            action: tour.next
        }]
    });

    tour.addStep({
        id: 'step2-agenda',
        title: 'Krok 2: Výber agendy',
        text: 'Výborne. Teraz si vyberte agendu, s ktorou chcete pracovať. Každá karta predstavuje iný typ dokumentov, ktoré je možné generovať.',
        attachTo: {
            element: '.agenda-selection',
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
    
    tour.addStep({
        id: 'step3-content',
        title: 'Krok 3: Pracovná plocha',
        text: 'Po výbere agendy sa v tejto hlavnej časti zobrazia všetky potrebné nástroje: polia na zadanie čísla spisu, nahrávanie súborov a generovanie dokumentov.',
        attachTo: {
            element: '#dashboard-content',
            on: 'left'
        },
        buttons: [{
            text: 'Späť',
            secondary: true,
            action: tour.back
        }, {
            text: 'Rozumiem, dokončiť',
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