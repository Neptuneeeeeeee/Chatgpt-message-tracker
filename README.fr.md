# ChatGPT Message Tracker

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · **Français**

Une extension Chrome locale qui compte les messages que **vous** envoyez sur le site web de ChatGPT, classés par mode (`Instant`, `Medium`, `High`, `Extra High`, `Pro`), pour que vous sachiez toujours combien vous avez réellement utilisé.

> **Compteur local indépendant. Non affilié à OpenAI et non approuvé par OpenAI.**
> Il ne consulte pas les quotas officiels, ne prédit pas le solde restant et ne fournit pas les données d'utilisation officielles d'OpenAI.

![Aperçu de l'interface de ChatGPT Message Tracker](docs/ui-preview.svg)

---

## Installation

Aucune compilation nécessaire : chargez l'extension directement depuis ce dépôt.

1. Clonez ou téléchargez ce dépôt (décompressez l'archive si besoin).
2. Ouvrez Chrome et allez sur `chrome://extensions/`.
3. Activez le **mode développeur** en haut à droite.
4. Cliquez sur **Charger l'extension non empaquetée** et sélectionnez le dossier racine du projet (celui qui contient `manifest.json`).
5. Ouvrez ou rechargez [https://chatgpt.com/](https://chatgpt.com/) : un compteur flottant apparaît en bas à droite de la page.

## Mode d'emploi

1. **Envoyez vos messages normalement.** À l'envoi, l'extension lit le mode sélectionné à côté du champ de saisie et enregistre `+1` pour ce mode une fois que votre message apparaît réellement dans la conversation.
2. **Surveillez le compteur flottant** sur la page, ou cliquez sur l'icône de l'extension pour ouvrir la fenêtre avec les compteurs par mode, `+1` et **Annuler**.
3. **Corrigez les erreurs à tout moment.** Les oublis ou doublons se corrigent avec `+1`, **Annuler** ou en supprimant des enregistrements récents.
4. **Si la détection automatique est imprécise**, ouvrez la fenêtre et désactivez **Détecter le mode** pour compter dans le mode choisi manuellement.
5. **Plus d'options dans la page des paramètres** : renommer les modes, ajouter des modes personnalisés, voir les statistiques par période et quotidiennes, exporter les données en JSON ou effacer les enregistrements.

Ce qui n'est **pas** compté par erreur : valider un candidat IME avec Entrée, appuyer sur Entrée pendant la génération d'une réponse, vider un brouillon ou arrêter une réponse.

## Fonctionnalités

- Comptage des messages envoyés par mode : `Instant`, `Medium`, `High`, `Extra High`, `Pro`, plus vos modes personnalisés.
- Compteur flottant directement sur la page ChatGPT.
- Détection automatique du mode au moment de l'envoi, basée sur la langue et les libellés de la page ChatGPT elle-même — aucune déduction à partir de la langue du navigateur.
- Interface disponible en 21 langues, suivant la langue du navigateur.
- Statistiques par période (3 dernières heures / 24 heures / 7 jours / 30 jours) et statistiques quotidiennes par mode.
- Corrections manuelles : `+1`, annulation et suppression d'enregistrements récents.
- Export des paramètres et des enregistrements d'utilisation en JSON.
- Tout reste sur votre machine, dans le stockage local de l'extension Chrome.

## Confidentialité

Cette extension ne téléverse jamais de données et ne stocke pas le contenu des conversations. Pour confirmer les envois et éviter les doubles comptages, elle compare temporairement le brouillon avec les nouveaux messages dans la mémoire de la page ; ces états transitoires disparaissent à la fermeture de la page. Chaque enregistrement sauvegardé ne contient que :

- l'identifiant du mode
- l'horodatage
- la source de l'enregistrement (bouton d'envoi, touche Entrée ou saisie manuelle)

Consultez la [politique de confidentialité](PRIVACY.md) complète pour plus de détails.

## Limites

- Fonctionne uniquement dans le profil Chrome où l'extension est installée.
- Ne compte que les messages envoyés sur le site web de ChatGPT — pas l'application mobile, les autres navigateurs ou les autres appareils.
- La détection automatique dépend de l'interface de la page ChatGPT ; si ChatGPT la modifie, les sélecteurs devront peut-être être mis à jour.
- C'est un compteur local personnel, pas un compteur officiel d'utilisation d'OpenAI.

## Mise à jour

Après avoir récupéré du nouveau code ou fait des modifications, allez sur `chrome://extensions/` et cliquez sur le bouton de rechargement de la carte **ChatGPT Message Tracker**.

## Développement

```sh
npm ci            # installe les dépendances
npm run check     # vérifications statiques
npm test          # tests unitaires
npm run test:chrome   # charge l'extension réelle dans un profil Chrome isolé avec des pages de test locales
```

La reconnaissance des libellés de mode embarque des preuves pour 21 variantes de langue/région ; les sources, les clés de message d'origine et les empreintes SHA-256 sont consignées dans `docs/site-language-evidence.json`. Pour les revérifier :

```sh
node --expose-gc tools/verify-evidence.mjs /path/to/exported-official-assets
```

## Empaquetage pour le Chrome Web Store

```sh
npm ci
npm run check
npm test
python3 tools/build_release.py
```

Le script génère dans `dist/` le zip de l'extension prêt à être téléversé ainsi qu'un `publish-kit.zip` (documents du publieur, à ne **pas** téléverser). Le dossier `store/` contient les textes de la fiche, les justifications des permissions et de la confidentialité, ainsi que des captures d'écran réelles de l'interface. La liste complète se trouve dans `store/PUBLISHING.md`.
