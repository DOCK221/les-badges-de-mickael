const STORAGE_KEY = 'badges_mickael_personnes';
const MAX_NUMEROS = 7;
let personnes = [];
let editingId = null;

const DEFAULT_PASSWORD = 'admin123';
const SECRET_ANSWER = 'les badges de mickael';

function initApp() {
    setTodayDate();
    loadData();
    initTabs();
    setupLogoUpload();
    setupLogin();
    setupEvents();
    renderNumerosFields(['']);
}

function setTodayDate() {
    const dateField = document.getElementById('dateInscription');
    if (dateField && !dateField.value) {
        dateField.value = new Date().toISOString().split('T')[0];
    }
}

function getNumerosUrgence(person) {
    if (Array.isArray(person.numerosUrgence) && person.numerosUrgence.length > 0) {
        return person.numerosUrgence.filter(Boolean);
    }
    if (person.numero) return [person.numero];
    return [];
}

function normalizePerson(p) {
    const numeros = getNumerosUrgence(p);
    return {
        ...p,
        numerosUrgence: numeros,
        numero: numeros[0] || '',
        maladie: p.maladie || ''
    };
}

function loadData() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            personnes = JSON.parse(stored).map(normalizePerson);
        } catch (e) {
            personnes = [];
        }
    } else {
        personnes = [
            normalizePerson({
                identifiant: '12345',
                nom: 'Martin',
                prenom: 'Sophie',
                domiciliation: 'Nantes',
                numerosUrgence: ['0612345678', '0698765432'],
                dateInscription: '2026-04-22',
                maladie: 'Épilepsie — crises possibles, ne rien mettre dans la bouche.',
                aideApporter: "Rassurer la personne, l'allonger sur le côté si nécessaire, appeler le 15 en cas de crise.",
                gestesSecours: "Surveiller la respiration, sécuriser l'environnement, ne rien mettre dans la bouche."
            }),
            normalizePerson({
                identifiant: '67890',
                nom: 'Bernard',
                prenom: 'Lucas',
                domiciliation: 'Rezé',
                numerosUrgence: ['0789456123'],
                dateInscription: '2026-04-22',
                maladie: "Diabète — risque d'hypoglycémie.",
                aideApporter: 'Donner du sucre si la personne est consciente, rester avec elle.',
                gestesSecours: 'Contacter les secours si malaise important, surveiller son état.'
            })
        ];
        saveData();
    }

    renderTable();
    updateSelectPerson();
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(personnes.map(normalizePerson)));
}

function renderNumerosFields(values) {
    const list = document.getElementById('numerosUrgenceList');
    const nums = (values && values.length) ? values.slice(0, MAX_NUMEROS) : [''];

    list.innerHTML = nums.map((val, index) => `
        <div class="numero-row">
            <input
                type="tel"
                class="numero-input"
                id="numero-${index}"
                value="${escapeHtml(val)}"
                placeholder="0612345678"
                maxlength="10"
                inputmode="numeric"
                aria-label="Numéro de téléphone ${index + 1}"
                ${index === 0 ? 'required' : ''}
            >
            ${index > 0
                ? `<button type="button" class="btn-icon" data-remove="${index}" aria-label="Supprimer le numéro ${index + 1}">−</button>`
                : ''}
        </div>
    `).join('');

    list.querySelectorAll('[data-remove]').forEach(btn => {
        btn.addEventListener('click', () => {
            const current = Array.from(document.querySelectorAll('.numero-input')).map(i => i.value);
            current.splice(Number(btn.getAttribute('data-remove')), 1);
            renderNumerosFields(current.length ? current : ['']);
        });
    });

    updateAddNumeroButton();
}

function collectNumerosFromForm() {
    return Array.from(document.querySelectorAll('.numero-input'))
        .map(input => input.value.trim())
        .filter(Boolean);
}

function updateAddNumeroButton() {
    const count = document.querySelectorAll('.numero-input').length;
    const btn = document.getElementById('addNumeroBtn');
    btn.disabled = count >= MAX_NUMEROS;
    btn.setAttribute('aria-disabled', count >= MAX_NUMEROS ? 'true' : 'false');
    btn.style.display = count >= MAX_NUMEROS ? 'none' : 'inline-flex';
}

