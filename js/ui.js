// ui.js
export function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');

    const switchSection = (sectionId) => {
        // Navigácia
        navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.section === sectionId);
        });

        // Obsah
        sections.forEach(section => {
            if (section.id === sectionId) {
                section.style.display = 'block';
                setTimeout(() => section.classList.add('active'), 10);
            } else {
                section.classList.remove('active');
                setTimeout(() => section.style.display = 'none', 300);
            }
        });
    };

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const sectionId = item.dataset.section;
            if (sectionId) {
                switchSection(sectionId);
                window.history.pushState(null, '', `#${sectionId}`);
            }
        });
    });

     const footerLinks = document.querySelectorAll('.footer-section a');
     footerLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = new URL(link.href).hash.substring(1);
            if (sectionId) {
                switchSection(sectionId);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    });
}

export function showModal({ title, content, pages = [] }) {
    const modalContainer = document.getElementById('modal-container');
    let currentPage = 0;

    const renderPage = (index) => {
        const pageContent = pages[index];
        modalContainer.querySelector('.modal-body').innerHTML = pageContent;
        modalContainer.querySelector('.modal-page-indicator').textContent = `Strana ${index + 1} z ${pages.length}`;
        modalContainer.querySelector('.modal-prev-btn').disabled = (index === 0);
        modalContainer.querySelector('.modal-next-btn').disabled = (index === pages.length - 1);
    };

    const modalHTML = `
        <div class="modal-overlay active">
            <div class="modal-content">
                <button class="modal-close-btn">&times;</button>
                <div class="modal-header">
                    ${title}
                </div>
                <div class="modal-body">${content}</div>
                ${pages.length > 0 ? `
                <div class="modal-navigation">
                    <button class="btn btn--secondary modal-prev-btn">« Späť</button>
                    <span class="modal-page-indicator"></span>
                    <button class="btn btn--secondary modal-next-btn">Ďalej »</button>
                </div>` : ''}
            </div>
        </div>
    `;

    modalContainer.innerHTML = modalHTML;
    const overlay = modalContainer.querySelector('.modal-overlay');

    const closeModal = () => {
        overlay.classList.remove('active');
        setTimeout(() => modalContainer.innerHTML = '', 300);
    };
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.classList.contains('modal-close-btn')) {
            closeModal();
        }
    });

    const tabs = overlay.querySelectorAll('.modal-tab');
    const tabContents = overlay.querySelectorAll('.modal-tab-content');

    if (tabs.length > 0 && tabContents.length > 0) {
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                
                tab.classList.add('active');
                const contentId = `tab-${tab.dataset.tab}`;
                const activeContent = overlay.querySelector(`#${contentId}`);
                if (activeContent) activeContent.classList.add('active');
            });
        });
    }

    const accordionItems = overlay.querySelectorAll('.accordion-item');
    if (accordionItems.length > 0) {
        accordionItems.forEach(item => {
            const header = item.querySelector('.accordion-header');
            header.addEventListener('click', () => {
                const isActive = item.classList.contains('active');
                accordionItems.forEach(otherItem => {
                    otherItem.classList.remove('active');
                });
                if (!isActive) {
                    item.classList.add('active');
                }
            });
        });
    }

    if (pages.length > 0) {
        renderPage(currentPage);
        overlay.querySelector('.modal-next-btn').addEventListener('click', () => {
            if (currentPage < pages.length - 1) {
                currentPage++;
                renderPage(currentPage);
            }
        });
        overlay.querySelector('.modal-prev-btn').addEventListener('click', () => {
            if (currentPage > 0) {
                currentPage--;
                renderPage(currentPage);
            }
        });
    }
}

export function showErrorModal({ title = 'Chyba', message, details = '' }) {
    const titleHTML = `<div class="help-center-header"><i class="fas fa-exclamation-triangle" style="color: var(--danger-color);"></i><h3>${title}</h3></div>`;
    const content = `<p>${message}</p>${details ? `<pre><code>${details}</code></pre>` : ''}`;
    showModal({ title: titleHTML, content });
}


