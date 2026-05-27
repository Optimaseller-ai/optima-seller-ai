# Optima Seller AI — Architecture Migration V1

## Cible

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Vercel    │────▶│  Railway AI API  │────▶│  OpenRouter │
│  (Frontend) │     │  optima-ai-backend│     └─────────────┘
└──────┬──────┘     └────────┬─────────┘
       │                     │
       │              ┌──────▼──────┐
       │              │   Upstash   │
       │              │    Redis    │
       │              └─────────────┘
       │
       ▼
┌─────────────┐
│  Supabase   │  auth, archives, produits, analytics
└─────────────┘
```

## Responsabilités

### Frontend (Vercel) — `optima/`

- UI, pages, dashboard, animations
- Rendu chat client (`chat-client.tsx`)
- Auth UI (Supabase client)
- API routes **légères** : init chat, sync, upload — pas d’orchestration LLM lourde

### AI Backend (Railway) — `optima-ai-backend/`

```
src/
  core/orchestrator/   # OpenRouter + reply orchestration
  routes/              # /v1/chat/reply, /v1/llm/chat
  services/            # auth
  redis/               # typing, locks, sessions
  queue/               # human timing jobs
  timing/              # delay calculators
  supabase/            # persistence client
  memory/              # (phase 2)
  social/              # (phase 2)
```

### Supabase

- Auth, users, business profiles, products
- Conversations **archivées** (JSON messages)
- Analytics
- **Pas** d’orchestration temps réel IA

### Redis (Upstash)

- `typing:{sessionId}` — état frappe
- `reply_lock:{sessionId}` — anti doublon OpenRouter
- `session:{sessionId}` — état chaud
- `timing_queue` — jobs read / typing / follow-up

## Phase 1 — OpenRouter (historique)

### Activer le proxy Vercel → Railway

Dans **Vercel → Project → Settings → Environment Variables → Production** (les deux sont obligatoires) :

```env
OPTIMA_AI_BACKEND_URL=https://your-service.up.railway.app
OPTIMA_AI_BACKEND_SECRET=your-shared-secret-min-16-chars
```

Sans **les deux** variables, Vercel utilise OpenRouter en local (`[OPTIMA_PROXY] fallback_local_openrouter`).

### Vérifier en production

1. `GET https://your-app.vercel.app/api/debug/openrouter-proxy`  
   → `backendEnabled: true`, `mode: "railway"`
2. Envoyer un message chat → logs Vercel :
   - `[OPTIMA_PROXY] using_railway_backend`
   - `[OPTIMA_PROXY] railway_request_start`
3. Logs Railway :
   - `[OPTIMA_AI_BACKEND] incoming_openrouter_chat`

### Fichiers touchés

| Fichier | Changement |
|---------|------------|
| `src/lib/ai/openrouter.ts` | Délègue à Railway si `OPTIMA_AI_BACKEND_URL` défini |
| `src/lib/ai/openrouter-backend-client.ts` | Client HTTP vers `/v1/llm/chat` et `/v1/llm/embed` |
| `optima-ai-backend/` | Nouveau service Fastify |

### Notes

- Cette phase décrivait un **proxy OpenRouter** uniquement.
- Elle n’est plus l’architecture cible : l’orchestrateur complet tourne maintenant côté Railway.

## Phase 2 — Orchestrateur complet

- **Objectif atteint** : `generateAIReply` + pipeline complet tournent dans `POST /v1/chat/reply` côté Railway.
- Le backend Railway est **autonome** (plus de dépendance filesystem au frontend, plus de `OPTIMA_MONOREPO_ROOT`, plus de path scanning hacks).
- `/api/chat/send` (Vercel) délègue à Railway et ne doit plus exécuter l’orchestration localement en production.

## Phase 3 — Retrait serverless IA

- Supprimer `OPENROUTER_API_KEY` de Vercel (optionnel si vous voulez empêcher toute exécution locale)
- Cron relances / followups appellent Railway
- Workers timing queue (BullMQ ou Railway cron)

## Checklist déploiement

- [ ] Railway : déployer le repo backend (service `optima-ai-backend`)
- [ ] Upstash : créer base Redis, copier URL + token
- [ ] Vercel : `OPTIMA_AI_BACKEND_URL` + `OPTIMA_AI_BACKEND_SECRET`
- [ ] Tester `/health` puis un message chat
- [ ] Vérifier logs `[OPTIMA_AI_BACKEND] openrouter_chat_ok`

## Notes de packaging (prod)

- Backend Railway compile en `dist/` et démarre via `node dist/index.cjs`.
- Logs de boot attendus :
  - `[OPTIMA_BACKEND] autonomous_mode=true`
  - `[OPTIMA_BACKEND] monorepo_dependency=false`
