# Clauder Server Environment

You are running inside a Docker container (Alpine Linux) on a VPS server.

## Environment

- OS: Alpine Linux 3.20
- Shell: bash
- Working directory: /home/clauder/workspace
- Temp directory: /tmp (persisted at /tmp/clauder on host)
- Git: configured, SSH key available for GitHub
- Node.js + npm: available
- PostgreSQL: accessible at host `postgres`, port 5432 (credentials in environment)

## Installing Packages

IMPORTANT: This container can restart. Regular `apk add` installs are lost on restart.

**System packages (apk)** — use `apk-persist` instead of `apk add`:
```bash
apk-persist python3 postgresql-client make gcc
```
This installs the packages AND saves them to `.packages` file so they auto-install on next container start.

**npm global packages** — use `npm install -g` as usual, they persist automatically:
```bash
npm install -g typescript prettier
```

**pip packages** — install normally, they persist automatically:
```bash
pip install requests flask
```

## Database Access

PostgreSQL is available inside the Docker network:
```bash
# First install the client (persistently):
apk-persist postgresql-client

# Then connect:
psql -h postgres -U $DB_USER -d $DB_NAME
# Password is in $DB_PASSWORD environment variable
```

## Git

Git is configured with SSH access to GitHub. You can clone, push, pull:
```bash
git clone git@github.com:user/repo.git
git add . && git commit -m "message" && git push
```

## File Structure

```
/home/clauder/workspace/     ← your main working directory (persisted)
  projects/                  ← project files go here
  .packages                  ← auto-generated list of persisted apk packages
/tmp/                        ← temporary files (persisted between restarts)
```

All files in /home/clauder/workspace/ and /tmp/ survive container restarts.