function addOrUpdatePerson(event) {
    event.preventDefault();

    const identifiant = document.getElementById('identifiant').value.trim();
    const nom = document.getElementById('nom').value.trim();
    const prenom = document.getElementById('prenom').value.trim();
    const domiciliation = document.getElementById('domiciliation').value.trim();
    const dateInscription = document.getElementById('dateInscription').value;
    const numerosUrgence = collectNumerosFromForm();
    const maladie = document.getElementById('maladie').value.trim();
    const erreurMsg = document.getElementById('erreur-message');

    if (!/^\d{5}$/.test(identifiant)) {
        alert("L'identifiant doit contenir exactement 5 chiffres.");
        return;
    }

    if (numerosUrgence.length === 0) {
        erreurMsg.style.display = 'block';
        alert("Ajoutez au moins un numéro d'urgence.");
        return;
    }

    if (numerosUrgence.some(n => !/^\d{10}$/.test(n))) {
        erreurMsg.style.display = 'block';
        return;
    }
    erreurMsg.style.display = 'none';

    if (!nom || !prenom || !dateInscription) {
        alert('Veuillez remplir tous les champs obligatoires.');
        return;
    }

    const duplicate = personnes.find(p => p.identifiant === identifiant && p.identifiant !== editingId);
    if (duplicate) {
        alert('Cet identifiant existe déjà.');
        return;
    }

    if (editingId) {
        const index = personnes.findIndex(p => p.identifiant === editingId);
        if (index !== -1) {
            personnes[index] = normalizePerson({
                ...personnes[index],
                identifiant,
                nom,
                prenom,
                domiciliation,
                numerosUrgence,
                dateInscription,
                maladie
            });
        }
        editingId = null;
        document.getElementById('resetFormBtn').textContent = 'Nouvelle fiche';
    } else {
        personnes.push(normalizePerson({
            identifiant,
            nom,
            prenom,
            domiciliation,
            numerosUrgence,
            dateInscription,
            maladie,
            aideApporter: '',
            gestesSecours: ''
        }));
    }

    saveData();
    renderTable();
    updateSelectPerson();
    resetForm();
    showToast('Personne enregistrée avec succès');
}

function resetForm() {
    document.getElementById('identifiant').value = '';
    document.getElementById('nom').value = '';
    document.getElementById('prenom').value = '';
    document.getElementById('domiciliation').value = '';
    document.getElementById('maladie').value = '';
    renderNumerosFields(['']);
    setTodayDate();
    editingId = null;
    document.getElementById('resetFormBtn').textContent = 'Nouvelle fiche';
    document.getElementById('erreur-message').style.display = 'none';
}

