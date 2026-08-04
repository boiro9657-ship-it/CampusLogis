/* ==========================================================
   TARIFS.JS — page tarifs uniquement
   ========================================================== */

document.querySelectorAll("[data-plan]").forEach(btn => {

    btn.addEventListener("click", () => {

        const plan = btn.dataset.plan;

        showToast(
            "Formule " + plan + " bientôt disponible — " +
            "paiement Wave / Orange Money en cours d'intégration."
        );

    });

});
