# Compte à Rebours Configurable pour Conférence

Un compte à rebours web interactif et synchronisé pour les conférences, présentations et événements.

## Fonctionnalités

- **Gestion du temps :** Ajustement rapide de la durée (+/- 1 min, 5 min, 10 min).
- **Mode Heure Seule :** Basculez facilement de l'affichage du compte à rebours à l'affichage de l'heure courante.
- **Synchronisation multi-écrans :** Master/Slave automatique via `BroadcastChannel` pour afficher le compte à rebours en temps réel sur plusieurs écrans ou fenêtres de navigateur.
- **Alerte visuelle :** Seuil d'avertissement configurable (changement de couleur de fond en ambre puis en rouge).
- **Messages en surimpression :** Possibilité d'envoyer un message temporaire à tous les écrans connectés.
- **Maintien de l'écran allumé :** Intégration de l'API `Screen Wake Lock` pour éviter que l'écran ne se mette en veille pendant les présentations.

## Structure du projet

- `countdown.html` : Structure HTML principale de l'application.
- `style.css` : Feuille de style de l'application avec variables CSS.
- `font.css` & `azeret_mono.ttf` : Police à chasse fixe utilisée pour un alignement parfait des chiffres.
- `app.js` : Logique JavaScript (gestion du minuteur, synchronisation Master/Slave, événements DOM, BroadcastChannel).

## Utilisation

1. Ouvrez `countdown.html` dans un navigateur web moderne.
2. Pour synchroniser plusieurs fenêtres, ajoutez un identifiant de session dans l'URL hash, par exemple :
   `countdown.html#session=conference2025`
3. Utilisez le bouton **Config** pour régler la durée initiale (en minutes) et le seuil d'avertissement (en secondes).
4. Utilisez le bouton **Message** pour diffuser un message à l'écran.
