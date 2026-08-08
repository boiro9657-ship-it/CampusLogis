/* ==========================================================
   PUBLIER-LOGEMENT.JS — page de publication uniquement
   Page protégée : envoie le formulaire (dont la photo) en
   multipart/form-data à l'API, puis redirige vers le tableau
   de bord propriétaire.
   ========================================================== */

// Plan de l'utilisateur connecté, utilisé à la fois pour débloquer
// la publicité vocale et pour la limite de vidéos par annonce plus
// bas dans ce fichier — renseigné dès que "/auth/me" répond ci-dessous.
let planActuel = "gratuit";

const MAX_VIDEOS_PAR_PLAN = {
    gratuit: 2,
    premium: 5,
    pro: 8,
};

(async () => {

    let utilisateur;

    try{

        utilisateur = await apiFetch("/auth/me");

    }catch(error){

        window.location.href =
        "../connexion/connexion.html";

        return;
    }

    // Publicité vocale réservée aux plans Premium/Pro : débloque
    // l'enregistrement uniquement si le compte a réellement ce plan.
    planActuel =
    utilisateur.plan || "gratuit";

    if(planActuel !== "gratuit"){

        const labelVideos =
        document.getElementById("labelVideos");

        const hintVideosPlan =
        document.getElementById("hintVideosPlan");

        const maxVideosCePlan =
        MAX_VIDEOS_PAR_PLAN[planActuel] || MAX_VIDEOS_PAR_PLAN.gratuit;

        if(labelVideos) labelVideos.textContent = "Vidéos (facultatif, jusqu'à " + maxVideosCePlan + ")";

        if(hintVideosPlan){
            hintVideosPlan.style.display = "";
            hintVideosPlan.innerHTML = `<i class="ph ph-crown-simple"></i> Avec votre plan ${planActuel === "pro" ? "Pro" : "Premium"}, publiez jusqu'à ${maxVideosCePlan} vidéos par annonce.`;
        }

        const btnMic =
        document.getElementById("btnAudioMic");

        const badgePlan =
        document.getElementById("badgePlanAudio");

        const hintAudio =
        document.getElementById("hintAudio");

        if(btnMic) btnMic.disabled = false;
        if(badgePlan) badgePlan.style.display = "none";

        if(hintAudio){
            hintAudio.textContent = "Maintenez le micro appuyé pour enregistrer, comme sur WhatsApp — glissez vers la corbeille pour annuler.";
        }

    }

})();

const publishForm =
document.getElementById("publishForm");

/* ==========================
    PUBLICITÉ VOCALE : ENREGISTREMENT MICRO
    Remplace un champ de fichier à choisir par un vrai
    enregistrement depuis le micro du navigateur (MediaRecorder) —
    le propriétaire enregistre directement sur la plateforme au
    lieu d'avoir à préparer un fichier audio à part.
========================== */

let mediaRecorder = null;
let audioChunks = [];
let audioBlobEnregistre = null;
let audioChronoIntervalle = null;
let audioSecondes = 0;
let annulerEnregistrementEnCours = false;
let pointeurEnregistrementActif = false;

const btnAudioMic =
document.getElementById("btnAudioMic");

const btnAudioCancel =
document.getElementById("btnAudioCancel");

const audioStatus =
document.getElementById("audioStatus");

const btnAudioSupprimer =
document.getElementById("btnAudioSupprimer");

const audioPreview =
document.getElementById("audioPreview");

const audioTimer =
document.getElementById("audioTimer");

const audioRecorderRow =
document.getElementById("audioRecorderRow");

const audioPreviewRow =
document.getElementById("audioPreviewRow");

function pointeurSurElement(x, y, el){

    const rect =
    el.getBoundingClientRect();

    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

}