function editPerson(identifiant) {
    const person = personnes.find(p => p.identifiant === identifiant);
    if (!person) return;

    document.getElementById('identifiant').value = person.identifiant;
    document.getElementById('nom').value = person.nom;
    document.getElementById('prenom').value = person.prenom;
    document.getElementById('domiciliation').value = person.domiciliation || '';
    document.getElementById('dateInscription').value = person.dateInscription || '';
    document.getElementById('maladie').value = person.maladie || '';
    const nums = getNumerosUrgence(person);
    renderNumerosFields(nums.length ? nums : ['']);
    editingId = person.identifiant;
    document.getElementById('resetFormBtn').textContent = 'Annuler édition';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deletePerson(identifiant) {
    if (!confirm('Supprimer cette personne ?')) return;
    personnes = personnes.filter(p => p.identifiant !== identifiant);
    saveData();
    renderTable();
    updateSelectPerson();
    if (editingId === identifiant) resetForm();
    showToast('Personne supprimée');
}

function renderTable() {
    const tbody = document.getElementById('tableBody');

    if (personnes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Aucune personne enregistrée</td></tr>';
        return;
    }

    tbody.innerHTML = personnes.map(p => {
        const nums = getNumerosUrgence(p);
        return `
        <tr>
            <td>${escapeHtml(p.identifiant)}</td>
            <td>${escapeHtml(p.nom)}</td>
            <td>${escapeHtml(p.prenom)}</td>
            <td>${escapeHtml(p.domiciliation || '-')}</td>
            <td>${escapeHtml(nums.join(', ') || '-')}</td>
            <td>${escapeHtml(p.dateInscription || '-')}</td>
            <td>
                <button type="button" class="action-btn" data-edit="${escapeHtml(p.identifiant)}" style="background:var(--jaune);color:#2c3e50;">Modifier</button>
                <button type="button" class="action-btn btn-danger" data-delete="${escapeHtml(p.identifiant)}">Supprimer</button>
            </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-edit]').forEach(btn => {
        btn.addEventListener('click', () => editPerson(btn.getAttribute('data-edit')));
    });
    tbody.querySelectorAll('[data-delete]').forEach(btn => {
        btn.addEventListener('click', () => deletePerson(btn.getAttribute('data-delete')));
    });
}

function updateSelectPerson() {
    const select = document.getElementById('selectPersonGeste');
    if (!select) return;

    select.innerHTML = '<option value="">-- Sélectionnez une personne --</option>' +
        personnes.map(p => `
            <option value="${escapeHtml(p.identifiant)}">
                ${escapeHtml(p.prenom)} ${escapeHtml(p.nom)} — ID ${escapeHtml(p.identifiant)}
            </option>
        `).join('');

    if (personnes.length === 0) {
        document.getElementById('gesteDetails').innerHTML =
            '<div class="geste-card"><h3>Aucune personne enregistrée</h3><p>Ajoutez d\'abord des personnes dans l\'onglet Information.</p></div>';
    }
}

function showGesteForPerson() {
    const personId = document.getElementById('selectPersonGeste').value;
    const gesteDiv = document.getElementById('gesteDetails');

    if (!personId) {
        gesteDiv.innerHTML = '<div class="geste-card"><h3>Informations</h3><p>Sélectionnez une personne pour voir l\'aide à apporter et les gestes de premiers secours.</p></div>';
        return;
    }

    const person = personnes.find(p => p.identifiant === personId);
    if (!person) {
        gesteDiv.innerHTML = '<div class="geste-card"><p>Personne introuvable.</p></div>';
        return;
    }

    const nums = getNumerosUrgence(person);
    const numsHtml = nums.length
        ? nums.map((n, i) => `${i + 1}. ${escapeHtml(n)}`).join('<br>')
        : 'Non renseigné';

    gesteDiv.innerHTML = `
        <div class="geste-card">
            <h3>${escapeHtml(person.prenom)} ${escapeHtml(person.nom)}</h3>
            <p><strong>Identifiant :</strong> ${escapeHtml(person.identifiant)}</p>
            <p><strong>Numéros d'urgence :</strong><br>${numsHtml}</p>
            <p><strong>Domiciliation :</strong> ${escapeHtml(person.domiciliation || 'Non renseignée')}</p>
            <p><strong>Date d'inscription :</strong> ${escapeHtml(person.dateInscription || 'Non renseignée')}</p>
            <hr style="margin: 1rem 0; border: none; border-top: 1px solid #ddd;">
            <div class="form-group" style="margin-bottom:1rem;">
                <label for="editMaladieGeste">Description de la maladie / pathologie</label>
                <textarea id="editMaladieGeste" rows="4" placeholder="Décrivez la maladie, le handicap ou les points importants à connaître...">${escapeHtml(person.maladie || '')}</textarea>
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
                <label for="editAideApporter">Aide à apporter</label>
                <textarea id="editAideApporter" rows="5" placeholder="Ex: parler calmement, aider à s'asseoir...">${escapeHtml(person.aideApporter || '')}</textarea>
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
                <label for="editGestes">Gestes de premiers secours</label>
                <textarea id="editGestes" rows="4" placeholder="Décrivez les gestes à faire en cas d'urgence...">${escapeHtml(person.gestesSecours || '')}</textarea>
            </div>
            <button type="button" id="saveGestesBtn">Enregistrer les informations</button>
            <aside class="urgence-box" style="margin-top:1rem;">
                <strong>Conseils généraux :</strong><br>
                En cas d'urgence, appelez le 15 ou le 18.<br>
                Restez calme et rassurez la personne.<br>
                Donnez des informations claires aux secours.
            </aside>
        </div>
    `;

    document.getElementById('saveGestesBtn').onclick = () => {
        person.aideApporter = document.getElementById('editAideApporter').value.trim();
        person.maladie = document.getElementById('editMaladieGeste').value.trim();
        person.gestesSecours = document.getElementById('editGestes').value.trim();
        saveData();
        showToast('Informations mises à jour');
        showGesteForPerson();
    };
}

function exportToCSV() {
    if (personnes.length === 0) {
        alert('Aucune donnée à exporter.');
        return;
    }

    let csvContent = 'Identifiant,Nom,Prénom,Domiciliation,NumerosUrgence,DateInscription,Maladie,AideAApporter,GestesSecours\n';
    personnes.forEach(p => {
        const nums = getNumerosUrgence(p).join(' | ');
        csvContent += `"${p.identifiant}","${p.nom}","${p.prenom}","${p.domiciliation || ''}","${nums}","${p.dateInscription || ''}","${(p.maladie || '').replace(/"/g, '""')}","${(p.aideApporter || '').replace(/"/g, '""')}","${(p.gestesSecours || '').replace(/"/g, '""')}"\n`;
    });

    downloadBlob(csvContent, 'badges_mickael_personnes.csv', 'text/csv;charset=utf-8;');
    showToast('Export CSV effectué');
}

