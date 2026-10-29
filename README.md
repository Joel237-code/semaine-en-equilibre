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

Dans « Suivi financier → Mes factures mensuelles », indique le nom, le montant et le jour (1–31). La récurrence commence au mois sélectionné. À partir de l’échéance, les factures sont proposées dans « Ajouter une dépense » jusqu’à confirmation. Les échéances futures sont accessibles dans « Factures à venir » : « Ajouter maintenant » les inscrit immédiatement au budget du mois sélectionné, en conservant leur date d’échéance. Pour les mois passés, les factures non ajoutées restent disponibles. Le 31 devient le dernier jour des mois courts. Le bouton « Ajouter » enregistre la dépense à la date d’échéance, sans effectuer de paiement. Un index unique évite un double ajout pour une même facture et un même mois, même entre appareils. Supprimer la dépense permet de la proposer de nouveau. « Arrêter » désactive les propositions futures sans effacer les dépenses.

**Activation nécessaire :** faire valider puis exécuter `supabase/migrations/20261022000000_add_recurring_bills.sql` dans le SQL Editor Supabase. Ce script ajoute la table de factures avec les règles d’accès des membres, une référence facultative dans les dépenses et la protection contre les doublons. Sans migration, le suivi financier existant reste utilisable et la nouvelle fonction indique qu’une configuration est nécessaire. Aucune migration n’est exécutée automatiquement au déploiement.

## Copie de semaine

« Copier la semaine précédente » est proposé uniquement si la semaine affichée est entièrement vide. Il ajoute les activités non annulées à la semaine affichée avec de nouveaux identifiants et des statuts remis à zéro. Les activités identiques déjà présentes sont ignorées ; des identifiants déterministes empêchent les doubles copies simultanées d'une même activité. Les activités existantes ne sont pas écrasées. Les copies partagées ne permettent pas la copie de semaine cloud.

## Budget : catégories, modification et report

Les dépenses sont modifiables depuis leur ligne. Les catégories alimentent un graphique mensuel avec montants et pourcentages. Le bouton de report du mois précédent a été retiré. Les reports déjà enregistrés restent affichés et inclus dans le solde ; aucune donnée n’est supprimée. Activer les catégories et le report avec `supabase/migrations/20261026010000_extend_finances.sql` après validation. Sans cette migration, les dépenses restent consultables et modifiables sans catégorie.

## Confort et synchronisation

- Le bouton de thème alterne clair/sombre et mémorise uniquement cette préférence sur l’appareil. Le thème système est utilisé à la première ouverture.
- La recherche d’activité a été retirée pour garder le planning simple.
- Sur ordinateur, glisser une activité vers un autre jour la déplace. Sur téléphone et au clavier, ouvrir l’activité et modifier sa date offre la même possibilité.
- Un chevauchement produit un avertissement et demande confirmation à l’enregistrement/déplacement. Les activités annulées et les horaires simplement adjacents ne sont pas des conflits.
- La synchronisation en direct recharge les données du planning courant après un changement. Les formulaires financiers en cours de saisie sont préservés ; leurs mises à jour attendent la sortie du formulaire. La désinscription est faite à la déconnexion. Les suppressions déclenchent une relecture limitée au planning courant.

### Activation des nouveautés du 26 octobre

Exécuter dans l’ordre, après validation dans Supabase SQL Editor :
1. `supabase/migrations/20261026010000_extend_finances.sql` : catégories et report financier.
2. `supabase/migrations/20261026020000_enable_planning_realtime.sql` : tables dans la publication Realtime. Nécessite les migrations précédentes, notamment les factures mensuelles.

Ces scripts ne sont pas exécutés par le déploiement web. Le fonctionnement des règles RLS, de la publication et de la synchronisation entre deux comptes doit être vérifié sur le projet Supabase réel après activation. Les tests locaux simulent les réponses et événements Supabase.

Tests : `node --test tests/regressions.cjs`, puis `python3 tests/mobile.py`, `python3 tests/planning.py`, `python3 tests/finances.py`, `python3 tests/bills.py` et `python3 tests/comfort.py` et `python3 tests/navigation.py` (Playwright et Chromium requis pour les tests navigateur).

## Navigation mobile

Sur téléphone et tablette (jusqu’à 900 px), Planning, Rapport et Budget sont trois vues séparées, accessibles dans la barre de navigation en bas de l’écran. L’URL `?view=planning`, `?view=report` ou `?view=budget` permet une ouverture directe et les boutons Retour/Suivant du navigateur fonctionnent. Changer de vue ne recharge pas les données ni les formulaires. Les anciennes copies partagées conservent leur fragment d’URL et n’affichent pas le Budget. Sur grand écran, les sections restent sur la même page. Aucune migration SQL supplémentaire n’est nécessaire.

Les objectifs hebdomadaires ont été retirés de l’interface et des requêtes de l’application. Les anciennes tables et données Supabase ne sont pas supprimées. Le résumé par catégorie est supprimé de l’interface. Sur mobile, les filtres de catégorie et l’introduction sont masqués ; les catégories restent disponibles dans les activités et le rapport.

### Dons et offrandes

La catégorie « Dons et offrandes » (`donations`) est disponible dans les dépenses et leur graphique mensuel. Avant de l’utiliser, valider puis exécuter `supabase/migrations/20261029000000_add_donations_expense_category.sql` pour l’autoriser dans la contrainte des catégories. Les dépenses existantes sont conservées et les règles d’accès restent inchangées.
