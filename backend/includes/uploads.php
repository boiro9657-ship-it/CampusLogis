<?php
/**
 * Enregistrement de fichiers uploadés (photos/vidéos de logements,
 * publicités vocales, messages vocaux...) — partagé entre plusieurs
 * routes pour éviter de dupliquer la logique de validation
 * d'extension et de calcul du chemin public.
 */

function enregistrerMedia(array $fichier, array $extensionsAutorisees, string $sousDossier = 'logements'): ?string
{
    $extension = strtolower(pathinfo($fichier['name'], PATHINFO_EXTENSION));

    if (!in_array($extension, $extensionsAutorisees, true)) {
        return null;
    }

    $nomFichier = uniqid($sousDossier . '_', true) . '.' . $extension;
    $dossier = __DIR__ . '/../uploads/' . $sousDossier . '/';

    if (!is_dir($dossier)) {
        mkdir($dossier, 0755, true);
    }

    move_uploaded_file($fichier['tmp_name'], $dossier . $nomFichier);

    // Chemin public calculé depuis l'emplacement réel du front
    // controller (dirname deux fois : api/ puis backend/) plutôt
    // que codé en dur, pour rester valide quel que soit le
    // dossier de montage du site.
    $baseDossier = str_replace('\\', '/', dirname(dirname($_SERVER['SCRIPT_NAME'])));

    return $baseDossier . '/uploads/' . $sousDossier . '/' . $nomFichier;
}
