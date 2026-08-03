/* ==========================================================
   DETAILS-LOGEMENT.JS — page détails logement uniquement
   Retour visuel sur les actions pas encore branchées au backend.
   ========================================================== */

const pendingActions = document.querySelectorAll(
    ".reserve-btn, .btn-call, .btn-whatsapp, .btn-message, .similar-content a"
);

pendingActions.forEach(el => {

    el.addEventListener("click", (e) => {

        e.preventDefault();

        showToast("Fonctionnalité disponible après connexion du backend.");

    });

});
