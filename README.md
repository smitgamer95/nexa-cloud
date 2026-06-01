# NexaCloud — Local Setup

## Quick Start

```bash
# 1. Install dependencies
pnpm install        # or: npm install

# 2. Copy env file (credentials already filled in)
cp .env.example .env

# 3. Run dev server
pnpm dev            # or: npm run dev
```

Open http://localhost:5173 in your browser.

## The .env file
All required values are pre-filled in `.env.example` — just copy it:
```
cp .env.example .env
```

## Build for production
```bash
pnpm build
```
