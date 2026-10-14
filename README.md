# Semaine pour Guyane

Planning hebdomadaire partagé du lundi au dimanche, avec horaires d’école, travail, sport, spiritualité et autres activités.

## Utiliser comme application web

L’application peut être installée depuis le navigateur sur l’écran d’accueil ou le bureau. Sur Android, ouvre le site dans Chrome puis choisis **Installer l’application** dans le menu. Sur iPhone, ouvre-le dans Safari, touche **Partager**, puis **Sur l’écran d’accueil**.

Une connexion Internet reste nécessaire pour se connecter et synchroniser les activités dans Supabase.

## Fonctionnement

- Parcourir les semaines avec les flèches ; les activités restent associées à leurs dates.
- Les comptes autorisés retrouvent le même planning sur leurs appareils.
- Les activités et le suivi financier sont stockés dans Supabase ; l’application reste publiée sur GitHub Pages.
- Les activités annulées restent visibles et peuvent être réactivées ou supprimées.
- Les activités présentes dans le stockage local peuvent être importées depuis le navigateur qui les contient.

## Configuration Supabase

Le frontend utilise l’URL du projet et une clé publishable. La clé secret/service_role ne doit jamais être placée dans le code public.

La base utilise les tables `planners`, `planner_members` et `activities`, protégées par Row Level Security. Chaque compte doit être membre du planning. Après création des comptes, ajoute leurs identifiants à `planner_members` dans le SQL Editor.

Pour activer le suivi financier partagé, exécute une fois le script `supabase/migrations/20261014010000_add_financial_tracking.sql` dans le SQL Editor de Supabase. Il crée les tables pour le salaire mensuel et les dépenses et limite leur accès aux membres du planning.

Ajoute l’URL GitHub Pages aux URL de redirection autorisées de Supabase :
`https://joel237-code.github.io/semaine-en-equilibre/`

Site : <https://joel237-code.github.io/semaine-en-equilibre/>
