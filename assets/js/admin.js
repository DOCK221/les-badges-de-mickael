const MAX_NUMEROS = 7;
const SECRET_ANSWER = 'les badges de mickael';
const LOCAL_PASSWORD_HINT = 'admin123';
const Store = window.LBDMStore;

const DEMO_PERSONNES = [
    {
        identifiant: '12345',
        nom: 'Martin',
        prenom: 'Sophie',
        domiciliation: 'Nantes',
        numerosUrgence: ['0612345678', '0698765432'],
        dateInscription: '2026-04-22',
        maladie: 'Épilepsie — crises possibles, ne rien mettre dans la bouche.',
        aideApporter: "Rassurer la personne, l'allonger sur le côté si nécessaire, appeler le 15 en cas de crise.",
        gestesSecours: "Surveiller la respiration, sécuriser l'environnement, ne rien mettre dans la bouche."
    },
    {
        identifiant: '67890',
        nom: 'Bernard',
        prenom: 'Lucas',
        domiciliation: 'Rezé',
        numerosUrgence: ['0789456123'],
        dateInscription: '2026-04-22',
        maladie: "Diabète — risque d'hypoglycémie.",
        aideApporter: 'Donner du sucre si la personne est consciente, rester avec elle.',
        gestesSecours: 'Contacter les secours si malaise important, surveiller son état.'
    }
];

let personnes = [];
let editingId = null;

function initApp() {
    setTodayDate();
    initTabs();
    setupLogoUpload();
    setupLogin();
    setupEvents();
    setupBadgeModal();
    renderNumerosFields(['']);
    restoreSession();
}

async function restoreSession() {
    if (await Store.hasSession()) await showApp();
}

async function showApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    await loadData();
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
        identifiant: String(p.identifiant || ''),
        nom: p.nom || '',
        prenom: p.prenom || '',
        domiciliation: p.domiciliation || '',
        numerosUrgence: numeros,
        dateInscription: p.dateInscription || '',
        maladie: p.maladie || '',
        aideApporter: p.aideApporter || '',
        gestesSecours: p.gestesSecours || ''
    };
}

async function loadData() {
    try {
        let list = await Store.list();
        if (list === null) {
            list = DEMO_PERSONNES;
            await Store.replaceAll(list);
        }
        personnes = list.map(normalizePerson);
    } catch (e) {
        personnes = [];
        alert('Impossible de charger les fiches : ' + e.message);
    }
    renderTable();
    updateSelectPerson();
}

async function runSafely(action, successMessage) {
    try {
        await action();
        if (successMessage) showToast(successMessage);
        return true;
    } catch (e) {
        alert('Erreur : ' + e.message);
        return false;
    }
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

async function addOrUpdatePerson(event) {
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

    const existing = editingId ? personnes.find(p => p.identifiant === editingId) : null;
    const person = normalizePerson({
        ...(existing || {}),
        identifiant,
        nom,
        prenom,
        domiciliation,
        numerosUrgence,
        dateInscription,
        maladie
    });

    const ok = await runSafely(() => Store.save(person, editingId), 'Personne enregistrée avec succès');
    if (!ok) return;

    await loadData();
    resetForm();
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

async function deletePerson(identifiant) {
    if (!confirm('Supprimer cette personne ?')) return;
    const ok = await runSafely(() => Store.remove(identifiant), 'Personne supprimée');
    if (!ok) return;
    await loadData();
    if (editingId === identifiant) resetForm();
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
            <td class="actions-cell">
                <button type="button" class="action-btn" data-badge="${escapeHtml(p.identifiant)}" style="background:var(--violet);">Badge</button>
                <button type="button" class="action-btn" data-edit="${escapeHtml(p.identifiant)}" style="background:var(--jaune);color:#2c3e50;">Modifier</button>
                <button type="button" class="action-btn btn-danger" data-delete="${escapeHtml(p.identifiant)}">Supprimer</button>
            </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-badge]').forEach(btn => {
        btn.addEventListener('click', () => openBadge(btn.getAttribute('data-badge')));
    });
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

    document.getElementById('saveGestesBtn').onclick = async () => {
        const updated = normalizePerson({
            ...person,
            aideApporter: document.getElementById('editAideApporter').value.trim(),
            maladie: document.getElementById('editMaladieGeste').value.trim(),
            gestesSecours: document.getElementById('editGestes').value.trim()
        });
        const ok = await runSafely(() => Store.save(updated, person.identifiant), 'Informations mises à jour');
        if (!ok) return;
        await loadData();
        document.getElementById('selectPersonGeste').value = personId;
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
    downloadBlob(JSON.stringify(personnes, null, 2), 'badges_mickael_personnes.json', 'application/json');
    showToast('Export JSON effectué');
}

