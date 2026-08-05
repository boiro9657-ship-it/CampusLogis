/* ==========================================================
   SENEGAL-LOCATIONS.JS
   Liste des villes du Sénégal (une entrée par région) et des
   quartiers pour Dakar et les grandes villes, utilisée pour
   suggérer des lieux réels (recherche, publication d'annonce)
   au lieu de laisser un champ libre sans contrôle.
   ========================================================== */

const VILLES_SENEGAL = [

    // Région de Dakar — quartiers détaillés (forte densité d'annonces attendue)
    "Dakar - Plateau", "Dakar - Médina", "Dakar - Fann", "Dakar - Point E",
    "Dakar - Mermoz", "Dakar - Sacré-Cœur", "Dakar - Ouakam", "Dakar - Ngor",
    "Dakar - Yoff", "Dakar - Almadies", "Dakar - Liberté 1", "Dakar - Liberté 6",
    "Dakar - Sicap Liberté", "Dakar - Grand Dakar", "Dakar - Grand Yoff",
    "Dakar - HLM", "Dakar - Colobane", "Dakar - Hann", "Dakar - Cambérène",
    "Dakar - Ouest Foire", "Dakar - Front de Terre", "Dakar - Gibraltar",
    "Guédiawaye", "Pikine", "Parcelles Assainies", "Keur Massar",
    "Rufisque", "Bargny", "Diamniadio", "Sébikotane", "Sangalkam",

    // Région de Thiès
    "Thiès", "Mbour", "Saly", "Tivaouane", "Joal-Fadiouth", "Nguékhokh", "Pout",

    // Région de Saint-Louis
    "Saint-Louis", "Richard-Toll", "Dagana", "Podor",

    // Région de Diourbel
    "Diourbel", "Touba", "Mbacké", "Bambey",

    // Région de Louga
    "Louga", "Linguère", "Kébémer",

    // Région de Fatick
    "Fatick", "Gossas", "Foundiougne", "Sokone",

    // Région de Kaolack
    "Kaolack", "Nioro du Rip", "Guinguinéo",

    // Région de Kaffrine
    "Kaffrine", "Birkelane", "Koungheul",

    // Région de Tambacounda
    "Tambacounda", "Bakel", "Goudiry", "Koumpentoum",

    // Région de Kédougou
    "Kédougou", "Salémata", "Saraya",

    // Région de Kolda
    "Kolda", "Vélingara", "Médina Yoro Foula",

    // Région de Sédhiou
    "Sédhiou", "Bounkiling", "Goudomp",

    // Région de Ziguinchor
    "Ziguinchor", "Bignona", "Oussouye", "Cap Skirring",

    // Région de Matam
    "Matam", "Kanel", "Ranérou",

];

/**
 * Remplit tout <datalist id="listeVilles"> présent sur la page
 * avec la liste ci-dessus, pour suggérer des lieux réels tout en
 * laissant la saisie libre (utile pour une adresse précise).
 */
document.addEventListener("DOMContentLoaded", () => {

    const datalist =
    document.getElementById("listeVilles");

    if(datalist){

        datalist.innerHTML =
        VILLES_SENEGAL.map(v => `<option value="${v}"></option>`).join("");

    }

});