async function demarrerEnregistrementAudio(){

    if(!btnAudioMic || btnAudioMic.disabled) return;

    let stream;

    try{

        stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    }catch(error){

        showToast("Impossible d'accéder au micro. Vérifiez les autorisations de votre navigateur.", "error");

        pointeurEnregistrementActif = false;

        return;
    }

    annulerEnregistrementEnCours = false;
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.addEventListener("dataavailable", (e) => {

        if(e.data.size > 0) audioChunks.push(e.data);

    });

    mediaRecorder.addEventListener("stop", () => {

        stream.getTracks().forEach(track => track.stop());

        if(annulerEnregistrementEnCours){

            audioBlobEnregistre = null;

            return;
        }

        audioBlobEnregistre = new Blob(audioChunks, { type: mediaRecorder.mimeType || "audio/webm" });

        audioPreview.src = URL.createObjectURL(audioBlobEnregistre);

        audioRecorderRow.style.display = "none";
        audioPreviewRow.style.display = "";

    });

    mediaRecorder.start();

    btnAudioMic.classList.add("recording");
    btnAudioCancel.style.display = "";
    audioTimer.style.display = "";
    audioStatus.textContent = "Glissez vers la corbeille pour annuler";

    audioSecondes = 0;
    audioTimer.textContent = "0:00";

    audioChronoIntervalle = setInterval(() => {

        audioSecondes++;

        const minutes = Math.floor(audioSecondes / 60);
        const secondes = String(audioSecondes % 60).padStart(2, "0");

        audioTimer.textContent = minutes + ":" + secondes;

    }, 1000);

}

function arreterEnregistrementAudio(annuler){

    if(!mediaRecorder || mediaRecorder.state === "inactive") return;

    annulerEnregistrementEnCours = annuler;

    mediaRecorder.stop();

    clearInterval(audioChronoIntervalle);

    btnAudioMic.classList.remove("recording");
    btnAudioCancel.style.display = "none";
    btnAudioCancel.classList.remove("audio-cancel-armed");
    audioTimer.style.display = "none";
    audioStatus.textContent = "Maintenez appuyé pour enregistrer";

}

btnAudioMic?.addEventListener("pointerdown", (e) => {

    if(btnAudioMic.disabled) return;

    e.preventDefault();

    pointeurEnregistrementActif = true;

    demarrerEnregistrementAudio();

});

document.addEventListener("pointermove", (e) => {

    if(!pointeurEnregistrementActif || !mediaRecorder || mediaRecorder.state !== "recording") return;

    const surCorbeille =
    pointeurSurElement(e.clientX, e.clientY, btnAudioCancel);

    btnAudioCancel.classList.toggle("audio-cancel-armed", surCorbeille);

});

document.addEventListener("pointerup", (e) => {

    if(!pointeurEnregistrementActif) return;

    pointeurEnregistrementActif = false;

    if(!mediaRecorder || mediaRecorder.state !== "recording") return;

    const surCorbeille =
    pointeurSurElement(e.clientX, e.clientY, btnAudioCancel);

    arreterEnregistrementAudio(surCorbeille);

});

btnAudioSupprimer?.addEventListener("click", () => {

    audioBlobEnregistre = null;

    audioPreview.removeAttribute("src");

    audioPreviewRow.style.display = "none";
    audioRecorderRow.style.display = "";

});

function extensionAudioDepuisType(mimeType){

    if(!mimeType) return "webm";

    if(mimeType.includes("mp4")) return "mp4";
    if(mimeType.includes("ogg")) return "ogg";
    if(mimeType.includes("wav")) return "wav";

    return "webm";

}

/* ==========================
    PETIT MESSAGE AVANT LE CHOIX DE FORMULE
    Une question rapide pour capter l'intérêt pour Premium avant
    d'afficher les 3 formules — toujours possible à ignorer (X ou
    "Non merci") pour continuer directement, le plan Gratuit reste
    à un clic dans la section en dessous.
========================== */

const planTeaser =
document.getElementById("planTeaser");

function fermerTeaserPlan(){

    if(planTeaser) planTeaser.style.display = "none";

}

document.getElementById("planTeaserClose")?.addEventListener("click", fermerTeaserPlan);
document.getElementById("planTeaserNon")?.addEventListener("click", fermerTeaserPlan);

document.getElementById("planTeaserOui")?.addEventListener("click", () => {

    fermerTeaserPlan();

    const cartePremium =
    document.getElementById("cartePremium");

    if(cartePremium){

        cartePremium.scrollIntoView({ behavior: "smooth", block: "center" });

        cartePremium.classList.add("pricing-card-highlight");

        setTimeout(() => cartePremium.classList.remove("pricing-card-highlight"), 2200);

    }

});

/* ==========================
    CHOIX DE LA FORMULE
    Affichée avant le formulaire : le propriétaire peut l'ignorer
    et publier gratuitement (limité à 2 annonces/jour), ou être
    informé que Premium/Pro arrivent bientôt (paiement pas encore
    branché).
========================== */

const planChoice =
document.getElementById("planChoice");