function importFromJSON(file) {
    const reader = new FileReader();
    reader.onload = async function (ev) {
        let data;
        try {
            data = JSON.parse(ev.target.result);
        } catch (e) {
            alert('Fichier JSON invalide.');
            return;
        }
        if (!Array.isArray(data)) {
            alert('Le fichier JSON doit contenir une liste de personnes.');
            return;
        }
        if (!confirm('Remplacer la base actuelle par le contenu du fichier ?')) return;
        const ok = await runSafely(() => Store.replaceAll(data.map(normalizePerson)), 'Import JSON réussi');
        if (ok) await loadData();
    };
    reader.readAsText(file);
}

function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    downloadUrl(url, filename);
    URL.revokeObjectURL(url);
}

function downloadUrl(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    const recoverResult = document.getElementById('recoverResult');

    if (Store.isRemote) {
        document.getElementById('adminEmailGroup').classList.remove('hidden');
        document.getElementById('adminEmail').required = true;
        document.getElementById('forgotLocal').classList.add('hidden');
        document.getElementById('forgotRemote').classList.remove('hidden');
        document.getElementById('storageBadge').textContent =
            'Base en ligne sécurisée — les fiches sont accessibles depuis tous les appareils';
    }

    document.getElementById('loginForm').addEventListener('submit', async function (event) {
        event.preventDefault();
        const email = document.getElementById('adminEmail').value.trim();
        const password = document.getElementById('adminPassword').value;

        try {
            await Store.login(email, password);
        } catch (e) {
            alert(e.message);
            return;
        }
        showToast('Connexion réussie');
        await showApp();
    });

    document.getElementById('forgotPasswordBtn').addEventListener('click', function () {
        const isHidden = forgotBox.hasAttribute('hidden');
        if (isHidden) forgotBox.removeAttribute('hidden');
        else forgotBox.setAttribute('hidden', '');
        forgotBox.style.display = isHidden ? 'block' : 'none';
    });

    document.getElementById('recoverPasswordBtn').addEventListener('click', function () {
        const answer = document.getElementById('secretAnswer').value.trim().toLowerCase();
        recoverResult.textContent = answer === SECRET_ANSWER
            ? 'Votre mot de passe est : ' + LOCAL_PASSWORD_HINT
            : 'Réponse incorrecte.';
    });

    document.getElementById('sendResetBtn').addEventListener('click', async function () {
        const email = document.getElementById('adminEmail').value.trim();
        if (!email) {
            recoverResult.textContent = 'Saisissez votre e-mail.';
            return;
        }
        try {
            await Store.sendPasswordReset(email);
            recoverResult.textContent = 'Lien envoyé ! Consultez votre boîte mail.';
        } catch (e) {
            recoverResult.textContent = 'Erreur : ' + e.message;
        }
    });

    const newPasswordForm = document.getElementById('newPasswordForm');
    Store.onPasswordRecovery(() => {
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
        document.getElementById('loginForm').classList.add('hidden');
        newPasswordForm.classList.remove('hidden');
    });

    newPasswordForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        const ok = await runSafely(
            () => Store.updatePassword(document.getElementById('newPassword').value),
            'Mot de passe modifié'
        );
        if (!ok) return;
        newPasswordForm.classList.add('hidden');
        document.getElementById('loginForm').classList.remove('hidden');
        history.replaceState(null, '', window.location.pathname);
        await showApp();
    });

    document.getElementById('logoutBtn').addEventListener('click', async function () {
        await Store.logout();
        document.getElementById('mainApp').classList.add('hidden');
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('adminPassword').value = '';
        personnes = [];
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

/* —— Badges & QR codes —— */

const BADGE_VIOLET = '#9b59b6';
const BADGE_ORANGE = '#f39c12';
const badgeLogo = new Image();
badgeLogo.src = 'mickealimage1.png';
let badgePerson = null;

function getUserPageUrl(identifiant) {
    const cfg = window.LBDM_CONFIG || {};
    let base = (cfg.SITE_URL || '').trim();
    if (!base) base = window.location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
    if (!base.endsWith('/')) base += '/';
    return base + 'lbdm-user.html?id=' + encodeURIComponent(identifiant);
}

function makeQr(text) {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr;
}

function drawQr(ctx, qr, x, y, size) {
    const count = qr.getModuleCount();
    const cell = size / count;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#000000';
    for (let row = 0; row < count; row++) {
        for (let col = 0; col < count; col++) {
            if (qr.isDark(row, col)) {
                ctx.fillRect(x + col * cell, y + row * cell, Math.ceil(cell), Math.ceil(cell));
            }
        }
    }
}

function fitText(ctx, text, maxWidth, weight, startSize) {
    let size = startSize;
    do {
        ctx.font = `${weight} ${size}px "Segoe UI", Tahoma, sans-serif`;
        size -= 2;
    } while (ctx.measureText(text).width > maxWidth && size > 14);
}

function drawBadge(canvas, person, options) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const qr = makeQr(getUserPageUrl(person.identifiant));

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    const header = ctx.createLinearGradient(0, 0, w, 0);
    header.addColorStop(0, BADGE_VIOLET);
    header.addColorStop(1, BADGE_ORANGE);
    ctx.fillStyle = header;
    ctx.fillRect(0, 0, w, 230);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    if (options.withLogo && badgeLogo.complete && badgeLogo.naturalWidth) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(w / 2, 85, 62, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.clip();
        ctx.drawImage(badgeLogo, w / 2 - 56, 29, 112, 112);
        ctx.restore();
    }

    ctx.fillStyle = '#ffffff';
    fitText(ctx, 'Les Badges de Mickael', w - 60, 'bold', 46);
    ctx.fillText('Les Badges de Mickael', w / 2, 200);

    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 40px "Segoe UI", Tahoma, sans-serif';
    ctx.fillText("EN CAS D'URGENCE", w / 2, 295);
    ctx.fillStyle = '#2c3e50';
    ctx.font = '28px "Segoe UI", Tahoma, sans-serif';
    ctx.fillText('Scannez ce QR code', w / 2, 340);

    drawQr(ctx, qr, (w - 440) / 2, 370, 440);

    ctx.fillStyle = BADGE_VIOLET;
    ctx.font = 'bold 56px "Segoe UI", Tahoma, sans-serif';
    ctx.fillText('ID ' + person.identifiant, w / 2, 885);

    if (options.showName) {
        const fullName = `${person.prenom} ${person.nom.toUpperCase()}`;
        ctx.fillStyle = '#2c3e50';
        fitText(ctx, fullName, w - 60, 'bold', 36);
        ctx.fillText(fullName, w / 2, 935);
    }

    ctx.fillStyle = '#7f8c8d';
    ctx.font = '26px "Segoe UI", Tahoma, sans-serif';
    ctx.fillText('SAMU 15 · Pompiers 18 · Urgences 112', w / 2, 985);

    ctx.strokeStyle = BADGE_VIOLET;
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, w - 10, h - 10);
}

