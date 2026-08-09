/* ==========================================================
   GLOBAL.JS
   Comportement partagé par les 10 pages : menu mobile,
   ombre navbar au scroll, bouton retour en haut, toast.
   ========================================================== */

/* ==========================
    SUIVI DES VISITES
    Un seul appel par chargement de page, sans bloquer le rendu
    ni empêcher la page de fonctionner si ça échoue.
========================== */

if(typeof apiFetch !== "undefined"){

    apiFetch("/visites", {

        method: "POST",

        body: JSON.stringify({ page: window.location.pathname })

    }).catch(() => {});

}

/* ==========================
        OMBRE NAVBAR AU SCROLL
========================== */

const siteHeader = document.querySelector("header");

// Empêche la navbar fixe de cacher le haut de la page : mesure la
// vraie hauteur de la navbar (au lieu d'un chiffre codé en dur, qui
// se désynchronise dès que la navbar change de hauteur — mobile,
// contenu, police...) et l'expose en variable CSS + en décalage
// d'ancre. Fonction de haut niveau (pas limitée au bloc if ci-
// dessous) pour pouvoir la rappeler plus tard, quand la navbar est
// modifiée après coup par le bloc "état de connexion" (bouton
// "Mon compte", cloche de notifications) — sans ça, la navbar
// passait sur 2 lignes une fois connecté sans que le décalage soit
// recalculé, et cachait le haut du contenu (dont la barre latérale
// des tableaux de bord sur mobile).
function setScrollOffset(){

    if(!siteHeader) return;

    const height =
    siteHeader.getBoundingClientRect().height;

    document.documentElement.style.setProperty(
        "--header-height",
        height + "px"
    );

    document.documentElement.style.scrollPaddingTop =
    (height + 15) + "px";

}

if(siteHeader){

    window.addEventListener("scroll", () => {

        siteHeader.classList.toggle("scrolled", window.scrollY > 20);

    });

    setScrollOffset();

    // Recalcule une fois toutes les ressources chargées (polices,
    // icônes Phosphor) : leur chargement asynchrone peut changer
    // la hauteur réelle de la navbar après la première mesure.
    window.addEventListener("load", setScrollOffset);

    window.addEventListener("resize", setScrollOffset);

}

/* ==========================
        MENU MOBILE
========================== */

const menuToggle =
document.querySelector(".menu-toggle");

const navLinks =
document.querySelector(".nav-links");

if(menuToggle && navLinks){

    menuToggle.addEventListener("click",()=>{

        navLinks.classList.toggle("active");

    const icon =
    menuToggle.querySelector("i");

    if(navLinks.classList.contains("active")){

        icon.classList.replace(
            "ph-list",
            "ph-x"
        );

    }else{

        icon.classList.replace(
            "ph-x",
            "ph-list"
        );

    }

});
}

/* ==========================
       RETOUR EN HAUT
========================== */

const scrollTopBtn =
document.getElementById("scrollTop");

if(scrollTopBtn){

    window.addEventListener("scroll",()=>{

        if(window.scrollY > 300){

            scrollTopBtn.style.display =
            "block";

        }else{

            scrollTopBtn.style.display =
            "none";

        }

    });

    scrollTopBtn.addEventListener("click",()=>{

        window.scrollTo({

            top:0,

            behavior:"smooth"

        });

    });

}

/* ==========================
    ÉTAT DE CONNEXION (NAVBAR)
========================== */