function afficherFormulairePublication(){

    if(planChoice) planChoice.style.display = "none";

    if(publishForm) publishForm.style.display = "";

    window.scrollTo({ top: 0, behavior: "smooth" });

}

document.getElementById("btnContinuerGratuit")?.addEventListener(
    "click",
    afficherFormulairePublication
);

document.getElementById("lienIgnorerPlan")?.addEventListener(
    "click",
    (e) => {

        e.preventDefault();

        afficherFormulairePublication();

    }
);

document.querySelectorAll("#planChoice [data-plan]").forEach(btn => {

    btn.addEventListener("click", async () => {

        const plan = btn.dataset.plan;

        if(!["Premium", "Pro"].includes(plan)){
            return;
        }

        const texteOriginal = btn.textContent;

        btn.disabled = true;
        btn.textContent = "Redirection vers le paiement...";

        try{

            const donnees =
            await apiFetch("/paiements/creer", {
                method: "POST",
                body: JSON.stringify({ plan: plan.toLowerCase(), origine: "publier-logement" }),
            });

            window.location.href = donnees.invoice_url;

        }catch(error){

            showToast(error.message || "Impossible de démarrer le paiement.", "error");

            btn.disabled = false;
            btn.textContent = texteOriginal;

        }

    });

});

/* ==========================
    TYPE DE LOGEMENT : ÉTAGES
    Un immeuble se décrit par son nombre total d'étages ; les
    autres types se décrivent par le niveau d'étage du logement.
========================== */

const typeSelect =
document.getElementById("type");

const groupeNombreEtages =
document.getElementById("groupeNombreEtages");

const groupeNiveauEtage =
document.getElementById("groupeNiveauEtage");

function basculerChampsEtage(){

    const estImmeuble =
    typeSelect.value === "Immeuble";

    if(groupeNombreEtages) groupeNombreEtages.style.display = estImmeuble ? "" : "none";
    if(groupeNiveauEtage) groupeNiveauEtage.style.display = estImmeuble ? "none" : "";

}

if(typeSelect){

    typeSelect.addEventListener("change", basculerChampsEtage);

    basculerChampsEtage();

}

if(publishForm){

    publishForm.addEventListener(
        "submit",
        async (e)=>{

            e.preventDefault();

            const titre =
            document.getElementById("titre").value.trim();

            const ville =
            document.getElementById("ville").value.trim();

            const type =
            document.getElementById("type").value;

            const prix =
            document.getElementById("prix").value;

            const chambres =
            document.getElementById("chambres").value;

            const dureeLocation =
            document.getElementById("duree_location").value;

            const caution =
            document.getElementById("caution").value;

            const nombrePersonnes =
            document.getElementById("nombre_personnes").value;

            const nombreEtages =
            document.getElementById("nombre_etages").value;

            const niveauEtage =
            document.getElementById("niveau_etage").value;

            const description =
            document.getElementById("description").value.trim();

            const photosInput =
            document.getElementById("photos");

            const videosInput =
            document.getElementById("videos");

            const photos =
            photosInput.files;

            const videos =
            videosInput.files;

            if(!titre || !ville || !prix){

                showToast("Veuillez remplir tous les champs obligatoires.", "error");

                return;
            }

            if(Number(prix) < 10000){

                showToast("Le prix minimum est de 10 000 FCFA.", "error");

                return;
            }

            if(!photos || photos.length === 0){

                showToast("Veuillez sélectionner au moins une photo.", "error");

                return;
            }

            if(photos.length > 8){

                showToast("8 photos maximum par annonce.", "error");

                return;
            }

            const maxVideosPlan =
            MAX_VIDEOS_PAR_PLAN[planActuel] || MAX_VIDEOS_PAR_PLAN.gratuit;

            if(videos.length > maxVideosPlan){

                showToast(maxVideosPlan + " vidéos maximum avec votre plan actuel.", "error");

                return;
            }

            const submitBtn =
            publishForm.querySelector(".publish-btn");

            submitBtn.disabled = true;

            const formData =
            new FormData();

            formData.append("titre", titre);
            formData.append("ville", ville);
            formData.append("type", type);
            formData.append("prix", prix);
            formData.append("chambres", chambres);
            formData.append("duree_location", dureeLocation);
            formData.append("caution", caution);
            formData.append("nombre_personnes", nombrePersonnes);
            formData.append("nombre_etages", nombreEtages);
            formData.append("niveau_etage", niveauEtage);
            formData.append("description", description);

            const contactTelephone = document.getElementById("contact_telephone").value.trim();
            const contactWhatsapp = document.getElementById("contact_whatsapp").value.trim();
            const contactEmail = document.getElementById("contact_email").value.trim();

            formData.append("contact_telephone", contactTelephone);
            formData.append("contact_whatsapp", contactWhatsapp);
            formData.append("contact_email", contactEmail);

            document.querySelectorAll('input[name="equipements[]"]:checked').forEach(checkbox => {

                formData.append("equipements[]", checkbox.value);

            });

            document.querySelectorAll('input[name="profils[]"]:checked').forEach(checkbox => {

                formData.append("profils[]", checkbox.value);

            });

            for(const fichier of photos){

                formData.append("photos[]", fichier);

            }

            for(const fichier of videos){

                formData.append("videos[]", fichier);

            }

            if(audioBlobEnregistre){

                const extension =
                extensionAudioDepuisType(audioBlobEnregistre.type);

                formData.append("audio", audioBlobEnregistre, "publicite-vocale." + extension);

            }

            try{

                await apiFetch("/logements", {

                    method: "POST",

                    body: formData

                });

                showToast("Logement publié avec succès !");

                await afficherSuggestionPlan();

            }catch(error){

                showToast(error.message, "error");

                submitBtn.disabled = false;

            }

        }
    );

}

