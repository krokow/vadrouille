# Vadrouille 🧭

**Carnet de voyage collaboratif** : un groupe d'amis ou une famille prépare ensemble planning, carte, réservations, budget et points d'attention — synchronisés en temps réel, consultables hors ligne sur le téléphone.

- 100 % statique, hébergé gratuitement sur **GitHub Pages**
- Backend **Supabase** (offre gratuite) : Auth par lien magique, Postgres + RLS, Realtime, Storage
- Coût cible : **0 €**

> Le nom « Vadrouille » est un nom de travail : il est centralisé dans `src/components/Logo.tsx` (`APP_NAME`), `index.html`, `vite.config.ts` (manifeste PWA) et les modèles d'e-mail.

---

## Sommaire

1. [Fonctionnalités](#fonctionnalités)
2. [Essayer en local (mode démo, sans Supabase)](#essayer-en-local-mode-démo)
3. [Mise en production pas à pas](#mise-en-production-pas-à-pas)
   1. [Créer le projet Supabase](#1-créer-le-projet-supabase)
   2. [Exécuter les migrations](#2-exécuter-les-migrations)
   3. [Configurer l'authentification (URL, SMTP Gmail, modèles d'e-mail)](#3-configurer-lauthentification)
   4. [Secrets GitHub et déploiement](#4-secrets-github-et-déploiement)
   5. [Rappels e-mail avant deadline (optionnel)](#5-rappels-e-mail-avant-deadline-optionnel)
4. [Tests](#tests)
5. [Architecture et choix techniques](#architecture-et-choix-techniques)
6. [Sécurité](#sécurité)
7. [Limites connues et pistes](#limites-connues-et-pistes)

---

## Fonctionnalités

| Domaine | Ce qui est fait |
| --- | --- |
| **Voyages** | Liste « en cours / à venir / passés » avec couverture, dates, avatars et compte à rebours (J-12, Jour 3/5…). Création avec destination en autocomplétion, dates ou « dates à définir », devise, photo (compressée avant envoi). Duplication d'un voyage comme modèle (activités décalées aux nouvelles dates). Voyage d'exemple en un clic. |
| **Tableau de bord** | À faire / à réserver (urgences en tête), prochaines étapes, résumé budget + « on te doit / tu dois », météo Open-Meteo, infos utiles. |
| **Participants** | Invitation par lien (copier, partager, **QR code**), régénérer / désactiver le lien. Rôles organisateur / éditeur / lecteur. Participants « fantômes » sans compte, reliables plus tard à un compte (« C'est moi : Léo »). Couleur par personne réutilisée partout. **Présence en ligne** (qui est connecté en ce moment). |
| **Planning** | Jour par jour, **glisser-déposer** (souris, tactile appui long, clavier) pour réordonner et changer de jour. Zone « idées non planifiées » avec **votes 👍**. Météo par jour. |
| **Activités** | Titre, description, jour/créneau, durée, lieu (carte), liens, coût estimé, catégorie, participants, notes, pièces jointes, **commentaires avec @mention**. |
| **Points d'attention** | Drapeau « À réserver » + statut + date limite avec alerte visuelle (orange < 7 j, rouge clignotant si dépassée). Champs : horaires, jour de fermeture, meilleure heure, dress code, matériel, accessibilité, météo sensible. Lien vers la réservation. |
| **À réserver** | Onglet qui regroupe activités et réservations à faire, triées par urgence, avec « marquer réservé » en un tap. |
| **Carte** | Leaflet, fonds CARTO (avec clé) / OpenStreetMap / relief / satellite. Marqueurs colorés par type, filtres jour/type, **itinéraire du jour** numéroté (vol d'oiseau ou routier via OSRM), fiche rapide, recherche de lieu → « ajouter une activité ici », appui long / clic droit sur la carte, liens Google Maps / Apple Plans. |
| **Réservations** | 8 types, chronologie par jour, statuts, numéro de confirmation, PDF/billets en pièce jointe, **mode billet plein écran** (gros numéro + QR, écran maintenu allumé), création automatique de la dépense liée. |
| **Budget** | Prévisionnel global et par catégorie avec jauges. Dépenses multi-devises (taux BCE figé à la date, via frankfurter.app, modifiable), répartition **parts égales / par parts / montants**, reçu en photo. **Soldes + simplification des dettes** (nombre minimal de virements), « marquer comme remboursé ». Graphiques par catégorie / par jour / par personne. **Export CSV** (format Excel FR). |
| **Collaboration** | Temps réel Supabase sur toutes les tables, « modifié par X il y a 2 min », dernier écrit gagne (`updated_at`, `updated_by` posés par trigger), **historique** « qui a fait quoi » (regroupe les modifications successives). |
| **Préparatifs** | Todo-list d'avant départ (échéances positionnées à J-30, J-7, J-1… via des modèles, responsable, alerte d'urgence, remontée sur le tableau de bord) à côté de la liste partagée des affaires à emporter (modèles plage / montagne / ville / bébé, assignation, filtre « mes affaires »). |
| **Sur place** | **Mode Jour J** (programme du jour, prochaine étape avec compte à rebours, « Y aller », billets, hébergement du soir, météo), **dépense rapide en 3 secondes** (montant → catégorie), **convertisseur de devises express** (taux gardés hors ligne). |
| **Organiser** | **Calendrier visuel** (réservations en barres multi-jours + activités), **comparateur d'options** (prix, note, pour/contre, vote, « Choisir » → réservation), **suggestions d'activités autour d'un lieu** (OpenStreetMap/Overpass : incontournables, musées, points de vue, restos, cafés, bars, parcs). |
| **Budget+** | Répartition **en pourcentages**, **budget par personne en direct** (sa part des dépenses + réservations et activités à venir, multi-devises). |
| **Partage** | **Album photo partagé** (visionneuse plein écran, filtre par personne, téléchargement zip), **lien invité en lecture seule sans compte** (programme, carte, transports/logements — sans numéros ni budget), **notifications** (modifications des autres, @mentions, échéances ; Web Push optionnel même app fermée). |
| **Extras** | **Documents à visibilité restreinte** (passeport privé / assurance partagée, alerte d'expiration avant la fin du voyage). Journal / album photo. Programme **imprimable en PDF**. Export **.ics**. Rappel e-mail avant deadline (Edge Function + cron, optionnel). |
| **PWA** | Installable, consultation hors ligne en lecture seule des derniers voyages chargés (cache TanStack Query persisté + tuiles de carte en cache), bandeau « Hors ligne ». |
| **UX** | Mobile first (barre d'onglets + bouton « + » : activité / réservation / dépense en deux taps), barre latérale sur desktop, mode clair/sombre, skeletons, toasts, états vides, focus visibles, labels accessibles. Dates « lun. 12 mai », montants en locale FR. i18n prête pour l'anglais. |

---

## Essayer en local (mode démo)

Sans variables Supabase, l'application tourne en **mode démo** : tout est stocké dans le navigateur (localStorage), la synchronisation « temps réel » passe d'un onglet à l'autre via `BroadcastChannel`. Pratique pour découvrir l'app et pour les tests e2e.

```bash
npm install
```

```bash
npm run dev
```

Ouvre http://localhost:5173/vadrouille/, saisis n'importe quel e-mail : tu es connecté immédiatement. Pour tester la collaboration, ouvre un second onglet en navigation privée avec un autre e-mail et rejoins le voyage via le lien d'invitation.

> Tu peux forcer le mode démo même avec Supabase configuré en ajoutant `?demo` à l'URL.

---

## Mise en production pas à pas

### 1. Créer le projet Supabase

1. Crée un compte sur https://supabase.com puis **New project** (région Europe, ex. `eu-west-3 Paris`). Note le mot de passe de la base (il ne sert pas à l'app).
2. Dans **Project Settings → API**, récupère :
   - `Project URL` → sera `VITE_SUPABASE_URL`
   - `anon public` key → sera `VITE_SUPABASE_ANON_KEY`
   - ⚠️ **Ne copie jamais la `service_role` key** dans le front ni dans le repo : elle contourne toute la sécurité.

### 2. Exécuter les migrations

**Option A — SQL Editor (le plus simple).** Dans Supabase → **SQL Editor**, exécute dans l'ordre le contenu de :

1. `supabase/migrations/20250101000000_schema.sql` (tables)
2. `supabase/migrations/20250101000100_security.sql` (fonctions, triggers, RLS, RPC d'invitation)
3. `supabase/migrations/20250101000200_storage_realtime.sql` (buckets + politiques Storage, publication Realtime)
4. `supabase/migrations/20250101000300_documents.sql` (documents à visibilité restreinte)
5. `supabase/migrations/20250101000400_prep_tasks.sql` (préparatifs : tâches d'avant départ)
6. `supabase/migrations/20250101000500_features.sql` (répartition en %, album, lien invité, comparateur, abonnements push)
7. *(facultatif)* `supabase/seed.sql`, puis, après ta première connexion à l'app :
   ```sql
   select public.seed_demo_trip((select id from auth.users where email = 'toi@exemple.fr'));
   ```

**Option B — CLI Supabase.**

```bash
npx supabase login
```

```bash
npx supabase link --project-ref <PROJECT_REF>
```

```bash
npx supabase db push
```

Vérifie ensuite dans **Database → Publications → supabase_realtime** que les tables du voyage sont cochées (la migration 3 s'en charge) et dans **Storage** que les buckets `trip-files` (privé) et `avatars` (public) existent.

### 3. Configurer l'authentification

#### URL du site et redirections

**Authentication → URL Configuration** :

- **Site URL** : `https://<ton-user>.github.io/vadrouille/`
- **Redirect URLs** (ajoute les deux) :
  - `https://<ton-user>.github.io/vadrouille/**`
  - `http://localhost:5173/**`

**Authentication → Providers → Email** : garde *Email* activé. Les autres fournisseurs (Google, etc.) restent désactivés : la connexion se fait uniquement par lien magique.

#### SMTP personnalisé via Gmail (liens magiques)

Le service d'e-mail intégré de Supabase est limité à quelques e-mails par heure : on utilise un compte Gmail avec un **mot de passe d'application**. C'est toi qui saisis ce mot de passe directement dans le dashboard Supabase ; il n'est écrit dans **aucun** fichier du dépôt (le repo est public).

Prérequis côté Google :

1. Active la **validation en deux étapes** sur le compte Google (https://myaccount.google.com/security).
2. Crée un **mot de passe d'application** sur https://myaccount.google.com/apppasswords (nom : « Vadrouille Supabase »). Google affiche 16 caractères : copie-les directement dans Supabase, sans les stocker ailleurs.

Dans **Authentication → Emails → SMTP Settings** (« Enable custom SMTP ») :

| Champ | Valeur |
| --- | --- |
| Host | `smtp.gmail.com` |
| Port | `465` |
| Username | ton adresse Gmail complète |
| Password | le mot de passe d'application (16 caractères) |
| Sender email | ton adresse Gmail |
| Sender name | `Vadrouille` |

Puis, dans **Authentication → Rate Limits**, augmente « Rate limit for sending emails » (ex. 30/heure).

Limites à connaître :

- Gmail autorise environ **500 e-mails par jour** : largement suffisant pour un usage entre amis.
- Les e-mails peuvent **arriver dans les spams** (l'app le rappelle après l'envoi) : préviens tes invités et demande-leur de marquer le message comme « non spam ».
- Si l'app grossit : passe à **Resend** (3 000 e-mails/mois gratuits) ou **Brevo** (300/jour gratuits), qui fournissent aussi des identifiants SMTP à mettre au même endroit.

#### Modèles d'e-mail en français

**Authentication → Emails → Templates** :

- **Magic Link** : objet `Ton lien de connexion à Vadrouille`, corps = contenu de `supabase/templates/magic_link.html`.
- **Confirm signup** : objet `Bienvenue sur Vadrouille — confirme ton adresse`, corps = `supabase/templates/confirmation.html`.

Les modèles contiennent le lien **et** le code à 6 chiffres (`{{ .Token }}`) : l'écran de connexion propose de saisir ce code, indispensable quand le lien s'ouvre dans un autre navigateur que l'app installée sur l'écran d'accueil (iOS notamment). Après l'envoi, l'écran affiche « Pense à vérifier tes spams » et un bouton « Renvoyer le lien » avec un délai de 60 secondes.

### 4. Secrets GitHub et déploiement

1. **Settings → Secrets and variables → Actions → New repository secret** :
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = clé `anon public`
   - *(optionnel)* `VITE_CARTO_API_KEY` = clé CARTO Basemaps (voir ci-dessous)
2. **Settings → Pages → Build and deployment → Source : GitHub Actions**.
3. Chaque push sur `main` lance `.github/workflows/deploy.yml` : lint → tests → build (avec `base = /<nom-du-repo>/`) → copie `index.html` en `404.html` → publication sur `https://<ton-user>.github.io/<repo>/`.

Le routing utilise `HashRouter` (`/#/t/…`) : recharger n'importe quelle page fonctionne sur GitHub Pages ; le `404.html` sert de filet de sécurité.

> Si les secrets ne sont pas définis, le site déployé fonctionne en **mode démo** (données locales au navigateur), ce qui permet de vérifier le déploiement avant de brancher Supabase.

Pour développer contre ton projet Supabase :

```bash
cp .env.example .env.local
```

puis renseigne les deux valeurs publiques et relance `npm run dev`.

### Fonds de carte CARTO (optionnel, recommandé)

Depuis septembre 2026, CARTO exige une clé gratuite pour ses fonds de carte (sans clé, les tuiles affichent « API KEY REQUIRED »). Sans clé, l'app bascule automatiquement sur OpenStreetMap / Esri.

1. Demande une clé sur https://carto.com/basemaps/apikey (gratuite jusqu'à 5 millions de tuiles par mois en usage non commercial, sans compte CARTO).
2. Ajoute-la en secret GitHub `VITE_CARTO_API_KEY`, puis relance le workflow de déploiement.

C'est une clé **publique** prévue pour le navigateur (elle apparaît dans les URL des tuiles), comme l'`anon key` Supabase.

### Notifications push (optionnel)

Sans configuration, l'app affiche déjà des notifications système quand elle est ouverte ou en arrière-plan (modifications des autres participants, @mentions, échéances du jour). Pour les recevoir **même app fermée** (Web Push, gratuit) :

1. Génère une paire de clés VAPID :
   ```bash
   npx web-push generate-vapid-keys
   ```
2. Secret GitHub `VITE_VAPID_PUBLIC_KEY` = la clé **publique**, puis relance le déploiement.
3. Secrets Supabase (la clé **privée** ne quitte jamais Supabase) :
   ```bash
   npx supabase secrets set VAPID_PUBLIC_KEY=<publique> VAPID_PRIVATE_KEY=<privée> VAPID_SUBJECT=mailto:<ton-email> PUSH_SECRET=<chaîne aléatoire>
   ```
4. Déploie la fonction puis exécute `supabase/cron/push-notify.sql` (en remplaçant `<PROJECT_REF>` et `<PUSH_SECRET>`) :
   ```bash
   npx supabase functions deploy push-notify --no-verify-jwt
   ```
5. Chacun active les notifications dans **Mon profil → Notifications**. Sur iPhone (iOS 16.4+), il faut d'abord installer l'app sur l'écran d'accueil.

La fonction `deadline-reminders` envoie aussi ses rappels en push quand les clés VAPID sont configurées (l'e-mail via Resend devient alors facultatif).

### 5. Rappels e-mail avant deadline (optionnel)

Une Edge Function (`supabase/functions/deadline-reminders`) envoie chaque matin un récapitulatif des réservations à faire à J-3, J-1 et le jour J aux organisateurs et éditeurs. Elle utilise l'API de **Resend** (offre gratuite) car le SMTP Supabase est réservé aux e-mails d'authentification.

```bash
npx supabase functions deploy deadline-reminders --no-verify-jwt
```

```bash
npx supabase secrets set RESEND_API_KEY=<clé Resend> CRON_SECRET=<chaîne aléatoire> APP_URL=https://<ton-user>.github.io/vadrouille/ MAIL_FROM="Vadrouille <rappels@ton-domaine.fr>"
```

Puis exécute `supabase/cron/deadline-reminders.sql` dans le SQL Editor (en remplaçant `<PROJECT_REF>` et `<CRON_SECRET>`) : il active `pg_cron` + `pg_net`, range le secret dans Vault et planifie l'appel quotidien.

---

## Tests

| Commande | Contenu |
| --- | --- |
| `npm test` | Vitest : répartition des dépenses (centimes, plus forts restes), soldes, **simplification des dettes** (dont 200 cas aléatoires), conversion de devises, export CSV, dates / urgences / comptes à rebours, tri de l'onglet « À réserver ». |
| `npm run e2e` | Playwright (mode démo, 375 px) : créer un voyage → activité « à réserver » avec deadline (vérifiée sur le tableau de bord et dans « À réserver ») → dépense → carte ; **deux comptes qui voient en direct les modifications de l'autre** ; non-membre sans accès ; rechargement d'une page profonde ; absence de défilement horizontal à 375 px. Les services externes sont simulés. |
| `npm run test:rls` | Applique toutes les migrations + seed sur un **Postgres local jetable** (avec un stub minimal d'`auth` et `storage`) et vérifie **les politiques RLS** : non-membre aveugle, lecteur en lecture seule, éditeur sans gestion des membres, jetons d'invitation, fantômes, Storage par chemin `trip_id/…`, documents privés, dernier organisateur, cascades. Nécessite PostgreSQL installé. |
| `npm run lint` / `npm run build` | ESLint + TypeScript strict + build Vite/PWA. |

---

## Architecture et choix techniques

```
src/
  app/            routes (HashRouter), providers, thème, synchro temps réel, landing
  features/
    auth/         connexion lien magique + code, profil
    trips/        liste, création, tableau de bord, paramètres, historique, bagages, journal, documents, impression, .ics
    members/      participants, invitation, page « rejoindre »
    activities/   planning, activité, À réserver (+ logique testée)
    map/          carte Leaflet
    bookings/     réservations, mode billet
    budget/       dépenses, soldes, graphiques (+ logique testée)
  components/ui/  composants façon shadcn/ui (Radix + Tailwind)
  lib/            backend (Supabase / démo), cache & écritures optimistes, fx, géocodage, météo, formats
supabase/
  migrations/     schéma, sécurité, storage/realtime, documents
  seed.sql        fonction seed_demo_trip()
  tests/          tests RLS sur Postgres local
  functions/      Edge Function de rappels
  templates/      e-mails en français
e2e/              Playwright
```

Choix pris quand le cahier des charges laissait le choix (option la plus simple et gratuite) :

- **Couche d'accès aux données abstraite** (`src/lib/backend`) : la même interface est implémentée par Supabase et par un backend local (« mode démo ») qui imite triggers, cascades et règles RLS principales. Requêtes plates par table filtrées sur `trip_id`, jointures côté client.
- **Une colonne `trip_id` sur toutes les tables d'un voyage** (y compris les tables de liaison) : politiques RLS uniformes et un seul abonnement Realtime (`postgres_changes` sur le schéma `public`, filtré par RLS côté serveur). Les DELETE temps réel (qui ne contiennent que l'id) sont appliqués à tous les caches.
- **Identifiants générés côté client** (`crypto.randomUUID`) : mises à jour optimistes immédiates, puis insertion sans `RETURNING` (évite le problème RLS « insert puis select » sur la table `trips`).
- **Votes** dans une table `activity_votes` (une ligne par personne) plutôt qu'un compteur : pas de conflit d'écriture concurrente.
- **Ordre du planning** : `sort_order` flottant (milieu entre les voisins), pas de renumérotation.
- **Flux d'auth implicite** + code OTP : le lien fonctionne même ouvert sur un autre appareil ; la session est récupérée avant de monter le `HashRouter` (le fragment `#access_token` n'entre pas en conflit avec les routes). `?next=` ramène sur la page demandée (ex. lien d'invitation).
- **Selects natifs stylés** plutôt que des listes custom : meilleure ergonomie mobile.
- **Géocodage Photon** (komoot) avec debounce 450 ms, file d'attente à 1 requête/s et cache ; **OSRM public** uniquement sur demande (bouton « Routier »).
- **Taux de change** frankfurter.app (BCE) récupéré à la date de la dépense et stocké dans `fx_rate` (taux figé) ; saisie manuelle possible.
- **Dates/heures des réservations** stockées en `timestamptz` et affichées dans le fuseau de l'appareil.
- **i18n** : i18next avec les textes français comme clés ; il suffit de compléter `src/i18n/en.json` (une base est fournie pour la navigation) — choix de langue dans le profil.
- **PWA** : vite-plugin-pwa (Workbox) ; le cache TanStack Query est persisté dans localStorage 7 jours, les URL signées des fichiers sont exclues.
- **Images** compressées dans le navigateur avant envoi (couvertures, avatars, reçus, photos du journal) pour rester dans le quota Storage gratuit.

---

## Sécurité

- RLS activée sur **toutes** les tables. Fonctions `security definer` : `is_trip_member`, `can_edit_trip`, `is_trip_owner`, `shares_trip_with`.
  - lecture : membres du voyage ; écriture : organisateur / éditeur ; gestion des membres et du lien d'invitation : organisateur ;
  - commentaires et votes : tout membre (même lecteur), uniquement en son nom ;
  - documents privés : uniquement leur propriétaire (table **et** fichier) ;
  - profils : soi-même et ses compagnons de voyage.
- Rejoindre un voyage passe exclusivement par la RPC `join_trip(token)` qui valide le jeton côté base (`trip_preview(token)` pour l'aperçu).
- Triggers de garde : `created_by` immuable, lien d'invitation modifiable par l'organisateur seul, au moins un organisateur par voyage.
- Storage : bucket privé `trip-files` avec politiques par chemin `trip_id/…` (sous-dossier `private/<user_id>/` réservé), URL signées d'une heure ; bucket public `avatars` limité au dossier de chacun.
- Le front ne contient que l'`anon key` publique. Aucun secret (service_role, SMTP, Resend) dans le dépôt.

---

## Limites connues et pistes

- Conflits : « dernier écrit gagne » au niveau de la ligne (pas de fusion champ par champ).
- Le mode hors ligne est en lecture seule (les modifications sont bloquées avec un message).
- Les fichiers supprimés côté base sont supprimés du Storage par l'app ; un fichier orphelin peut subsister si l'envoi échoue en cours de route.
- Le bundle principal pèse ~320 Ko (gzip ~100 Ko) hors React (~50 Ko gzip) ; la carte et les graphiques sont chargés à la demande.
- Pistes : notifications push Web, import d'e-mails de réservation, mode « jour J » plein écran avec la journée en cours, traduction anglaise complète.
