# Timex — resumo do protótipo

## Correr e publicar
```
npm install
npm run dev          # só frontend (proxy /api → :8787)
npm run cf:dev       # build + Worker local com /api  → http://localhost:8787
npm test             # 15 testes (motor + assistente)
npm run typecheck
npm run deploy       # build + wrangler deploy   (pede login: npx wrangler login)
```
Deploy via Git (Workers Builds): build command `npm run build`, deploy command `npx wrangler deploy`. Sem variáveis de ambiente.
`wrangler.toml` usa um Worker (`worker/index.ts`) + assets de `dist/`; `functions/` mantém-se para quem preferir Pages (as rotas partilham `backend/api/routes`).

## O que existe
| Parte | Onde | Estado |
|---|---|---|
| Motor de planeamento determinístico | `backend/domains/planning` | Disponibilidade derivada, restrições hard/soft, slots, scoring configurável, pausas, limite diário, prazos, feasibility + conflitos + razões |
| Assistente | `backend/ai` | Interface `AIProvider`, tools com schema (zod), interpretador **offline por regras** PT/EN. Propõe; só aplica com confirmação |
| API (Worker) | `worker/`, `backend/api/routes` | `/health`, `/plans/generate`, `/assistant/message` — validação zod |
| UI | `src/features` | Hoje, Calendário semanal, Atividades, Objetivos, Assistente, Definições. Claro/escuro, mobile com tab bar |
| Docs | `docs/api.md`, `docs/decisions/001-002` | ADRs das decisões abaixo |

Fluxo demonstrável: dados de exemplo → *Gerar plano* → ver conflitos/explicações (clicar num bloco) → remover/aceitar; ou pedir ao assistente (“quero estudar 6 horas e ir ao ginásio 4 vezes”, “consigo encaixar 3h de programação?”, “porque…?”).

## Desvios ao CLAUDE.md (a decidir por ti)
1. **Sem PostgreSQL/auth**: dados em `localStorage`, API sem estado (ADR 002). Escolhido para funcionar em Pages sem infraestrutura.
2. **Assistente sem LLM**: não há chave de API; o adaptador Claude/OpenAI encaixa em `backend/ai/assistantService.ts`.
3. Limite diário de trabalho tratado como restrição *hard* (docs: preferência).
4. Não implementado: mover blocos (só remover/regenerar), versões de plano além de um contador, recorrência além de “semanal”, DST.

## Nota sobre `docs/`
Os ficheiros estão com conteúdo trocado: `architecture.md` = `product.md` (idênticos), `database.md` contém o planning-engine e `planning-engine.md` contém a arquitetura. Não existe documento de base de dados. Não alterei nenhum.