function exportToJSON() {
    if (personnes.length === 0) {
        alert('Aucune donnée à exporter.');
        return;
    }
    downloadBlob(JSON.stringify(personnes.map(normalizePerson), null, 2), 'badges_mickael_personnes.json', 'application/json');
    showToast('Export JSON effectué');
}

function importFromJSON(file) {
    const reader = new FileReader();
    reader.onload = function (ev) {
        try {
            const data = JSON.parse(ev.target.result);
            if (!Array.isArray(data)) {
                alert('Le fichier JSON doit contenir une liste de personnes.');
                return;
            }
            if (!confirm('Remplacer la base actuelle par le contenu du fichier ?')) return;
            personnes = data.map(normalizePerson);
            saveData();
            renderTable();
            updateSelectPerson();
            showToast('Import JSON réussi');
        } catch (e) {
            alert('Fichier JSON invalide.');
        }
    };
    reader.readAsText(file);
}

function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type: type });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function setupLogoUpload() {
    const logoDiv = document.getElementById('logoUploader');
    const fileInput = document.getElementById('logoFileInput');

    const openPicker = () => fileInput.click();
    logoDiv.addEventListener('click', openPicker);
    logoDiv.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPicker();
        }
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (ev) {
            if (file.type.startsWith('image/')) {
                logoDiv.innerHTML = '';
                const img = document.createElement('img');
                img.src = ev.target.result;
                img.alt = 'Logo Les Badges de Mickael';
                img.width = 72;
                img.height = 72;
                logoDiv.appendChild(img);
                logoDiv.appendChild(fileInput);
            } else {
                showToast('Fichier PDF reconnu');
            }
        };
        reader.readAsDataURL(file);
    });
}

function setupLogin() {
    const forgotBox = document.getElementById('forgotBox');

    document.getElementById('loginForm').addEventListener('submit', function (event) {
        event.preventDefault();
        const password = document.getElementById('adminPassword').value;

        if (password === DEFAULT_PASSWORD) {
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('mainApp').classList.remove('hidden');
            showToast('Connexion réussie');
        } else {
            alert('Mot de passe incorrect.');
        }
    });

    document.getElementById('forgotPasswordBtn').addEventListener('click', function () {
        const isHidden = forgotBox.hasAttribute('hidden');
        if (isHidden) forgotBox.removeAttribute('hidden');
        else forgotBox.setAttribute('hidden', '');
        forgotBox.style.display = isHidden ? 'block' : 'none';
    });

    document.getElementById('recoverPasswordBtn').addEventListener('click', function () {
        const answer = document.getElementById('secretAnswer').value.trim().toLowerCase();
        const result = document.getElementById('recoverResult');
        result.textContent = answer === SECRET_ANSWER
            ? 'Votre mot de passe est : ' + DEFAULT_PASSWORD
            : 'Réponse incorrecte.';
    });

    document.getElementById('logoutBtn').addEventListener('click', function () {
        document.getElementById('mainApp').classList.add('hidden');
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('adminPassword').value = '';
        showToast('Déconnexion effectuée');
    });
}

