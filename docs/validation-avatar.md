# Vérification du portrait et du moteur facial

Référence : commit `c352b58`. Modèle utilisé pour les deux versions : **le `sarra7.vrm` du dépôt**, non réexporté et non modifié. SHA-256 : `870569bd48b82bd70ffb5f5bc1a53f9697c237e77d86817afef1612891f0f8f5`.

## Ce qui a été observé

| Vérification | Avant | Après |
| --- | --- | --- |
| Fenêtre `?shell=avatar`, 420 × 462 px, cadrage par défaut | Le front et les yeux remplissaient la fenêtre ; bouche hors champ. | Visage entier, cou et iris visibles. Les deux captures utilisent le même fond gris pour rendre la transparence comparable. |
| Démo web, modèle fourni, boutons **Joie** et **A** | `emotion-targets-unavailable` et `viseme-targets-unavailable` après import. | 66 cibles détectées ; Joie change le rendu et les sept poses sont disponibles. Le profil exporté associe notamment `EE → E`, `P → PP`, `F → FF`. |
| Contexte WebGL demandé par la page Réglages | 1 | 0 ; la page continue d’envoyer les commandes au rendu avatar. |
| Parcours de la scène de l’adaptateur sur 10 000 applications de poids, **après chargement** | 20 000 | 0 ; l’index est construit une fois par modèle. |

Le microtest reconstruit la liste des 82 nœuds et les dictionnaires de cibles depuis le GLB et anime quatre poids. `npm run bench:avatar` imprime aussi une durée locale. La mesure exclut Three.js, le GPU et l’audio : **ce n’est pas une mesure de FPS ni de précision du lipsync vocal**. Pour comparer, exécuter le même `scripts/bench-avatar.mjs` dans une copie de la révision de référence.

## Contrôles effectués

- Linux, Node.js 20.20.2 : `npm test` (moteur facial, Decisions et modules desktop). L’export photoréaliste optionnel, absent du dépôt, est explicitement ignoré ; les vérifications de `sarra7.vrm` s’exécutent réellement.
- `npm --prefix demo ci`, `npm --prefix demo test`, puis `npm run demo:build`. Les tests de caméra projettent les coins du volume du visage dans plusieurs ratios et vérifient le repli pour les modèles monoblocs. Le build Vite réussit ; le module Three.js isolé dépasse légèrement le seuil informatif de 500 kB non compressés.
- Chromium / WebGL2 logiciel (SwiftShader) : ouverture de l’atelier en développement et après compilation. Pour le build, aucune ressource distante n’a été sollicitée. Vérification des vues, des sept boutons de pose, de l’émotion, du retour au neutre et du format mobile (390 px).
- Enregistrement, restauration et export d’un profil ; refus d’un profil d’empreinte différente. Un fichier VRM invalide n’empêche pas de continuer à animer l’ancien, et un import valide le remplace.
- Pages de l’application complète `?shell=avatar` et `?shell=settings` ouvertes sur la même origine dans Chromium, avec les versions npm correspondant à l’import map. Le bouton **Joie** de Réglages fait bouger le visage de l’autre page via `BroadcastChannel`. Un import invalide conserve l’identité du modèle actif ; un import valide est confirmé par la fenêtre d’avatar. Le compteur d’images du moteur de Réglages reste à zéro.

## Contrôle à faire sur le poste Windows

Lancer `npm run desktop:smoke` après installation d’Electron. Vérifier le placement natif de la fenêtre transparente, le raccourci global et les voix du poste. Ces contrôles Windows, les services IA externes et l’alignement voix/lèvres d’une vraie conversation **n’ont pas été validés ici**. Aucun profil vocal utilisateur n’a été recalibré. Pour les vérifications spécifiques à la voix système du navigateur et au micro d’ambiance de l’atelier, voir [Audio de l’atelier](audio-atelier.md).
