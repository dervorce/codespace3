# Git Hosting Prototype

A minimal GitHub/GitLab-style git host: users, repositories, and real
`git clone` / `push` / `pull` over HTTP, built with Express + Supabase
(Postgres) in an MVC layout.

## Architecture

```
models/           User/Repository data access (Supabase Postgres via supabase-js)
controllers/      Route handlers (auth, repos, git protocol)
routes/           Express routers
middleware/       JWT auth (dashboard/API), Basic auth (git), error handler
config/           Supabase client
utils/            Bare-repo path resolution
supabase/         SQL schema to run against your Supabase project
app.js            Express app assembly (morgan, routes, error handling)
server.js         Entry point -- app.listen()
Dockerfile        Container build for deployment
data/repos/       Bare repositories live here on disk, one per owner/name
```

### Why no serverless platform

`git push`/`pull` needs to write bare repositories to disk and have that
disk still be there for the next request. Platforms like Vercel only offer
an ephemeral `/tmp` that's wiped between invocations and not shared across
instances -- fine for stateless APIs, not for a git server.

So this runs as a single always-on Node process in a container, deployed
anywhere that gives you a **persistent volume**: Railway, Render, Fly.io,
a Docker host, or a plain VPS. The dashboard/API and the git protocol live
in the same process now -- no more splitting them across two hosts.

## Setup

1. **Create a Supabase project** at supabase.com, then run the schema:
   - Dashboard -> SQL Editor -> paste the contents of `supabase/schema.sql` -> Run
   - (or via CLI: `supabase db execute -f supabase/schema.sql`)

2. **Configure environment**
   ```bash
   npm install
   cp .env.example .env
   # fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (Project Settings -> API),
   # and a random JWT_SECRET
   ```

3. **Run it**
   ```bash
   npm run dev
   ```
   Requires the `git` binary on `PATH` locally (it shells out to
   `git upload-pack` / `git receive-pack`).

## Deploying (Railway example)

1. Push this repo to GitHub, create a new Railway project from it. Railway
   detects the `Dockerfile` automatically.
2. In the service's **Settings -> Volumes**, add a volume mounted at
   `/app/data/repos`. Without this, pushed repos disappear on every
   redeploy/restart.
3. In **Variables**, set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `JWT_SECRET`.
4. Generate a public domain under **Networking**.

Render and Fly.io work the same way in spirit: build from the `Dockerfile`,
attach a persistent disk/volume at `/app/data/repos`, set the same three
env vars.

## Using it

1. **Register a user**
   ```bash
   curl -X POST http://localhost:4000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"username":"alice","email":"alice@example.com","password":"hunter2"}'
   ```
   Save the returned `token` for authenticated dashboard/API calls.

2. **Create a repository**
   ```bash
   curl -X POST http://localhost:4000/api/repos \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"name":"my-project","description":"hello world"}'
   ```
   This runs `git init --bare` on disk and stores the metadata in Supabase.
   Response includes `cloneUrl`.

3. **Push real code to it** -- standard git, using the account's
   username/password over HTTP Basic Auth:
   ```bash
   cd some-existing-project
   git remote add origin http://alice:hunter2@localhost:4000/alice/my-project.git
   git push origin main
   ```

4. **Clone it elsewhere**
   ```bash
   git clone http://alice:hunter2@localhost:4000/alice/my-project.git
   ```
   (Public repos can be cloned with no credentials at all.)

5. **Browse without cloning**
   ```bash
   curl http://localhost:4000/api/repos/alice/my-project/branches
   curl http://localhost:4000/api/repos/alice/my-project/tree?ref=main
   curl http://localhost:4000/api/repos/alice/my-project/blob/README.md?ref=main
   ```

## What's intentionally left out (prototype scope)

- Web UI (this is API-only right now)
- Collaborators/teams/permissions beyond "owner can push"
- SSH transport (HTTP only)
- Personal access tokens (uses the account password directly -- fine for a
  prototype, not for production)
- Diffs, commit history browsing, PRs/merge requests
- Supabase Auth (this uses its own username/password + JWT flow instead,
  because git's Basic Auth needs an arbitrary username/password check that
  doesn't map cleanly onto Supabase Auth's email-based sign-in -- worth
  revisiting later if you want magic links/OAuth for the web dashboard)

## Scaling beyond a prototype

Multiple app instances writing to the same volume is fine for Railway/Fly
(single-writer volumes), but if you outgrow that, move repo storage off
local disk entirely -- e.g. sync each bare repo to/from object storage
(Supabase Storage or S3) as a tarball at the start/end of each git request,
or use a pure-JS git implementation (`isomorphic-git`) with a custom
virtual filesystem backed by object storage.
