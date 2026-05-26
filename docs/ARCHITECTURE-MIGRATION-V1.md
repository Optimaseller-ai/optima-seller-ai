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

## Phase 1 — OpenRouter (en cours)

### Activer le proxy Vercel → Railway

Dans `.env.local` (frontend) :

```env
OPTIMA_AI_BACKEND_URL=https://your-service.up.railway.app
OPTIMA_AI_BACKEND_SECRET=your-shared-secret-min-16-chars
```

Sans ces variables, le frontend continue d’appeler OpenRouter **directement** (comportement actuel).

### Fichiers touchés

| Fichier | Changement |
|---------|------------|
| `src/lib/ai/openrouter.ts` | Délègue à Railway si `OPTIMA_AI_BACKEND_URL` défini |
| `src/lib/ai/openrouter-backend-client.ts` | Client HTTP vers `/v1/llm/chat` et `/v1/llm/embed` |
| `optima-ai-backend/` | Nouveau service Fastify |

### Non migré en phase 1

- `generateAIReply` (reste dans `src/lib/agents/business-context/reply.ts` sur Vercel)
- Pipeline social / émotion / RAG catalogue
- API route `/api/chat/send` (appelle toujours `generateAIReply` localement, mais OpenRouter via Railway)

## Phase 2 — Orchestrateur complet

- Déplacer `generateAIReply` → `POST /v1/chat/reply`
- `/api/chat/send` devient un proxy mince (validation + Supabase persist)
- Redis gère read receipts et délais côté serveur

## Phase 3 — Retrait serverless IA

- Supprimer `OPENROUTER_API_KEY` de Vercel
- Cron relances / followups appellent Railway
- Workers timing queue (BullMQ ou Railway cron)

## Checklist déploiement

- [ ] Railway : déployer `optima-ai-backend`
- [ ] Upstash : créer base Redis, copier URL + token
- [ ] Vercel : `OPTIMA_AI_BACKEND_URL` + `OPTIMA_AI_BACKEND_SECRET`
- [ ] Tester `/health` puis un message chat
- [ ] Vérifier logs `[OPTIMA_AI_BACKEND] openrouter_chat_ok`
