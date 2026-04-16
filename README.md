# Exotic

**Where connections come alive.** Exotic is an anonymous Q&A social platform that lets you receive questions from anyone, share posts and photos, go live, and build your audience — all in one place.

---

## Features

| Feature | Description |
|---------|-------------|
| **Home Feed** | Curated stream of questions, answers, and posts from people you follow |
| **Discover** | Trending topics, creators, and communities to explore |
| **Posts** | Share photos and videos with your followers |
| **Live Streaming** | Go live in one tap with real-time audience interaction |
| **Question Inbox** | Receive and answer anonymous questions from anyone |
| **Notifications** | Likes, follows, and replies in one place |
| **Profile** | Your answers, posts, and identity — all here |
| **Settings** | Full control over your profile and privacy |
| **Showcase** | Interactive video showcase of the full Exotic experience |

---

## Tech Stack

- **Frontend** — React 19 + React Router 7 (framework mode, SSR)
- **Styling** — Tailwind CSS v4 + shadcn/ui
- **Backend** — Cloudflare Workers
- **Database** — Supabase (PostgreSQL + Auth)
- **Storage** — Cloudflare R2 (media uploads)
- **Real-time** — WebSockets via Cloudflare Durable Objects
- **Live Streaming** — WebRTC
- **Build** — Vite + Bun

---

## Authentication

Exotic uses **username-based login** — no email required at sign-in. Under the hood, the server resolves your username to your account securely using a case-insensitive lookup.

---

## Project Structure

```
app/
├── components/
│   ├── layout/         # App shell, sidebar, mobile nav
│   ├── ui/             # shadcn/ui components
│   └── icons.tsx       # Icon set
├── routes/
│   ├── home.tsx        # Home feed
│   ├── discover.tsx    # Discover / trending
│   ├── posts.tsx       # Posts feed
│   ├── live.tsx        # Live streaming
│   ├── inbox.tsx       # Anonymous question inbox
│   ├── notifications.tsx
│   ├── profile.tsx
│   ├── settings.tsx
│   ├── showcase.tsx    # Video showcase (custom HTML5 player)
│   ├── login.tsx
│   └── api.*.ts        # Server API routes
├── stores/
│   └── auth-store.ts   # Zustand auth state
└── lib/
    └── supabase.ts     # Supabase client
workers/
└── app.ts              # Cloudflare Worker entry
public/
└── exotic_showcase.mp4 # App showcase video
```

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (package manager)
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (Cloudflare CLI)
- A [Supabase](https://supabase.com) project

### Install

```bash
bun install
```

### Environment Variables

Set these in your Cloudflare Worker secrets or `.dev.vars` for local development:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Deploy

```bash
bun run deploy
```

---

## Database

Exotic uses Supabase with the following core tables:

- **profiles** — user profiles (username, display_name, avatar, email, bio)
- **posts** — user posts with media
- **questions** — anonymous questions sent to users
- **answers** — answers to questions
- **follows** — follower/following relationships
- **notifications** — activity notifications

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## License

MIT
