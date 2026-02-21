# Архитектура сервера Clauder

## Общая схема

```
Internet
  │
  ▼
clauder.smartrs.tech (DNS A-запись → 155.212.186.174)
  │
  ▼
Nginx (порт 443, SSL termination)
  │  proxy_pass + WebSocket upgrade
  ▼
127.0.0.1:8080 (Docker контейнер: app)
  │
  ├── Go binary (/app/clauder)        ← HTTP API + WebSocket сервер
  ├── Claude Code CLI (/usr/local/bin/claude) ← вызывается Go-сервером
  ├── Bash PTY                         ← веб-терминал через WebSocket
  └── Static files (/app/static)       ← React SPA
  │
  ▼
PostgreSQL (Docker контейнер: postgres, порт 5432, только внутри Docker network)
```

## Docker контейнеры

| Контейнер | Образ | Назначение |
|-----------|-------|------------|
| `clauder-app-1` | `clauder:latest` (custom) | Go сервер + Claude CLI + терминал |
| `clauder-postgres-1` | `postgres:16-alpine` | База данных |

## Сетевая изоляция

- PostgreSQL **НЕ** выставлен наружу — доступен только внутри Docker network по хосту `postgres`
- App слушает только `127.0.0.1:8080` — недоступен напрямую из интернета
- Весь внешний трафик идёт через Nginx (SSL, WebSocket proxy)
- UFW блокирует всё кроме 22 (SSH), 80, 443

## Что внутри контейнера app

| Компонент | Путь | Назначение |
|-----------|------|------------|
| Go binary | `/app/clauder` | HTTP/WS сервер |
| Frontend build | `/app/static/` | React SPA (отдаётся Go) |
| Claude Code CLI | `/usr/local/bin/claude` | AI ассистент |
| Node.js + npm | `/usr/bin/node`, `/usr/bin/npm` | Для Claude CLI |
| Git + SSH | `/usr/bin/git`, `/usr/bin/ssh` | Для git операций |
| apk-persist | `/usr/local/bin/apk-persist` | Персистентная установка пакетов |
| CLAUDE.md | `/app/CLAUDE.md` | Инструкции для Claude (копируется в workspace) |
| entrypoint.sh | `/entrypoint.sh` | Скрипт инициализации |
