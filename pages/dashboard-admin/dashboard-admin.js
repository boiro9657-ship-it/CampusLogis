/* ==========================================================
   DASHBOARD-ADMIN.JS — page tableau de bord admin uniquement
   Page protégée : redirige vers la connexion si aucune session
   active, vers l'accueil si connecté mais pas administrateur.
   ========================================================== */

(async () => {

    let utilisateur;

    try{

        utilisateur = await apiFetch("/auth/me");

    }catch(error){

        window.location.href =
        "../connexion/connexion.html";

        return;
    }

    if(utilisateur.role !== "admin"){

        window.location.href =
        "../../index.html";

        return;
    }

    chargerUtilisateurs();
    chargerAnnonces();
    chargerReservations();
    chargerMessages();

})();

/* ==========================
    DÉCONNEXION
========================== */

const logoutLink =
document.getElementById("logoutLink");

if(logoutLink){

    logoutLink.addEventListener("click", async (e) => {

        e.preventDefault();

        await apiFetch("/auth/logout", { method:"POST" });

        window.location.href =
        "../../index.html";

    });

}

/* ==========================
    UTILISATEURS
========================== */

async function chargerUtilisateurs(){

    let utilisateurs = [];

    try{

        utilisateurs = await apiFetch("/admin/utilisateurs");

    }catch(error){

        showToast("Impossible de charger les utilisateurs.", "error");

        return;
    }

    document.getElementById("statUtilisateurs").textContent =
    utilisateurs.length;

    const table =
    document.getElementById("tableUtilisateurs");

    const lignesEntete =
    table.querySelector("tr").outerHTML;

    table.innerHTML =
    lignesEntete +
    utilisateurs.map(u => `
        <tr>
            <td>${u.nom_complet}</td>
            <td>${u.email}</td>
            <td>${u.telephone || "—"}</td>
            <td><span class="role-badge ${u.role === "admin" ? "role-admin" : ""}">${u.role}</span></td>
            <td>${new Date(u.created_at).toLocaleDateString("fr-FR")}</td>
            <td>
                ${
                    u.role === "admin"
                    ? ""
                    : `<button class="btn-supprimer-ligne" data-id="${u.id}">Supprimer</button>`
                }
            </td>
        </tr>
    `).join("");

    table.querySelectorAll(".btn-supprimer-ligne").forEach(btn => {

        btn.addEventListener("click", async () => {

            if(!confirm("Supprimer cet utilisateur et tout son contenu ?")) return;

            try{

                await apiFetch("/admin/utilisateurs/" + btn.dataset.id, { method:"DELETE" });

                chargerUtilisateurs();

            }catch(error){

                showToast("Suppression impossible.", "error");

            }

        });

    });

}

/* ==========================
    ANNONCES
========================== */

async function chargerAnnonces(){

    let logements = [];

    try{

        logements = await apiFetch("/admin/logements");

    }catch(error){

        showToast("Impossible de charger les annonces.", "error");

        return;
    }

    document.getElementById("statAnnonces").textContent =
    logements.length;

    document.getElementById("statEnAttente").textContent =
    logements.filter(l => l.statut_validation === "en_attente").length;

    const libellesValidation = {
        en_attente: "En attente",
        approuve: "Approuvée",
        rejete: "Rejetée"
    };

    const table =
    document.getElementById("tableAnnonces");

    const lignesEntete =
    table.querySelector("tr").outerHTML;

    table.innerHTML =
    lignesEntete +
    logements.map(l => `
        <tr>
            <td>${l.titre}</td>
            <td>${l.proprietaire_nom || "Démonstration"}</td>
            <td>${l.ville || ""}</td>
            <td>${Number(l.prix).toLocaleString("fr-FR")} F</td>
            <td>
                <span class="status-badge ${l.statut === "disponible" ? "status-available" : "status-booked"}">
                    ${l.statut}
                </span>
            </td>
            <td>
                <span class="validation-badge validation-${l.statut_validation}">
                    ${libellesValidation[l.statut_validation] || l.statut_validation}
                </span>
            </td>
            <td>
                ${
                    l.statut_validation !== "approuve"
                    ? `<button class="btn-approuver" data-id="${l.id}">Approuver</button>`
                    : ""
                }
                ${
                    l.statut_validation !== "rejete"
                    ? `<button class="btn-rejeter" data-id="${l.id}">Rejeter</button>`
                    : ""
                }
                <button class="btn-supprimer-ligne" data-id="${l.id}">Supprimer</button>
            </td>
        </tr>
    `).join("");

    table.querySelectorAll(".btn-supprimer-ligne").forEach(btn => {

        btn.addEventListener("click", async () => {

            if(!confirm("Supprimer cette annonce ?")) return;

            try{

                await apiFetch("/admin/logements/" + btn.dataset.id, { method:"DELETE" });

                chargerAnnonces();

            }catch(error){

                showToast("Suppression impossible.", "error");

            }

        });

    });

    table.querySelectorAll(".btn-approuver").forEach(btn => {

        btn.addEventListener("click", () => validerAnnonce(btn.dataset.id, "approuve"));

    });

    table.querySelectorAll(".btn-rejeter").forEach(btn => {

        btn.addEventListener("click", () => validerAnnonce(btn.dataset.id, "rejete"));

    });

}

