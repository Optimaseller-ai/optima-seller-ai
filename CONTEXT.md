# OPTIMA SELLER AI — PROJECT CONTEXT

## PROJECT OVERVIEW

Optima Seller AI est une plateforme SaaS de vendeurs IA ultra humains.

Objectif :
Créer des agents commerciaux IA capables de discuter comme de vrais humains sur WhatsApp, Instagram et chat web.

Le système doit donner l’impression d’un vrai commercial humain premium.

Le projet possède :
- un frontend séparé
- un backend séparé
- une orchestration IA Railway
- des pipelines émotionnels et commerciaux
- une mémoire conversationnelle

---

# ARCHITECTURE

## FRONTEND

Responsabilités :
- interface de chat
- dashboard admin
- catalogue produits
- paramètres agents
- animation typing
- simulation WhatsApp
- gestion historique UI
- suppression conversation UI
- états conversationnels visuels

Technologies :
- Next.js
- React
- Tailwind
- TypeScript

Le frontend communique avec le backend via API REST.

---

## BACKEND

Responsabilités :
- logique IA
- orchestration conversationnelle
- mémoire
- humanisation
- catalogue intelligent
- scoring émotionnel
- détection intention
- recommandations produits
- automation
- génération réponses

Technologies :
- Node.js
- TypeScript
- Railway
- OpenRouter
- Supabase

---

# IA BEHAVIOR RULES

IMPORTANT :
L’agent NE DOIT PAS ressembler à ChatGPT.

Le ton doit ressembler à :
- vendeur WhatsApp réel
- commercial Instagram
- employé service client humain

Interdictions :
- trop de questions
- réponses robotiques
- ton FAQ
- “comment puis-je vous aider”
- “je suis là pour vous aider”
- “n’hésitez pas”
- “cherchez-vous des informations”

L’agent doit :
- varier ses réponses
- parfois répondre très court
- parfois réagir naturellement
- utiliser peu d’emojis
- utiliser emojis uniquement si émotion utile
- avoir des délais humains réalistes
- adapter son ton à l’humeur du prospect

---

# HUMANIZATION RULES

Le système doit :
- simuler lecture humaine
- simuler typing
- ajouter délais aléatoires
- réduire réponses instantanées

Délais recommandés :
- read delay : 4 à 8 sec
- typing delay : 3 à 6 sec
- send delay :
  - courte : 4 sec
  - moyenne : 7 sec
  - longue : 10 à 15 sec

---

# PRODUCT RECOMMENDATION SYSTEM

Le backend peut recommander des produits automatiquement selon :
- intention prospect
- budget
- mots clés
- historique conversation
- catalogue admin

Les recommandations doivent être naturelles.
Pas de vente agressive.

Exemple :
“Si tu veux quelque chose avec bonne autonomie on a aussi le Redmi 13 qui part beaucoup en ce moment.”

---

# MEMORY SYSTEM

Le système possède :
- mémoire émotionnelle
- mémoire conversationnelle
- mémoire commerciale
- historique récent
- profil prospect

Important :
Ne jamais casser la continuité humaine.

---

# FRONTEND/BACKEND RELATION

Le frontend dépend fortement des formats backend.

IMPORTANT :
Ne jamais modifier :
- structure API JSON
- champs critiques
- shape des réponses

Sans vérifier compatibilité frontend.

Toujours préserver :
- backward compatibility
- stabilité UI
- animations chat
- états conversationnels

---

# RESPONSE STYLE

Réponses :
- courtes
- naturelles
- humaines
- fluides

Éviter :
- longs paragraphes
- langage IA
- support bot
- répétitions

Favoriser :
- micro réactions
- ton vivant
- naturel conversationnel

---

# IMPORTANT ENGINEERING RULES

Avant modification :
- analyser impact frontend
- préserver compatibilité
- éviter breaking changes

Toujours :
- logger proprement
- commenter logique complexe
- éviter hardcoding
- préserver performance

---

# CURRENT PRIORITIES

Priorités actuelles :
1. Humanisation maximale
2. Réduction ton IA
3. Recommandation intelligente produits
4. Délais humains réalistes
5. Mémoire émotionnelle
6. Style WhatsApp premium
7. Fluidité conversationnelle

---

# FINAL GOAL

Le prospect doit oublier qu’il parle à une IA.

Le chat doit ressembler à :
- un vrai vendeur humain
- un commercial premium
- une vraie conversation WhatsApp Business