if(typeof apiFetch !== "undefined"){

    apiFetch("/auth/me").then((utilisateur)=>{

        // Signal de présence : indique que ce compte a une page du
        // site ouverte, pour le statut "En ligne" de l'espace de
        // discussion. Répété pendant que la page reste ouverte —
        // sans ça, un utilisateur resterait "en ligne" indéfiniment
        // après avoir fermé son onglet.
        apiFetch("/auth/presence", { method: "POST" }).catch(()=>{});

        setInterval(() => {

            apiFetch("/auth/presence", { method: "POST" }).catch(()=>{});

        }, 25000);

        // "S'inscrire" n'a plus de sens une fois connecté.
        const boutonInscription =
        document.getElementById("heroSignupBtn");

        if(boutonInscription) boutonInscription.style.display = "none";

        const navBtn =
        document.querySelector(".btn-nav-link");

        if(!navBtn) return;

        // window.API_BASE ("backend/api" ou "../../backend/api"
        // selon la profondeur de la page) donne déjà le chemin
        // relatif vers la racine du site, sans avoir à le
        // recalculer autrement ici.
        const racine =
        window.API_BASE.replace("backend/api", "");

        const lienTableauDeBord =
        utilisateur.role === "admin"
        ? racine + "pages/dashboard-admin/dashboard-admin.html"
        : racine + "pages/dashboard-proprietaire/dashboard-proprietaire.html";

        navBtn.textContent = "Mon compte";
        navBtn.setAttribute("href", lienTableauDeBord);

        // "Mon profil" et "Déconnexion" ne vivent que dans la barre
        // latérale du tableau de bord (pas dans la navbar, pour ne
        // pas la surcharger) — cette barre reste joignable sur
        // mobile car elle devient une bande horizontale défilable
        // au lieu de disparaître (voir dashboard-*.css).
        initClocheNotifications(racine);
        initMessagerieIcone(racine);

        // La navbar vient de changer (bouton "Mon compte", cloche) :
        // elle peut désormais passer sur 2 lignes sur mobile, donc
        // on recalcule le décalage plutôt que de garder l'ancienne
        // mesure prise avant la connexion.
        setScrollOffset();

    }).catch(()=>{});

}

/* ==========================
    NOTIFICATIONS (CLOCHE NAVBAR)
    Affiche une cloche avec le nombre de notifications non lues
    (nouveaux logements publiés) dans les boutons de navbar,
    présente sur toutes les pages pour tout utilisateur connecté.
========================== */

/**
 * Notification native du navigateur (hors onglet TerangaHome), pour
 * les nouveaux messages/demandes de visite — comme WhatsApp Web.
 * Ne se déclenche que si la permission a été accordée et que
 * l'onglet n'est pas déjà au premier plan (pas la peine de notifier
 * quelqu'un qui regarde déjà la page).
 */
function notifierNavigateur(titre, corps, lien, racine){

    if(typeof Notification === "undefined" || Notification.permission !== "granted") return;

    if(!document.hidden) return;

    try{

        const notif =
        new Notification(titre, { body: corps, icon: racine + "images/logo.jpg" });

        notif.onclick = () => {

            window.focus();

            if(lien) window.location.href = lien;

            notif.close();

        };

    }catch(error){

        // Certains navigateurs/contextes (pages non sécurisées,
        // permissions bloquées par le système) peuvent lever une
        // erreur ici : la cloche de notifications reste le repli.

    }

}

function initClocheNotifications(racine){

    const navButtons =
    document.querySelector(".nav-buttons");

    if(!navButtons || document.getElementById("notifBellWrap")) return;

    const wrap =
    document.createElement("div");

    wrap.id = "notifBellWrap";
    wrap.className = "notif-bell-wrap";

    wrap.innerHTML = `
        <button type="button" class="notif-bell" id="notifBellBtn">
            <i class="ph ph-bell"></i>
            <span class="notif-badge" id="notifBadge" style="display:none;"></span>
        </button>
        <div class="notif-dropdown" id="notifDropdown">
            <div class="notif-dropdown-header">
                Notifications
                <button type="button" class="btn-activer-notifs" id="btnActiverNotifs" title="Activer les notifications du navigateur" style="display:none;">
                    <i class="ph ph-bell-ringing"></i> Activer
                </button>
            </div>
            <div class="notif-dropdown-list" id="notifList">
                <p class="notif-empty">Chargement...</p>
            </div>
        </div>
    `;

    navButtons.insertBefore(wrap, navButtons.firstChild);

    const btnActiverNotifs =
    document.getElementById("btnActiverNotifs");

    if(btnActiverNotifs && "Notification" in window){

        if(Notification.permission === "default"){

            btnActiverNotifs.style.display = "";

        }

        btnActiverNotifs.addEventListener("click", (e) => {

            e.stopPropagation();

            Notification.requestPermission().then(() => {

                btnActiverNotifs.style.display =
                Notification.permission === "default" ? "" : "none";

            });

        });

    }

    const bellBtn =
    document.getElementById("notifBellBtn");

    const dropdown =
    document.getElementById("notifDropdown");

    bellBtn.addEventListener("click", (e) => {

        e.stopPropagation();

        const ouverte =
        dropdown.classList.toggle("show");

        if(ouverte){

            marquerNotificationsCommeLues();

        }

    });

    document.addEventListener("click", (e) => {

        if(!wrap.contains(e.target)){

            dropdown.classList.remove("show");

        }

    });

    chargerNotifications(racine);

    setInterval(() => chargerNotifications(racine), 25000);

}