function badgeOptions(withLogo) {
    return { withLogo, showName: document.getElementById('badgeShowName').checked };
}

// Le logo chargé depuis file:// "salit" le canvas : on retente sans logo pour pouvoir exporter.
function exportBadgeDataUrl() {
    const canvas = document.getElementById('badgeCanvas');
    try {
        return canvas.toDataURL('image/png');
    } catch (e) {
        drawBadge(canvas, badgePerson, badgeOptions(false));
        return canvas.toDataURL('image/png');
    }
}

function openBadge(identifiant) {
    if (typeof qrcode === 'undefined') {
        alert('Le générateur de QR code n\'a pas pu être chargé. Vérifiez votre connexion internet.');
        return;
    }
    badgePerson = personnes.find(p => p.identifiant === identifiant);
    if (!badgePerson) return;

    const url = getUserPageUrl(identifiant);
    document.getElementById('badgeUrl').textContent = url;
    const warning = document.getElementById('badgeWarning');
    if (!/^https?:/.test(url)) {
        warning.textContent = "Le site n'est pas encore en ligne : ce QR code ne fonctionnera que sur ce PC. Renseignez SITE_URL dans assets/js/config.js après la mise en ligne.";
        warning.style.display = 'block';
    } else {
        warning.style.display = 'none';
    }

    drawBadge(document.getElementById('badgeCanvas'), badgePerson, badgeOptions(true));

    const modal = document.getElementById('badgeModal');
    modal.classList.remove('hidden');
    modal.removeAttribute('hidden');
    document.getElementById('badgeModalClose').focus();
}

function setupBadgeModal() {
    const modal = document.getElementById('badgeModal');

    function closeModal() {
        modal.classList.add('hidden');
        modal.setAttribute('hidden', '');
    }

    document.getElementById('badgeModalClose').addEventListener('click', closeModal);
    modal.querySelectorAll('[data-close-badge]').forEach(el => el.addEventListener('click', closeModal));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
    });

    document.getElementById('badgeShowName').addEventListener('change', () => {
        if (badgePerson) drawBadge(document.getElementById('badgeCanvas'), badgePerson, badgeOptions(true));
    });

    document.getElementById('badgeDownloadBtn').addEventListener('click', () => {
        downloadUrl(exportBadgeDataUrl(), `badge_${badgePerson.identifiant}.png`);
    });

    document.getElementById('qrDownloadBtn').addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 600, 600);
        drawQr(ctx, makeQr(getUserPageUrl(badgePerson.identifiant)), 40, 40, 520);
        downloadUrl(canvas.toDataURL('image/png'), `qrcode_${badgePerson.identifiant}.png`);
    });

    document.getElementById('badgePrintBtn').addEventListener('click', () => {
        const dataUrl = exportBadgeDataUrl();
        const win = window.open('', '_blank');
        if (!win) {
            alert('Autorisez les fenêtres pop-up pour imprimer.');
            return;
        }
        win.document.write(`<!DOCTYPE html><html><head><title>Badge ${escapeHtml(badgePerson.identifiant)}</title>
            <style>@page{margin:10mm}body{margin:0}img{width:54mm;height:85.6mm}</style></head>
            <body><img src="${dataUrl}" onload="window.print()"></body></html>`);
        win.document.close();
    });
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
