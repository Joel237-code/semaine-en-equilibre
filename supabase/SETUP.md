# Configuration Supabase

Cette configuration prépare le stockage partagé. Le site actuel reste en mode local tant que le client Supabase n’a pas été ajouté et connecté.

## 1. Créer le projet

Crée un compte/projet Supabase dans le tableau de bord officiel. Choisis un mot de passe de base de données et garde-le privé; il ne sera pas nécessaire pour le navigateur.

## 2. Installer les tables et les règles

Dans Supabase, ouvre **SQL Editor**. Copie le contenu de [schema.sql](schema.sql), exécute-le une seule fois, puis vérifie que les tables `plans`, `plan_members` et `events` apparaissent.

Le schéma active RLS et limite un planning à deux membres. Le compte propriétaire peut consulter le planning et créer des propositions de sport. Le compte invité saisit et gère ses horaires, puis accepte, modifie ou refuse les propositions. C’est le rôle prévu si tu crées le planning et transmets le code à ta copine. Le code d’invitation est aléatoire, stocké sous forme hachée et utilisable une fois.

## 3. Activer les comptes

Dans **Authentication → Sign In / Providers**, active l’inscription par e-mail et mot de passe. Les deux personnes auront leur propre compte. Les règles de la base, et non l’interface, contrôlent qui peut accéder au planning.

## 4. Connecter le site

Depuis **Project Settings → API**, récupère uniquement :

- **Project URL**
- **Publishable key** (souvent préfixée par `sb_publishable_`)

Ces valeurs identifient le projet; elles sont prévues pour le client web lorsque les règles RLS sont correctement configurées. N’envoie et ne publie jamais la clé **Secret/service_role**, le mot de passe de base de données ou un jeton d’accès.

Une fois le projet créé, ces deux valeurs publiques suffiront pour terminer le branchement du site.

## 5. Utiliser le planning à deux

Le compte propriétaire crée le planning et transmet le code d’invitation à usage unique à sa partenaire. Elle crée son compte, rejoint le planning avec ce code, puis saisit ses horaires. Elle garde le contrôle des changements proposés pour le sport.
