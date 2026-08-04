/* ==========================================================
   DASHBOARD-PROPRIETAIRE.JS — page tableau de bord uniquement
   Affiche/supprime/modifie les logements publiés (localStorage).
   ========================================================== */

/* ==========================
    LIENS SIDEBAR À VENIR
========================== */

document.querySelectorAll(".sidebar-soon").forEach(link => {

    link.addEventListener("click", (e) => {

        e.preventDefault();

        showToast("Fonctionnalité bientôt disponible.");

    });

});

const container =
document.getElementById(
    "annonces-container"
);

if(container){

    const logements =
    JSON.parse(
        localStorage.getItem(
            "logements"
        )
    ) || [];

    if(logements.length === 0){

        container.innerHTML = `
        <div class="empty-state">

            <i class="ph ph-house-simple"></i>

            <p>Vous n'avez encore publié aucune annonce.</p>

            <a href="../publier-logement/publier-logement.html" class="btn-primary">
                + Publier mon premier logement
            </a>

        </div>
        `;

    }

    logements.forEach(
        logement => {

            container.innerHTML += `
            <div class="property-card">

                ${
                    logement.image
                    ?
                    `<img
                        src="${logement.image}"
                        class="property-image">`
                    :
                    ""
                }

                <div class="property-content">

                    <h3>${logement.titre}</h3>

                    <p>📍 ${logement.ville}</p>

                    <p>💰 ${logement.prix} FCFA</p>

                    <p>🛏 ${logement.chambres} chambre(s)</p>

                    <p>${logement.description}</p>

                    <button onclick="supprimerLogement(${logement.id})">
                    🗑 Supprimer
                    </button>

                    <button onclick="modifierLogement(${logement.id})">
                    ✏ Modifier
                    </button>

                </div>

            </div>
            `;

        }
    );

}

function supprimerLogement(id){

    let logements =
    JSON.parse(
        localStorage.getItem("logements")
    ) || [];

    logements = logements.filter(
        logement => logement.id !== id
    );

    localStorage.setItem(
        "logements",
        JSON.stringify(logements)
    );

    location.reload();
}

function modifierLogement(id){

    localStorage.setItem(
        "logementAModifier",
        id
    );

    window.location.href =
    "../publier-logement/publier-logement.html";
}