// Plus grand id de notification vu lors du dernier chargement — sert
// à ne notifier (navigateur) que les nouvelles arrivées pendant que
// la page est ouverte, jamais tout l'historique au premier chargement.
let dernierPlusGrandIdNotif = null;

async function chargerNotifications(racine){

    let notifications;

    try{

        notifications = await apiFetch("/notifications");

    }catch(error){

        return;
    }

    if(notifications.length > 0){

        const plusGrandId =
        Math.max(...notifications.map(n => n.id));

        if(dernierPlusGrandIdNotif !== null && plusGrandId > dernierPlusGrandIdNotif){

            notifications
            .filter(n => n.id > dernierPlusGrandIdNotif && !Number(n.lu))
            .forEach(n => notifierNavigateur("TerangaHome", n.message, n.lien ? racine + n.lien : null, racine));

        }

        dernierPlusGrandIdNotif = plusGrandId;

    }

    const badge =
    document.getElementById("notifBadge");

    const nbNonLues =
    notifications.filter(n => !Number(n.lu)).length;

    if(badge){

        if(nbNonLues > 0){

            badge.textContent = nbNonLues > 9 ? "9+" : nbNonLues;
            badge.style.display = "";

        }else{

            badge.style.display = "none";

        }

    }

    const list =
    document.getElementById("notifList");

    if(!list) return;

    if(notifications.length === 0){

        list.innerHTML =
        `<p class="notif-empty">Aucune notification pour le moment.</p>`;

        return;
    }

    list.innerHTML =
    notifications.map(n => {

        const date =
        new Date(n.created_at).toLocaleDateString("fr-FR", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" });

        return `
        <a href="${n.lien ? racine + n.lien : "#"}" class="notif-item${Number(n.lu) ? "" : " notif-item-non-lu"}">
            <p>${n.message}</p>
            <span>${date}</span>
        </a>
        `;

    }).join("");

}

async function marquerNotificationsCommeLues(){

    const badge =
    document.getElementById("notifBadge");

    if(badge) badge.style.display = "none";

    try{

        await apiFetch("/notifications/lu", { method:"PUT" });

    }catch(error){

        // Pas grave si ça échoue : la cloche réaffichera juste le
        // compteur au prochain chargement de page.

    }

}

/* ==========================
    MESSAGERIE (ICÔNE NAVBAR)
    Icône dédiée (distincte de la cloche de notifications) montrant
    le nombre de messages non lus dans l'espace de discussion, avec
    un aperçu des conversations. Se met à jour périodiquement pour
    que l'utilisateur soit averti sans avoir à recharger la page.
========================== */

function initMessagerieIcone(racine){

    const navButtons =
    document.querySelector(".nav-buttons");

    if(!navButtons || document.getElementById("msgBellWrap")) return;

    const wrap =
    document.createElement("div");

    wrap.id = "msgBellWrap";
    wrap.className = "notif-bell-wrap";

    wrap.innerHTML = `
        <button type="button" class="notif-bell" id="msgBellBtn" title="Messages">
            <i class="ph ph-chat-circle-dots"></i>
            <span class="notif-badge" id="msgBadge" style="display:none;"></span>
        </button>
        <div class="notif-dropdown" id="msgDropdown">
            <div class="notif-dropdown-header">Messages</div>
            <div class="notif-dropdown-list" id="msgList">
                <p class="notif-empty">Chargement...</p>
            </div>
        </div>
    `;

    navButtons.insertBefore(wrap, navButtons.firstChild);

    const btn =
    document.getElementById("msgBellBtn");

    const dropdown =
    document.getElementById("msgDropdown");

    btn.addEventListener("click", (e) => {

        e.stopPropagation();

        dropdown.classList.toggle("show");

    });

    document.addEventListener("click", (e) => {

        if(!wrap.contains(e.target)){

            dropdown.classList.remove("show");

        }

    });

    chargerConversations(racine);

    setInterval(() => chargerConversations(racine), 20000);

}

// Nombre de messages non lus par conversation vu lors du dernier
// chargement — sert à ne notifier (navigateur) que les conversations
// dont le compteur vient d'augmenter, jamais tout l'historique au
// premier chargement de la page.
const dernierNonLusParConversation = new Map();
let premierChargementConversations = true;

async function chargerConversations(racine){

    let conversations;

    try{

        conversations = await apiFetch("/messagerie");

    }catch(error){

        return;
    }

    if(!premierChargementConversations){

        conversations.forEach(c => {

            const avant =
            dernierNonLusParConversation.get(c.id) || 0;

            const maintenant =
            Number(c.non_lus || 0);

            if(maintenant > avant){

                notifierNavigateur(
                    c.nom_complet,
                    c.dernier_message || "Nouveau message reçu",
                    racine + "pages/dashboard-proprietaire/dashboard-proprietaire.html?discuter=" + c.id,
                    racine
                );

            }

        });

    }

    conversations.forEach(c => dernierNonLusParConversation.set(c.id, Number(c.non_lus || 0)));

    premierChargementConversations = false;

    const badge =
    document.getElementById("msgBadge");

    const totalNonLus =
    conversations.reduce((somme, c) => somme + Number(c.non_lus || 0), 0);

    if(badge){

        if(totalNonLus > 0){

            badge.textContent = totalNonLus > 9 ? "9+" : totalNonLus;
            badge.style.display = "";

        }else{

            badge.style.display = "none";

        }

    }

    const list =
    document.getElementById("msgList");

    if(!list) return;

    if(conversations.length === 0){

        list.innerHTML =
        `<p class="notif-empty">Aucune discussion pour le moment. Demandez une visite ou contactez une annonce de colocation pour échanger.</p>`;

        return;
    }

    list.innerHTML =
    conversations.map(c => {

        const avatar =
        c.photo_url
        ? `<img src="${c.photo_url}" alt="${c.nom_complet}">`
        : `<i class="ph ph-user"></i>`;

        const dernierMessage =
        c.dernier_message || "Aucun message pour l'instant";

        const nonLus =
        Number(c.non_lus || 0);

        return `
        <a href="${racine}pages/dashboard-proprietaire/dashboard-proprietaire.html?discuter=${c.id}" class="msg-item${nonLus > 0 ? " notif-item-non-lu" : ""}">
            <div class="msg-item-avatar">${avatar}</div>
            <div class="msg-item-content">
                <p>
                    <strong>${c.nom_complet}</strong>
                    ${nonLus > 0 ? `<span class="msg-item-badge">${nonLus}</span>` : ""}
                </p>
                <span>${dernierMessage}</span>
            </div>
        </a>
        `;

    }).join("");

}

/* ==========================
    FAVORIS (API)
    Réutilisé par l'accueil, la recherche et la page favoris
    pour tout bouton .favorite portant un data-id.
========================== */

async function toggleFavorite(button){

    const logementId = button.dataset.id;

    try{

        if(button.classList.contains("active")){

            await apiFetch("/favoris/" + logementId, { method:"DELETE" });

            button.classList.remove("active");

        }else{

            await apiFetch("/favoris/" + logementId, { method:"POST" });

            button.classList.add("active");

        }

    }catch(error){

        showToast("Connectez-vous pour ajouter des favoris.", "error");

    }

}

async function marquerFavorisActifs(container){

    let favoris;

    try{

        favoris = await apiFetch("/favoris");

    }catch(error){

        return;
    }

    const idsFavoris =
    (favoris || []).map(f => String(f.id));

    container.querySelectorAll(".favorite").forEach(btn => {

        if(idsFavoris.includes(btn.dataset.id)){

            btn.classList.add("active");

        }

    });

}

function attacherBoutonsFavoris(container){

    container.querySelectorAll(".favorite").forEach(btn => {

        btn.addEventListener("click", () => toggleFavorite(btn));

    });

    marquerFavorisActifs(container);

}

/* ==========================
    RÉSERVATIONS (API)
    Réutilisé par l'accueil, la recherche et la page détails pour
    tout bouton .btn-reserver (ou #contactOwnerBtn) portant un
    data-id. Ouvre une vraie modale (message + acceptation des
    conditions d'utilisation) plutôt qu'un prompt() du navigateur.
========================== */

function creerModaleReservation(){

    if(document.getElementById("reservationModalOverlay")) return;

    const racine =
    window.API_BASE ? window.API_BASE.replace("backend/api", "") : "";

    const overlay =
    document.createElement("div");

    overlay.id = "reservationModalOverlay";
    overlay.className = "reservation-modal-overlay";

    overlay.innerHTML = `
        <div class="reservation-modal">

            <button type="button" class="reservation-modal-close" id="reservationModalClose">
                <i class="ph ph-x"></i>
            </button>

            <h3><i class="ph ph-calendar-check"></i> Demander une visite</h3>

            <p class="reservation-modal-hint">
                Précisez quand vous aimeriez visiter ce logement, laissez un message au propriétaire (facultatif), puis confirmez votre demande.
            </p>

            <textarea id="reservationMessage" maxlength="500" placeholder="Ex : Bonjour, je suis intéressé(e) par ce logement, serait-il possible de le visiter cette semaine ?"></textarea>

            <div class="reservation-modal-fields">

                <div class="reservation-modal-field">
                    <label>Date de visite souhaitée</label>
                    <input type="date" id="reservationDate">
                </div>

                <div class="reservation-modal-field">
                    <label>Heure souhaitée</label>
                    <input type="time" id="reservationHeure">
                </div>

            </div>

            <div class="reservation-modal-field">
                <label>Durée de location envisagée</label>
                <select id="reservationDuree">
                    <option value="">Choisir une durée</option>
                    <optgroup label="Courte durée">
                        <option value="24h">24 heures</option>
                        <option value="nuit">À la nuitée</option>
                        <option value="journee">À la journée</option>
                        <option value="semaine">À la semaine</option>
                    </optgroup>
                    <optgroup label="Longue durée">
                        <option value="1_mois">1 mois</option>
                        <option value="3_mois">3 mois</option>
                        <option value="6_mois">6 mois</option>
                        <option value="1_an">1 an</option>
                    </optgroup>
                </select>
            </div>

            <label class="reservation-modal-terms">
                <input type="checkbox" id="reservationTerms">
                J'accepte les <a href="${racine}pages/conditions-utilisation/conditions-utilisation.html" target="_blank" rel="noopener">conditions d'utilisation</a>
            </label>

            <div class="reservation-modal-actions">
                <button type="button" class="btn-secondary" id="reservationModalCancel">Annuler</button>
                <button type="button" class="btn-primary" id="reservationModalSubmit">Demander la visite</button>
            </div>

        </div>
    `;

    document.body.appendChild(overlay);

    // Impossible de choisir une date de début déjà passée.
    const champDate =
    document.getElementById("reservationDate");

    if(champDate) champDate.min = new Date().toISOString().split("T")[0];

    document.getElementById("reservationModalClose").addEventListener("click", fermerModaleReservation);
    document.getElementById("reservationModalCancel").addEventListener("click", fermerModaleReservation);

    overlay.addEventListener("click", (e) => {

        if(e.target === overlay) fermerModaleReservation();

    });

}

function fermerModaleReservation(){

    const overlay =
    document.getElementById("reservationModalOverlay");

    if(overlay) overlay.classList.remove("show");

}

function reserverLogement(logementId){

    creerModaleReservation();

    const overlay =
    document.getElementById("reservationModalOverlay");

    document.getElementById("reservationMessage").value = "";
    document.getElementById("reservationTerms").checked = false;
    document.getElementById("reservationDate").value = "";
    document.getElementById("reservationHeure").value = "";
    document.getElementById("reservationDuree").value = "";

    overlay.classList.add("show");

    document.getElementById("reservationModalSubmit").onclick =
    () => envoyerReservation(logementId);

}

async function envoyerReservation(logementId){

    const message =
    document.getElementById("reservationMessage").value.trim();

    const accepte =
    document.getElementById("reservationTerms").checked;

    const dateSouhaitee =
    document.getElementById("reservationDate").value;

    const heureSouhaitee =
    document.getElementById("reservationHeure").value;

    const dureeSejour =
    document.getElementById("reservationDuree").value;

    if(!dateSouhaitee || !heureSouhaitee || !dureeSejour){

        showToast("Merci de préciser la date, l'heure et la durée souhaitées.", "error");

        return;
    }

    if(!accepte){

        showToast("Vous devez accepter les conditions d'utilisation pour continuer.", "error");

        return;
    }

    const submitBtn =
    document.getElementById("reservationModalSubmit");

    submitBtn.disabled = true;

    try{

        const resultat =
        await apiFetch("/reservations", {

            method: "POST",

            body: JSON.stringify({
                logement_id: logementId,
                message,
                conditions_acceptees: true,
                date_souhaitee: dateSouhaitee,
                heure_souhaitee: heureSouhaitee,
                duree_sejour: dureeSejour
            })

        });

        showToast("Demande de visite envoyée ! Le propriétaire va l'examiner — direction la discussion avec lui...");

        fermerModaleReservation();

        // Emmène directement le locataire dans l'espace de
        // discussion avec ce propriétaire, pour qu'il puisse
        // échanger sans devoir chercher où cliquer ensuite.
        const racine =
        window.API_BASE ? window.API_BASE.replace("backend/api", "") : "";

        setTimeout(() => {

            window.location.href =
            racine + "pages/dashboard-proprietaire/dashboard-proprietaire.html?discuter=" + resultat.owner_id;

        }, 1200);

    }catch(error){

        if(error.status === 401){

            showToast("Connectez-vous pour demander une visite — redirection...", "error");

            fermerModaleReservation();

            const lienConnexion =
            document.querySelector(".btn-nav-link");

            setTimeout(()=>{

                if(lienConnexion){

                    window.location.href =
                    lienConnexion.getAttribute("href");

                }

            }, 1500);

        }else{

            showToast(error.message || "Impossible d'envoyer la demande de réservation.", "error");

        }

    }finally{

        submitBtn.disabled = false;

    }

}

function attacherBoutonsReservation(container){

    container.querySelectorAll(".btn-reserver").forEach(btn => {

        btn.addEventListener("click", (e) => {

            e.preventDefault();

            if(btn.dataset.statut === "reserve"){

                showToast("Ce logement est déjà réservé.", "error");

                return;
            }

            reserverLogement(btn.dataset.id);

        });

    });

}

/* ==========================
    DURÉE DE LOCATION
    Réutilisé par toutes les cartes de logement (accueil,
    recherche, similaires) pour afficher le prix avec la bonne
    période ("/mois", "/nuit", "/semaine"...) au lieu d'un "/mois"
    fixe qui serait faux pour une annonce en courte durée.
========================== */

// Pour "3_mois", "6_mois" et "1_an", le prix reste un loyer MENSUEL
// (voir le formulaire de publication : "3 mois (minimum)", "6 mois
// (minimum)") — seul l'engagement de location est plus long, pas la
// fréquence de paiement. Afficher "/3 mois" ou "/an" laissait croire
// à tort que le prix était une somme forfaitaire pour toute la
// période, d'où la confusion ("100 000 F/an" alors que c'est
// 100 000 F chaque mois). La durée d'engagement choisie par le
// propriétaire est affichée séparément, voir libelleEngagementDuree().
const LIBELLES_COURTS_DUREE = {
    "24h": "/24h",
    nuit: "/nuitée",
    journee: "/jour",
    semaine: "/semaine",
    "1_mois": "/mois",
    "3_mois": "/mois",
    "6_mois": "/mois",
    "1_an": "/mois"
};

function libelleCourtDuree(duree){

    return LIBELLES_COURTS_DUREE[duree] || "/mois";

}

// Durée d'engagement à afficher séparément du prix, uniquement pour
// les locations longue durée avec un minimum de séjour supérieur au
// mois simple — "1_mois" n'a pas besoin d'être précisé, c'est le cas
// par défaut sans engagement particulier.
const LIBELLES_ENGAGEMENT_DUREE = {
    "3_mois": "Engagement 3 mois",
    "6_mois": "Engagement 6 mois",
    "1_an": "Engagement 1 an"
};

function libelleEngagementDuree(duree, dureeAutre){

    if(duree === "autre"){
        return dureeAutre ? "Engagement " + dureeAutre : null;
    }

    return LIBELLES_ENGAGEMENT_DUREE[duree] || null;

}

// Icône représentant le TYPE réel du logement (Chambre, Studio,
// Appartement...) — même mapping que les icônes des "Catégories
// populaires" sur l'accueil, pour rester cohérent partout sur le
// site. Avant cet ajout, les cartes affichaient toujours une icône
// de lit générique quel que soit le type réel de l'annonce.
const ICONES_TYPE_LOGEMENT = {
    Chambre: "ph-bed",
    Studio: "ph-door-open",
    Appartement: "ph-buildings",
    Villa: "ph-house-line",
    Bureau: "ph-briefcase",
    Immeuble: "ph-building-office",
    "Passe-temps": "ph-confetti"
};

function iconeTypeLogement(type){

    return ICONES_TYPE_LOGEMENT[type] || "ph-house-simple";

}

// Le nombre saisi par le propriétaire représente une unité
// différente selon le type de bien : des chambres pour un logement
// résidentiel, des bureaux pour un espace professionnel. Même champ
// en base (logement.chambres), libellé adapté à l'affichage.
const UNITES_PIECES_PAR_TYPE = {
    Bureau: "bureau"
};

function libeleUnitePieces(type){

    return UNITES_PIECES_PAR_TYPE[type] || "chambre";

}

// Temps écoulé depuis la publication ("il y a 2h", "il y a 3 jours"...)
// affiché sur chaque carte, comme un fil d'actualité.
function ilYA(dateString){

    if(!dateString) return "";

    const secondes =
    Math.floor((Date.now() - new Date(dateString.replace(" ", "T"))) / 1000);

    if(secondes < 60) return "à l'instant";

    const minutes =
    Math.floor(secondes / 60);

    if(minutes < 60) return "il y a " + minutes + " min";

    const heures =
    Math.floor(minutes / 60);

    if(heures < 24) return "il y a " + heures + "h";

    const jours =
    Math.floor(heures / 24);

    if(jours < 7) return "il y a " + jours + " jour" + (jours > 1 ? "s" : "");

    const semaines =
    Math.floor(jours / 7);

    if(semaines < 4) return "il y a " + semaines + " semaine" + (semaines > 1 ? "s" : "");

    const mois =
    Math.floor(jours / 30);

    if(mois < 12) return "il y a " + mois + " mois";

    const ans =
    Math.floor(jours / 365);

    return "il y a " + ans + " an" + (ans > 1 ? "s" : "");

}

// Annonce publiée il y a moins de 48h : sert à afficher le badge
// "Nouveau" sur les cartes (accueil, recherche).
function estAnnonceRecente(dateString){

    if(!dateString) return false;

    const heures =
    (Date.now() - new Date(dateString.replace(" ", "T"))) / 1000 / 3600;

    return heures >= 0 && heures < 48;

}

// Cartes fantômes affichées pendant le chargement des logements
// (accueil, recherche), à la place d'un écran vide ou d'un simple
// texte "Chargement..." — donne une sensation de rapidité même sur
// une connexion lente.
function skeletonCardsHTML(nombre){

    return Array.from({ length: nombre || 6 }).map(() => `
        <div class="card-skeleton">
            <div class="card-skeleton-image"></div>
            <div class="card-skeleton-body">
                <div class="card-skeleton-line" style="width:70%"></div>
                <div class="card-skeleton-line" style="width:45%"></div>
                <div class="card-skeleton-line" style="width:55%"></div>
            </div>
        </div>
    `).join("");

}

/* ==========================
    CARROUSEL PHOTOS (CARTES)
    Réutilisé par l'accueil et la recherche pour faire défiler
    automatiquement les photos d'une annonce qui en a plusieurs
    (image data-photos="url1|url2|url3"), avec des points de
    navigation cliquables.
========================== */

function demarrerCarrousels(container){

    container.querySelectorAll(".carousel-img[data-photos]").forEach(img => {

        const photos =
        img.dataset.photos.split("|").filter(Boolean).map(url => ({ type: "image", url }));

        // Les vidéos de l'annonce rejoignent le même carrousel que
        // les photos (même rotation, mêmes points de navigation) —
        // une vidéo apparaît donc sur la carte au même titre qu'une
        // photo, pas seulement sur la page détails.
        const videos =
        (img.dataset.videos || "").split("|").filter(Boolean).map(url => ({ type: "video", url }));

        const slides =
        photos.concat(videos);

        if(slides.length <= 1) return;

        const video =
        img.parentElement.querySelector(".carousel-video");

        const dotsContainer =
        img.parentElement.querySelector(".carousel-dots");

        let index = 0;

        if(dotsContainer){

            dotsContainer.innerHTML =
            slides.map((_, i) => `<span class="carousel-dot${i === 0 ? " active" : ""}"></span>`).join("");

        }

        const afficherSlide = (i) => {

            index = i;

            const slide = slides[index];

            if(slide.type === "video" && video){

                img.style.display = "none";

                video.style.display = "";

                if(video.getAttribute("src") !== slide.url){
                    video.src = slide.url;
                }

                video.currentTime = 0;
                video.play().catch(() => {});

            }else{

                if(video){

                    video.pause();
                    video.style.display = "none";

                }

                img.style.display = "";
                img.src = slide.url;

            }

            if(dotsContainer){

                dotsContainer.querySelectorAll(".carousel-dot").forEach((dot, di) => {

                    dot.classList.toggle("active", di === index);

                });

            }

        };

        let intervalle =
        setInterval(() => afficherSlide((index + 1) % slides.length), 3500);

        const carte =
        img.closest(".card, .housing-card");

        if(carte){

            carte.addEventListener("mouseenter", () => clearInterval(intervalle));

            carte.addEventListener("mouseleave", () => {

                intervalle = setInterval(() => afficherSlide((index + 1) % slides.length), 3500);

            });

        }

        if(dotsContainer){

            dotsContainer.querySelectorAll(".carousel-dot").forEach((dot, i) => {

                dot.addEventListener("click", (e) => {

                    e.preventDefault();
                    e.stopPropagation();

                    afficherSlide(i);

                });

            });

        }

    });

}

/* ==========================
        TOAST
========================== */

function showToast(message, type = "success"){

    const toast =
    document.getElementById("toast");

    const icone =
    type === "error" ? "⚠️" : "✅";

    toast.innerHTML =
    icone + " " + message;

    toast.classList.toggle("toast-error", type === "error");

    toast.classList.add("show");

    setTimeout(()=>{

        toast.classList.remove("show");

    },3000);

}
