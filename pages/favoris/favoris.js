/* ==========================================================
   FAVORIS.JS — page favoris uniquement
   Affiche les logements sauvegardés dans localStorage.
   ========================================================== */

const favorisContainer =
document.getElementById(
    "favoris-container"
);

if(favorisContainer){

    // Récupère les identifiants des logements favoris
    const favoris =
    JSON.parse(
        localStorage.getItem("favoris")
    ) || [];

    // Si aucun favori n'existe
    if(favoris.length === 0){

        favorisContainer.innerHTML = `

            <h2>

                Vous n'avez encore
                aucun logement favori.

            </h2>

        `;

    }else{
        // Parcourt chaque logement favori
        favoris.forEach(id=>{

            favorisContainer.innerHTML += `

            <div class="similar-card">

                <img
                src="../../images/logement${id}.jpg"
                alt="Logement">

                <div class="similar-content">

                    <h3>

                        Logement ${id}

                    </h3>

                    <p>

                        ❤️ Ajouté aux favoris

                    </p>

                    <a
                    href="../details-logement/details-logement.html">

                        Voir les détails

                    </a>

                </div>

            </div>

     `;

    });

    }

}