function setupEvents() {
    document.getElementById('personForm').addEventListener('submit', addOrUpdatePerson);
    document.getElementById('resetFormBtn').addEventListener('click', resetForm);
    document.getElementById('exportBtn').addEventListener('click', exportToCSV);
    document.getElementById('exportJsonBtn').addEventListener('click', exportToJSON);
    document.getElementById('importJsonBtn').addEventListener('click', () => {
        document.getElementById('importJsonInput').click();
    });
    document.getElementById('importJsonInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            importFromJSON(file);
            e.target.value = '';
        }
    });
    document.getElementById('addNumeroBtn').addEventListener('click', () => {
        const current = Array.from(document.querySelectorAll('.numero-input')).map(i => i.value);
        if (current.length >= MAX_NUMEROS) return;
        current.push('');
        renderNumerosFields(current);
        const inputs = document.querySelectorAll('.numero-input');
        inputs[inputs.length - 1].focus();
    });
    document.getElementById('selectPersonGeste').addEventListener('change', showGesteForPerson);
    setupSecoursModal();
}

function setupSecoursModal() {
    const modal = document.getElementById('secoursModal');
    const openBtn = document.getElementById('secoursBtn');
    const closeBtn = document.getElementById('secoursModalClose');

    function openModal() {
        renderSecoursContacts();
        modal.classList.remove('hidden');
        modal.removeAttribute('hidden');
        closeBtn.focus();
    }

    function closeModal() {
        modal.classList.add('hidden');
        modal.setAttribute('hidden', '');
        openBtn.focus();
    }

    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    modal.querySelectorAll('[data-close-modal]').forEach(el => {
        el.addEventListener('click', closeModal);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeModal();
        }
    });
}

function renderSecoursContacts() {
    const container = document.getElementById('secoursContactsList');

    if (!personnes.length) {
        container.innerHTML = '<p class="secours-empty">Aucune personne enregistrée. Ajoutez des fiches dans l\'onglet Information.</p>';
        return;
    }

    container.innerHTML = personnes.map(p => {
        const nums = getNumerosUrgence(p);
        const links = nums.length
            ? `<ul class="secours-call-list">${nums.map((n, i) => `
                <li>
                    <a class="secours-call-btn" href="tel:${escapeHtml(n)}">
                        <span>Appeler ${escapeHtml(n)}</span>
                        <small>${i === 0 ? 'Principal' : 'Contact ' + (i + 1)}</small>
                    </a>
                </li>`).join('')}</ul>`
            : '<p class="secours-empty">Aucun numéro renseigné pour cette personne.</p>';

        return `
            <article class="secours-person">
                <h3>${escapeHtml(p.prenom)} ${escapeHtml(p.nom)} <small style="color:var(--gris);font-weight:500;">(ID ${escapeHtml(p.identifiant)})</small></h3>
                ${p.maladie ? `<p style="margin:0 0 0.5rem;font-size:0.9rem;color:var(--gris);">${escapeHtml(p.maladie)}</p>` : ''}
                ${links}
            </article>
        `;
    }).join('');
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.setAttribute('role', 'status');
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function initTabs() {
    const tabs = document.querySelectorAll('.tab-btn[data-tab]');
    tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            document.querySelectorAll('.tab-panel').forEach(tab => tab.classList.remove('is-active'));
            document.getElementById(tabId + 'Tab').classList.add('is-active');
            tabs.forEach(b => b.classList.remove('is-active'));
            btn.classList.add('is-active');
            if (tabId === 'geste') updateSelectPerson();
        });
    });
}

initApp();
