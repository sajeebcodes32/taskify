# Taskify — Focus. Ship. Repeat.

A Pomodoro-powered task manager built with **Next.js 14**, **MongoDB**, and deployed on **Vercel**.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, CSS Modules |
| Backend | Next.js API Routes (serverless, Vercel-native) |
| Database | MongoDB Atlas via Mongoose |
| Deployment | Vercel |

---

## Local Development

### 1. Clone & install

```bash
git clone https://github.com/your-username/taskify.git
cd taskify
npm install
```

### 2. Set up MongoDB Atlas

1. Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) and create a free cluster
2. Click **Connect → Drivers** and copy your connection string
3. Whitelist your IP (or `0.0.0.0/0` for development)
4. Create a database user

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/taskify?retryWrites=true&w=majority
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deploy to Vercel

### Option A — Vercel CLI (recommended)

```bash
npm i -g vercel
vercel
```

Follow the prompts. When asked about environment variables, add `MONGODB_URI`.

### Option B — GitHub Integration

1. Push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your repository
4. Under **Environment Variables**, add:
   - `MONGODB_URI` → your MongoDB Atlas connection string
5. Click **Deploy**

### MongoDB Atlas: Allow Vercel IPs

In MongoDB Atlas → **Network Access**, add `0.0.0.0/0` to allow connections from Vercel's dynamic IPs.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/tasks` | Fetch all tasks |
| `POST` | `/api/tasks` | Create a new task |
| `PATCH` | `/api/tasks/:id` | Update a task (done, name, tag…) |
| `DELETE` | `/api/tasks/:id` | Delete a task |
| `GET` | `/api/sessions` | Fetch today's Pomodoro sessions |
| `POST` | `/api/sessions` | Log a completed session |

### POST /api/tasks — Request body

```json
{
  "name": "Review pull request",
  "estimatedMin": 25,
  "tag": "work"
}
```

### PATCH /api/tasks/:id — Request body (any subset)

```json
{
  "done": true,
  "name": "Updated name",
  "tag": "urgent"
}
```

---

## Project Structure

```
taskify/
├── app/
│   ├── api/
│   │   ├── tasks/
│   │   │   ├── route.ts          # GET, POST
│   │   │   └── [id]/route.ts     # PATCH, DELETE
│   │   └── sessions/
│   │       └── route.ts          # GET, POST
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx                  # Main UI
│   └── page.module.css
├── lib/
│   └── db.ts                     # MongoDB connection (cached for serverless)
├── models/
│   ├── Task.ts                   # Mongoose schema
│   └── Session.ts                # Pomodoro session schema
├── .env.example
├── .env.local                    # ← never commit this
├── next.config.js
├── package.json
└── tsconfig.json
```

---

## Data Models

### Task

```ts
{
  name: string           // required, max 200 chars
  estimatedMin: number   // 5–480
  tag: 'work' | 'personal' | 'urgent'
  done: boolean
  order: number          // for drag-to-reorder (future)
  completedAt: Date | null
  createdAt: Date        // auto
  updatedAt: Date        // auto
}
```

### Session (Pomodoro)

```ts
{
  taskId: ObjectId | null
  type: 'focus' | 'short' | 'long'
  durationMin: number
  completedFull: boolean
  startedAt: Date
  endedAt: Date | null
}
```

---

## Roadmap

- [ ] User authentication (NextAuth.js)
- [ ] Drag-to-reorder tasks
- [ ] Week view with calendar
- [ ] Push notifications for timer
- [ ] Analytics dashboard
- [ ] PWA / mobile app

---

## License

MIT