/**
 * Après publication, indique où en est le propriétaire par rapport
 * à la limite quotidienne du plan Gratuit (2 annonces/jour, la
 * même limite que celle appliquée côté serveur) — pas une
 * estimation sur le total d'annonces, mais sur celles du jour.
 */
async function afficherSuggestionPlan(){

    const LIMITE_GRATUIT_PAR_JOUR = 2;

    let nbAujourdhui = 1;

    try{

        const mesLogements =
        await apiFetch("/logements/mine");

        const aujourdhui =
        new Date().toDateString();

        nbAujourdhui =
        mesLogements.filter(l => new Date(l.created_at).toDateString() === aujourdhui).length;

    }catch(error){

        // Si le comptage échoue, on affiche quand même la
        // confirmation de publication sans recommandation précise.

    }

    const carte =
    document.getElementById("planSuggestionCard");

    if(nbAujourdhui < LIMITE_GRATUIT_PAR_JOUR){

        carte.innerHTML = `
            <h3><i class="ph ph-check-circle"></i> Le plan Gratuit vous convient</h3>
            <p>${nbAujourdhui} annonce${nbAujourdhui > 1 ? "s" : ""} publiée${nbAujourdhui > 1 ? "s" : ""} aujourd'hui sur ${LIMITE_GRATUIT_PAR_JOUR} possibles avec le plan Gratuit.</p>
        `;

    }else{

        carte.innerHTML = `
            <h3><i class="ph ph-crown-simple"></i> Limite quotidienne atteinte</h3>
            <p>Vous avez publié ${nbAujourdhui} annonces aujourd'hui, la limite du plan Gratuit. Passez au Premium ou au Pro pour publier davantage dès aujourd'hui, ou revenez demain.</p>
        `;

    }

    publishForm.style.display = "none";

    document.getElementById("planSuggestion").style.display = "";

    window.scrollTo({ top: 0, behavior: "smooth" });

}

/* ==========================================================
   RETOUR DEPUIS PAYDUNYA (succès, échec, annulation, en attente)
   ========================================================== */

(() => {

    const params =
    new URLSearchParams(window.location.search);

    const paiement =
    params.get("paiement");

    if(!paiement) return;

    const planPaye =
    params.get("plan") === "pro" ? "Pro" : "Premium";

    const messages = {
        succes:     [`Paiement confirmé ! Votre formule ${planPaye} est active.`, "success"],
        echec:      ["Le paiement n'a pas abouti. Vous n'avez pas été débité.", "error"],
        annule:     ["Paiement annulé.", "error"],
        en_attente: ["Paiement en cours de traitement, cela peut prendre quelques instants.", "error"],
    };

    const [message, type] = messages[paiement] || [];

    if(message) showToast(message, type);

    if(paiement === "succes") afficherFormulairePublication();

    // Nettoie l'URL pour ne pas redéclencher le toast au rechargement.
    params.delete("paiement");
    params.delete("plan");

    const nouvelleUrl =
    window.location.pathname + (params.toString() ? "?" + params.toString() : "");

    window.history.replaceState({}, "", nouvelleUrl);

})();
