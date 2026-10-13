# Semaine en équilibre

Un agenda hebdomadaire pour répartir école, travail, voyages, moments spirituels et sport.

## Fonctionnalités du prototype

- Parcourir les semaines et revenir à la semaine en cours.
- Ajouter, modifier et supprimer des activités.
- Filtrer par catégorie et voir le nombre d’activités.
- Adapter l’affichage aux téléphones et aux ordinateurs.

## Données et confidentialité

La version actuellement publiée enregistre encore les activités dans le stockage local du navigateur (`localStorage`). Elles ne se synchronisent pas entre appareils.

Le schéma Supabase de préparation se trouve dans [supabase/schema.sql](supabase/schema.sql). Il prévoit un planning privé limité à deux comptes : la personne propriétaire saisit les horaires fixes et gère les activités; la personne invitée peut consulter le planning et proposer des créneaux de sport. **Ce schéma n’est pas encore connecté au site publié.**

Le dépôt et le code du site sont publics. N’y ajoutez jamais d’horaires réels, de mots de passe, de clés secrètes ou de données personnelles. Le navigateur pourra utiliser uniquement l’URL du projet et la clé publique Supabase, avec les règles RLS du schéma activées. La clé secrète/service-role Supabase ne doit jamais être mise dans le site.

## Préparer le stockage partagé

Suivez [les étapes de configuration Supabase](supabase/SETUP.md). La connexion de l’application au projet Supabase reste à effectuer après la création du projet.

## Publication

GitHub Pages publie automatiquement le contenu de la branche `main`, depuis la racine du dépôt. Les changements poussés sur `main` mettent le site à jour.

Site : <https://joel237-code.github.io/semaine-en-equilibre/>
