# Semaine pour Guyane

Planning hebdomadaire partagé du lundi au dimanche, avec horaires d’école, travail, sport, spiritualité et autres activités.

## Utiliser comme application web

L’application peut être installée depuis le navigateur sur l’écran d’accueil ou le bureau. Sur Android, ouvre le site dans Chrome puis choisis **Installer l’application** dans le menu. Sur iPhone, ouvre-le dans Safari, touche **Partager**, puis **Sur l’écran d’accueil**.

Une connexion Internet reste nécessaire pour se connecter et synchroniser les activités dans Supabase.

## Fonctionnement

- Parcourir les semaines avec les flèches ; les activités restent associées à leurs dates.
- Les comptes autorisés retrouvent le même planning sur leurs appareils.
- Les activités et le suivi financier sont stockés dans Supabase ; l’application reste publiée sur GitHub Pages.
- Les activités annulées restent visibles et peuvent être réactivées ou supprimées. Les activités accomplies affichent une coche verte.
- Les activités Supabase ne sont pas recopiées dans le stockage local. L’ancienne copie sans propriétaire est supprimée pour éviter un import entre comptes. Les copies de semaines partagées restent locales et séparées.

## Configuration Supabase

Le frontend utilise l’URL du projet et une clé publishable. La clé secret/service_role ne doit jamais être placée dans le code public.

La base utilise les tables `planners`, `planner_members` et `activities`, protégées par Row Level Security. Chaque compte doit être membre du planning. Après création des comptes, ajoute leurs identifiants à `planner_members` dans le SQL Editor.

Pour activer le suivi financier partagé, exécute une fois le script `supabase/migrations/20261014010000_add_financial_tracking.sql` dans le SQL Editor de Supabase. Il crée les tables pour le salaire mensuel et les dépenses et limite leur accès aux membres du planning.

Pour enregistrer le statut des activités accomplies, exécute aussi `supabase/migrations/20261015000000_add_completed_status.sql` dans le SQL Editor.

Ajoute l’URL GitHub Pages aux URL de redirection autorisées de Supabase :
`https://joel237-code.github.io/semaine-en-equilibre/`

Site : <https://joel237-code.github.io/semaine-en-equilibre/>

## Rapport des activités

Le rapport sous le planning présente le total des activités enregistrées ainsi que les activités annulées et accomplies, globalement et par catégorie. Choisis la semaine affichée, un mois, des dates personnalisées ou tout l’historique. Le taux d’accomplissement correspond aux activités accomplies divisées par toutes les activités enregistrées, annulations incluses. Les activités supprimées sont exclues. Une copie partagée ne contient que sa semaine, pas l’historique du planning. Aucune migration supplémentaire n’est nécessaire.

Les chargements financiers ignorent les réponses des mois précédemment sélectionnés. À chaque enregistrement du salaire, le navigateur envoie `updated_at` (date UTC de son horloge). Cela ne remplace pas un trigger serveur pour les modifications effectuées hors de cette application ; aucun changement de structure SQL n’est appliqué.

## Factures mensuelles

Dans « Suivi financier → Mes factures mensuelles », indique le nom, le montant et le jour (1–31). La récurrence commence au mois sélectionné. À partir de l’échéance, les factures sont proposées dans « Ajouter une dépense » jusqu’à confirmation. Les mois futurs ne proposent rien avant la date ; pour les mois passés, les factures non ajoutées restent disponibles. Le 31 devient le dernier jour des mois courts. Le bouton « Ajouter » enregistre la dépense à la date d’échéance, sans effectuer de paiement. Un index unique évite un double ajout pour une même facture et un même mois, même entre appareils. Supprimer la dépense permet de la proposer de nouveau. « Arrêter » désactive les propositions futures sans effacer les dépenses.

**Activation nécessaire :** faire valider puis exécuter `supabase/migrations/20261022000000_add_recurring_bills.sql` dans le SQL Editor Supabase. Ce script ajoute la table de factures avec les règles d’accès des membres, une référence facultative dans les dépenses et la protection contre les doublons. Sans migration, le suivi financier existant reste utilisable et la nouvelle fonction indique qu’une configuration est nécessaire. Aucune migration n’est exécutée automatiquement au déploiement.