async function validerAnnonce(id, statutValidation){

    try{

        await apiFetch("/admin/logements/" + id + "/valider", {

            method: "PUT",

            body: JSON.stringify({ statut_validation: statutValidation })

        });

        showToast(statutValidation === "approuve" ? "Annonce approuvée." : "Annonce rejetée.");

        chargerAnnonces();

    }catch(error){

        showToast("Action impossible.", "error");

    }

}

/* ==========================
    RÉSERVATIONS
========================== */

async function chargerReservations(){

    const container =
    document.getElementById("reservations-container");

    let reservations = [];

    try{

        reservations = await apiFetch("/admin/reservations");

    }catch(error){

        showToast("Impossible de charger les réservations.", "error");

        return;
    }

    document.getElementById("statReservations").textContent =
    reservations.length;

    if(reservations.length === 0){

        container.innerHTML =
        '<div class="empty-state"><p>Aucune réservation pour le moment.</p></div>';

        return;
    }

    const libellesStatut = {
        en_attente: "En attente",
        confirmee: "Confirmée",
        annulee: "Annulée"
    };

    container.innerHTML =
    reservations.map(r => `
        <div class="reservation-card">

            <div>

                <h3>${r.logement_titre}</h3>

                <p>👤 ${r.locataire_nom} — ${r.locataire_email}</p>

                ${r.message ? `<p>💬 ${r.message}</p>` : ""}

            </div>

            <span class="reservation-statut">
                ${libellesStatut[r.statut] || r.statut}
            </span>

        </div>
    `).join("");

}

/* ==========================
    MESSAGES DE CONTACT
========================== */

async function chargerMessages(){

    let messages = [];

    try{

        messages = await apiFetch("/admin/messages");

    }catch(error){

        showToast("Impossible de charger les messages.", "error");

        return;
    }

    document.getElementById("statMessages").textContent =
    messages.length;

    const table =
    document.getElementById("tableMessages");

    const lignesEntete =
    table.querySelector("tr").outerHTML;

    table.innerHTML =
    lignesEntete +
    messages.map(m => `
        <tr>
            <td>${m.nom}</td>
            <td>${m.email}</td>
            <td>${m.sujet || "—"}</td>
            <td class="wrap">${m.message}</td>
            <td>
                <button class="btn-supprimer-ligne" data-id="${m.id}">Supprimer</button>
            </td>
        </tr>
    `).join("");

    table.querySelectorAll(".btn-supprimer-ligne").forEach(btn => {

        btn.addEventListener("click", async () => {

            if(!confirm("Supprimer ce message ?")) return;

            try{

                await apiFetch("/admin/messages/" + btn.dataset.id, { method:"DELETE" });

                chargerMessages();

            }catch(error){

                showToast("Suppression impossible.", "error");

            }

        });

    });

}
