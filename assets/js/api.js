/* ==========================================================
   API.JS
   Petit client pour l'API REST du backend (backend/api/...).
   Chaque page définit `window.API_BASE` avant de charger ce
   fichier — un chemin relatif vers backend/api, exactement
   comme les autres assets (assets/css, assets/js) selon la
   profondeur de la page.
   ========================================================== */

async function apiFetch(path, options = {}){

    const estFormData =
    options.body instanceof FormData;

    const response =
    await fetch(window.API_BASE + path, {

        credentials: "include",

        ...options,

        headers: estFormData
            ? options.headers
            : { "Content-Type": "application/json", ...options.headers }

    });

    let data = null;

    try{

        data = await response.json();

    }catch(e){

        data = null;

    }

    if(!response.ok){

        const message =
        (data && data.error) || "Une erreur est survenue.";

        const erreur =
        new Error(message);

        erreur.status = response.status;

        throw erreur;

    }

    return data;

}
