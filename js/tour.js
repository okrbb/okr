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
            <div class="tour-step-header">
                <i class="fas fa-route"></i>
                <div class="title-group">
                    <h3>Krok 1/3: Výber úradu</h3>
                    <span>Začnite výberom pracoviska</span>
                </div>
            </div>`,
        text: 'Vitajte! Najprv vyberte váš okresný úrad. Tým sa načítajú správne údaje o vašom pracovisku (adresa, vedúci a pod.).',
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
        title: `
            <div class="tour-step-header">
                <i class="fas fa-route"></i>
                <div class="title-group">
                    <h3>Krok 2/3: Výber agendy</h3>
                    <span>Zvoľte typ dokumentov</span>
                </div>
            </div>`,
        text: 'Výborne. Teraz si vyberte agendu, s ktorou chcete pracovať. Každá karta predstavuje iný typ dokumentov na generovanie.',
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
        title: `
            <div class="tour-step-header">
                <i class="fas fa-route"></i>
                <div class="title-group">
                    <h3>Krok 3/3: Pracovná plocha</h3>
                    <span>Hlavný priestor pre vašu prácu</span>
                </div>
            </div>`,
        text: 'Po výbere agendy sa v tejto časti zobrazia všetky potrebné nástroje na nahrávanie súborov a generovanie dokumentov.',
        attachTo: {
            element: '#dashboard-content',
            on: 'left'
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