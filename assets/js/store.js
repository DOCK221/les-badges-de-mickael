// Accès aux fiches : mode DEMO, sinon Supabase, sinon localStorage.
(function () {
    const cfg = window.LBDM_CONFIG || {};
    const LOCAL_KEY = 'badges_mickael_personnes_v2';
    const LOCAL_SESSION_KEY = 'badges_mickael_admin';
    const LOCAL_PASSWORD = 'admin123';

    // DEMO_MODE = true => ignore Supabase et la table adherents
    const demoMode = cfg.DEMO_MODE === true;
    const remote = !demoMode && Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
    const client = remote ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

    function demoData() {
        return (window.LBDM_DEMO_PERSONNES || []).map(function (p) { return Object.assign({}, p); });
    }

    function toRow(p) {
        return {
            identifiant: p.identifiant,
            nom: p.nom,
            prenom: p.prenom,
            domiciliation: p.domiciliation || null,
            numeros_urgence: p.numerosUrgence || [],
            date_inscription: p.dateInscription || null,
            maladie: p.maladie || null,
            aide_apporter: p.aideApporter || null,
            gestes_secours: p.gestesSecours || null
        };
    }

    function fromRow(r) {
        let numeros = [];
        if (Array.isArray(r.numeros_urgence)) numeros = r.numeros_urgence.filter(Boolean);
        else if (r.numero) numeros = [r.numero];
        return {
            identifiant: String(r.identifiant || ''),
            nom: r.nom || '',
            prenom: r.prenom || '',
            domiciliation: r.domiciliation || '',
            numerosUrgence: numeros,
            dateInscription: r.date_inscription || '',
            maladie: r.maladie || '',
            aideApporter: r.aide_apporter || '',
            gestesSecours: r.gestes_secours || ''
        };
    }

    function readLocal() {
        try {
            const stored = localStorage.getItem(LOCAL_KEY);
            return stored ? JSON.parse(stored) : null;
        } catch (e) {
            return null;
        }
    }

    function writeLocal(list) {
        try {
            localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
        } catch (e) {
            // Navigateur restreint / mode prive : on continue en memoire
        }
    }

    function ensureLocalSeed() {
        try {
            let list = readLocal();
            if (!list || !list.length) {
                list = demoData();
                writeLocal(list);
            }
            return (list && list.length) ? list : demoData();
        } catch (e) {
            return demoData();
        }
    }

    function check(res) {
        if (res.error) {
            const msg = /row-level security/i.test(res.error.message)
                ? "Ce compte n'a pas les droits administrateur."
                : res.error.message;
            throw new Error(msg);
        }
        return res.data;
    }

    function pageUrl() {
        return window.location.href.replace(/[#?].*$/, '');
    }

    window.LBDMStore = {
        isRemote: remote,
        isDemo: demoMode,

        async hasSession() {
            if (!remote) return sessionStorage.getItem(LOCAL_SESSION_KEY) === '1';
            const { data } = await client.auth.getSession();
            return Boolean(data.session);
        },

        async login(email, password) {
            if (!remote) {
                if (password !== LOCAL_PASSWORD) throw new Error('Mot de passe incorrect.');
                sessionStorage.setItem(LOCAL_SESSION_KEY, '1');
                return;
            }
            const { error } = await client.auth.signInWithPassword({ email, password });
            if (error) throw new Error('E-mail ou mot de passe incorrect.');
        },

        async logout() {
            if (!remote) {
                sessionStorage.removeItem(LOCAL_SESSION_KEY);
                return;
            }
            await client.auth.signOut();
        },

        async sendPasswordReset(email) {
            check(await client.auth.resetPasswordForEmail(email, { redirectTo: pageUrl() }));
        },

        onPasswordRecovery(callback) {
            if (!remote) return;
            client.auth.onAuthStateChange((event) => {
                if (event === 'PASSWORD_RECOVERY') callback();
            });
        },

        async updatePassword(password) {
            check(await client.auth.updateUser({ password }));
        },

        async list() {
            if (!remote) return ensureLocalSeed();
            const data = check(await client.from('adherents').select('*').order('identifiant'));
            return data.map(fromRow);
        },

        async save(person, originalId) {
            if (!remote) {
                const list = ensureLocalSeed();
                const index = list.findIndex(p => p.identifiant === (originalId || person.identifiant));
                if (index === -1) list.push(person);
                else list[index] = person;
                writeLocal(list);
                return;
            }
            if (originalId && originalId !== person.identifiant) {
                check(await client.from('adherents').update(toRow(person)).eq('identifiant', originalId));
            } else {
                check(await client.from('adherents').upsert(toRow(person)));
            }
        },

        async remove(identifiant) {
            if (!remote) {
                writeLocal(ensureLocalSeed().filter(p => p.identifiant !== identifiant));
                return;
            }
            check(await client.from('adherents').delete().eq('identifiant', identifiant));
        },

        async replaceAll(list) {
            if (!remote) {
                writeLocal(list);
                return;
            }
            check(await client.from('adherents').delete().neq('identifiant', ''));
            if (list.length) check(await client.from('adherents').insert(list.map(toRow)));
        },

        async findForUser(identifiant, nom) {
            if (!remote || demoMode) {
                const target = nom.trim().toLowerCase();
                const list = ensureLocalSeed();
                return list.find(p =>
                    String(p.identifiant) === String(identifiant) &&
                    String(p.nom).trim().toLowerCase() === target
                ) || null;
            }
            const data = check(await client.rpc('get_fiche', { p_identifiant: identifiant, p_nom: nom }));
            return data && data.length ? fromRow(data[0]) : null;
        }
    };
})();
