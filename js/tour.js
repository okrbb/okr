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
                <h3>Výber úradu</h3>
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
            <div class="tour-header">
                <span class="tour-step-indicator">Krok 2 / 5</span>
                <h3>Výber agendy</h3>
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
        id: 'step3-mail',
        title: `
            <div class="tour-header">
                <span class="tour-step-indicator">Krok 3 / 5</span>
                <h3>Odoslanie pošty</h3>
            </div>`,
        text: 'Jednotlivým obciam sa odošlú zoznamy subjektov, ktorým môže byť uložená v zmysle § 18 zákona č. 319/2002 Z. z. o obrane Slovenskej republiky povynnosť poskytnúť v čase vojny alebo vojnového stavu vecné prostriedky na plnenie úloh obrany štátu.',
        attachTo: {
            element: '#sidebar-step-3',
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
        id: 'step4-content',
        title: `
            <div class="tour-header">
                <span class="tour-step-indicator">Krok 4 / 5</span>
                <h3>Pracovná plocha</h3>
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
            text: 'Ďalej',
            action: tour.next
        }]
    });

    tour.addStep({
        id: 'step5-footer',
        title: `
            <div class="tour-header">
                <span class="tour-step-indicator">Krok 5 / 5</span>
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