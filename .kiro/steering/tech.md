---
inclusion: always
---

# Tech Stack & Commands

- React 19 + TypeScript 6, Vite 8, Tailwind CSS 4 (`@tailwindcss/vite`), Recharts 3, Lucide React.
- Tests: Vitest 5 with jsdom and Testing Library.
- Persistence: browser `localStorage` key `healthconnect:data:v1`.

## Commands

- `npm install` – install pinned dependencies.
- `npm run dev` – start the dev server (long-running; run manually in a terminal).
- `npm test` – run the full Vitest suite once (`vitest run`).
- `npm run build` – type-check (`tsc --noEmit`) and build for production.
- `npm run preview` – serve the production build.

## Environment note (this machine)

Apple Silicon Mac. An x86_64 Node at `/usr/local/opt/node/bin` cannot execute (no Rosetta). Use the arm64 Node from
Homebrew by putting `/opt/homebrew/bin` first on `PATH`, e.g. `export PATH=/opt/homebrew/bin:$PATH`.