export function showNotification(message, type = 'info', duration = 3000) {
    const container = document.body;
    const notification = document.createElement('div');
    notification.className = `notification notification--${type}`;
    notification.textContent = message;
    container.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 10);

    setTimeout(() => {
        notification.classList.remove('show');
        notification.addEventListener('transitionend', () => notification.remove());
    }, duration);
}

export function toggleSpinner(show) {
    const spinner = document.getElementById('spinner-overlay');
    if (spinner) {
        spinner.style.display = show ? 'flex' : 'none';
    }
}

export function setButtonState(button, state, text = '') {
    if (!button) return;

    if (!button.querySelector('.btn-text')) {
        button.innerHTML = `<span class="btn-text">${button.innerHTML}</span>`;
    }
    if (!button.querySelector('.btn-spinner')) {
        button.insertAdjacentHTML('afterbegin', '<span class="btn-spinner"></span>');
    }

    const buttonText = button.querySelector('.btn-text');

    switch(state) {
        case 'loading':
            button.classList.add('loading');
            button.disabled = true;
            if (text) buttonText.textContent = text;
            break;
        case 'success':
            button.classList.remove('loading');
            button.disabled = false;
            break;
        case 'reset':
        default:
            button.classList.remove('loading');
            button.disabled = false;
            if (text) buttonText.textContent = text;
            break;
    }
}

export function createProgressTracker(totalItems, titleText) {
    let completed = 0;

    const modalContent = `
        <div id="progress-modal">
            <div class="global-progress-bar" style="width:100%; height:20px; background-color:#eee; border-radius:10px; overflow:hidden;">
                <div class="global-progress-fill" style="width:0%; height:100%; background-color:var(--primary-color); transition:width 0.2s;"></div>
            </div>
            <div class="global-progress-text" style="text-align:center; margin-top:10px;">Pripravuje sa...</div>
            <div class="global-progress-percentage" style="text-align:center; font-weight:bold; font-size:1.2em;">0%</div>
        </div>
    `;
    const titleHTML = `<div class="help-center-header"><i class="fas fa-cogs"></i><h3>${titleText}</h3></div>`;
    showModal({ title: titleHTML, content: modalContent });

    const modal = document.getElementById('progress-modal');
    const fill = modal.querySelector('.global-progress-fill');
    const text = modal.querySelector('.global-progress-text');
    const percentage = modal.querySelector('.global-progress-percentage');
    
    return {
        increment: function(detailText) {
            completed++;
            const percent = Math.round((completed / totalItems) * 100);
            fill.style.width = `${percent}%`;
            text.textContent = detailText || `Spracované: ${completed} / ${totalItems}`;
            percentage.textContent = `${percent}%`;
        },
        close: function() {
            setTimeout(() => {
                 document.querySelector('.modal-overlay .modal-close-btn')?.click();
            }, 500);
        },
    };
};

export function initFileDropZones() {
    const dropZones = document.querySelectorAll('.file-drop-zone');

    dropZones.forEach(zone => {
        const input = zone.querySelector('.file-input');
        const prompt = zone.querySelector('.file-drop-zone__prompt');

        const setActive = (active) => zone.classList.toggle('active', active);

        zone.addEventListener('dragenter', (e) => { e.preventDefault(); if(!input.disabled) setActive(true); });
        zone.addEventListener('dragover', (e) => { e.preventDefault(); if(!input.disabled) setActive(true); });
        zone.addEventListener('dragleave', (e) => { e.preventDefault(); setActive(false); });
        
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            if(input.disabled) return;
            setActive(false);
            if (e.dataTransfer.files.length) {
                input.files = e.dataTransfer.files;
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        input.addEventListener('change', () => {
            if (prompt) {
                if (input.files.length > 0) {
                    prompt.textContent = input.files[0].name;
                    zone.classList.add('loaded');
                } else {
                    prompt.textContent = 'Presuňte súbor sem alebo kliknite';
                    zone.classList.remove('loaded');
                }
            } else if (input.files.length > 0) {
                 zone.classList.add('loaded');
            } else {
                 zone.classList.remove('loaded');
            }
        });
    });
}