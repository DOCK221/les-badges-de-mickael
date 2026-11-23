const Store = window.LBDMStore;
let currentPerson = null;

function getNumerosUrgence(personne) {
    if (Array.isArray(personne.numerosUrgence) && personne.numerosUrgence.length > 0) {
        return personne.numerosUrgence.filter(Boolean);
    }
    if (personne.numero) return [personne.numero];
    return [];
}

function echapper(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.setAttribute('role', 'status');
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function afficherInfos(personne) {
    currentPerson = personne;
    const numeros = getNumerosUrgence(personne);

    const numerosHtml = numeros.length
        ? `<ul class="urgence-list">${numeros.map((n, i) =>
            `<li><a href="tel:${echapper(n)}">${i + 1}. ${echapper(n)}</a></li>`
          ).join('')}</ul>`
        : '<p>Aucun numéro renseigné</p>';

    document.getElementById('userInfo').innerHTML = `
        <p><strong>Identifiant :</strong> ${echapper(personne.identifiant)}</p>
        <p><strong>Nom complet :</strong> ${echapper(personne.prenom)} ${echapper(personne.nom)}</p>
        <p><strong>Domiciliation :</strong> ${echapper(personne.domiciliation || 'Non renseignée')}</p>
        <p><strong>Numéros de téléphone / urgence :</strong></p>
        ${numerosHtml}
        <p><strong>Maladie / pathologie :</strong> ${echapper(personne.maladie || 'Non renseignée')}</p>
        <p><strong>Inscrit le :</strong> ${echapper(personne.dateInscription || 'Non renseignée')}</p>
    `;

    document.getElementById('gestesSecours').innerHTML = `
        <div class="geste-card">
            <h2>Description de la maladie</h2>
            <p>${echapper(personne.maladie || 'Aucune description de maladie renseignée.')}</p>
        </div>
        <div class="geste-card">
            <h2>Aide à apporter</h2>
            <p>${echapper(personne.aideApporter || "Aucune information spécifique. En cas d'urgence, appelez les secours.")}</p>
        </div>
        <div class="geste-card">
            <h2>Gestes de premiers secours</h2>
            <p>${echapper(personne.gestesSecours || "Restez calme, sécurisez l'environnement, contactez les secours.")}</p>
        </div>
        <aside class="urgence-box" aria-label="Numéros d'urgence nationaux">
            <strong>Numéros d'urgence nationaux :</strong><br>
            Pompiers : 18 ou 112 · SAMU : 15 · Police : 17
        </aside>
    `;
}

function initTabs() {
    document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            document.querySelectorAll('.tab-panel').forEach(tab => tab.classList.remove('is-active'));
            document.getElementById(tabId + 'Tab').classList.add('is-active');
            document.querySelectorAll('.tab-btn[data-tab]').forEach(b => b.classList.remove('is-active'));
            btn.classList.add('is-active');
        });
    });
}

function prefillFromQrCode() {
    const id = new URLSearchParams(window.location.search).get('id');
    if (id && /^\d{5}$/.test(id)) {
        document.getElementById('userId').value = id;
        document.getElementById('userName').focus();
    }
}

document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const id = document.getElementById('userId').value.trim();
    const nom = document.getElementById('userName').value.trim();
    const errorP = document.getElementById('loginError');
    const submitBtn = this.querySelector('button[type="submit"]');

    if (!/^\d{5}$/.test(id)) {
        errorP.textContent = "L'identifiant doit comporter exactement 5 chiffres.";
        errorP.style.display = 'block';
        return;
    }

    let personne;
    submitBtn.disabled = true;
    try {
        personne = await Store.findForUser(id, nom);
    } catch (err) {
        errorP.textContent = 'Connexion impossible. Utilisez 12345 / Cisse en mode test, puis rafraîchissez avec Ctrl+F5.';
        errorP.style.display = 'block';
        return;
    } finally {
        submitBtn.disabled = false;
    }

    if (!personne) {
        errorP.textContent = 'Aucun utilisateur trouvé avec cet identifiant et ce nom.';
        errorP.style.display = 'block';
        return;
    }

    errorP.style.display = 'none';
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    afficherInfos(personne);
    showToast('Bienvenue ' + personne.prenom);
});

document.getElementById('secourTabBtn').addEventListener('click', function () {
    window.location.href = 'tel:112';
});

document.getElementById('sosProcheBtn').addEventListener('click', function () {
    const numeros = currentPerson ? getNumerosUrgence(currentPerson) : [];
    if (!numeros.length) {
        showToast('Aucun numéro de proche enregistré.');
        return;
    }
    window.location.href = 'tel:' + numeros[0];
});

document.getElementById('logoutBtn').addEventListener('click', function () {
    currentPerson = null;
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('userId').value = '';
    document.getElementById('userName').value = '';
    document.getElementById('loginError').style.display = 'none';
    document.querySelectorAll('.tab-panel').forEach(tab => tab.classList.remove('is-active'));
    document.getElementById('infosTab').classList.add('is-active');
    document.querySelectorAll('.tab-btn[data-tab]').forEach(b => b.classList.remove('is-active'));
    document.querySelector('.tab-btn[data-tab="infos"]').classList.add('is-active');
});

document.getElementById('avisForm').addEventListener('submit', function (event) {
    event.preventDefault();
    const nomAvis = document.getElementById('avisNom').value.trim();
    const message = document.getElementById('avisMessage').value.trim();

    if (!message) {
        alert('Veuillez écrire un avis.');
        return;
    }

    const sujet = 'Avis - Les Badges de Mickael de ' + (nomAvis || 'Visiteur');
    const corps = 'Nom: ' + (nomAvis || 'Anonyme') + '\n\nMessage:\n' + message +
        '\n\n---\nEnvoyé depuis l\'application Les Badges de Mickael.';

    window.location.href = 'mailto:ufcboy44@gmail.com,mickaelmartin@gmail.com?subject=' +
        encodeURIComponent(sujet) + '&body=' + encodeURIComponent(corps);

    showToast('Ouverture de votre messagerie pour envoyer l\'avis.');
    document.getElementById('avisForm').reset();
});

initTabs();
prefillFromQrCode();
