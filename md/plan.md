# Clauder — Веб-интерфейс для Claude Code

## Контекст

Нужен сайт (mobile-first), через который можно работать с Claude Code, запущенным на VPS-сервере. По сути — веб-IDE с чатом Claude Code, файловым менеджером, редактором кода и терминалом. Сильная защита с 2FA. Публичная страница-заглушка для будущего лендинга.

## Сервер и деплой

- **IP**: `155.212.186.174`
- **SSH alias**: `neon-server`
- **ОС**: Ubuntu (Claude Code CLI ещё не установлен)
- **Разработка**: локально (Windows) в `Clauder/`
- **Git**: `https://github.com/vvadimkuznetsovv/Clauder`
- **Деплой**: Docker + CI/CD (GitHub Actions → neon-server)
- На сервере потребуется установить: Docker, Claude Code CLI, настроить Anthropic API key

## Стек

- **Backend**: Go (Gin + Gorilla WebSocket + GORM + pq)
- **Frontend**: React + TailwindCSS v4 + Monaco Editor + xterm.js
- **БД**: PostgreSQL
- **Auth**: JWT + TOTP (2FA)
- **Claude**: CLI subprocess с `--output-format stream-json`
- **UI стиль**: Liquid Glass — стеклянные панели с SVG distortion (feTurbulence + feDisplacementMap), lava lamp фон с фиолетовыми (#7F00FF) блобами

---

## Структура проекта

```
Clauder/
├── backend/
│   ├── main.go                  # Точка входа, запуск сервера
│   ├── go.mod
│   ├── config/
│   │   └── config.go            # Конфигурация (env vars, загрузка .env)
│   ├── database/
│   │   ├── database.go          # Подключение к PostgreSQL
│   │   └── migrations.go        # Автомиграции GORM
│   ├── models/
│   │   ├── user.go              # User модель
│   │   ├── session.go           # Chat session модель
│   │   └── message.go           # Message модель
│   ├── handlers/
│   │   ├── auth.go              # Login, TOTP verify/setup/confirm, refresh token
│   │   ├── chat.go              # WebSocket: чат с Claude Code
│   │   ├── files.go             # REST: файловый менеджер (list, read, write, delete)
│   │   ├── terminal.go          # WebSocket: xterm.js ↔ PTY
│   │   └── sessions.go          # REST: CRUD chat sessions
│   ├── middleware/
│   │   ├── auth.go              # JWT middleware
│   │   ├── ratelimit.go         # Rate limiting
│   │   └── cors.go              # CORS
│   ├── services/
│   │   ├── claude.go            # Управление Claude Code CLI процессами
│   │   ├── terminal.go          # PTY менеджер
│   │   └── totp.go              # TOTP генерация/верификация
│   └── utils/
│       └── jwt.go               # JWT helpers
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── public/
│   └── src/
│       ├── main.tsx
│       ├── App.tsx              # Роутинг
│       ├── index.css            # Глобальные стили: lava lamp, glass card, workspace panels
│       ├── api/
│       │   ├── client.ts        # Axios instance с JWT interceptor
│       │   ├── auth.ts          # Auth API calls (login, logout, totp-setup/confirm/verify)
│       │   ├── files.ts         # Files API calls
│       │   └── sessions.ts      # Sessions API calls
│       ├── hooks/
│       │   ├── useWebSocket.ts  # WebSocket hook
│       │   ├── useAuth.ts       # Auth state hook
│       │   └── useChat.ts       # Chat logic hook
│       ├── store/
│       │   └── authStore.ts     # Zustand store для auth
│       ├── pages/
│       │   ├── Landing.tsx      # Публичная страница-заглушка
│       │   ├── Login.tsx        # Логин + TOTP + eye toggle на пароле
│       │   └── Workspace.tsx    # Главная рабочая область (lava lamp + glass panels)
│       └── components/
│           ├── chat/
│           │   ├── ChatPanel.tsx       # Панель чата
│           │   ├── MessageList.tsx     # Список сообщений
│           │   ├── MessageBubble.tsx   # Одно сообщение (markdown)
│           │   └── ChatInput.tsx       # Ввод сообщения
│           ├── files/
│           │   ├── FileTree.tsx        # Дерево файлов
│           │   └── FileTreeItem.tsx    # Элемент дерева
│           ├── editor/
│           │   └── CodeEditor.tsx      # Monaco Editor обёртка
│           ├── terminal/
│           │   └── Terminal.tsx        # xterm.js обёртка
│           └── layout/
│               ├── Sidebar.tsx         # Боковая панель (сессии, 2FA setup, logout)
│               └── MobileNav.tsx       # Мобильная навигация (SVG иконки)
├── md/
│   ├── plan.md                  # Этот файл — полный план проекта
│   ├── plan_keys.md             # Ключевые фичи для реализации
│   └── liquid_glass.md          # Ссылки на референсы Liquid Glass стиля
├── docker-compose.yml
├── Dockerfile
└── .env
```

---

## Схема БД (PostgreSQL)

```sql
-- Пользователи
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    totp_secret VARCHAR(64) NOT NULL,
    totp_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Чат-сессии
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT 'New Chat',
    claude_session_id VARCHAR(255),
    working_directory VARCHAR(500) DEFAULT '/home/user',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Сообщения
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,  -- 'user' | 'assistant' | 'system'
    content TEXT NOT NULL,
    tool_use JSONB,
    tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Refresh tokens
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Endpoints

```
POST   /api/auth/login          # username + password → JWT (если TOTP включён — partial token)
POST   /api/auth/totp-verify    # partial token + TOTP code → full JWT + refresh token
POST   /api/auth/totp-setup     # генерация TOTP secret + QR URL
POST   /api/auth/totp-confirm   # подтверждение TOTP кодом → включение 2FA
POST   /api/auth/refresh        # refresh token → new JWT
POST   /api/auth/logout         # инвалидация refresh token

GET    /api/sessions            # список чат-сессий
POST   /api/sessions            # создать новую сессию
DELETE /api/sessions/:id        # удалить сессию
GET    /api/sessions/:id/messages  # история сообщений

GET    /api/files?path=...      # список файлов/папок
GET    /api/files/read?path=... # содержимое файла
PUT    /api/files/write         # сохранить файл
DELETE /api/files?path=...      # удалить файл

GET    /api/health              # health check

WS     /ws/chat/:sessionId     # чат с Claude Code
WS     /ws/terminal            # веб-терминал
```

---

## UI архитектура: Liquid Glass

### Lava Lamp фон
- 8+ блобов с CSS анимациями (cubic-bezier, 22-34s циклы)
- `filter: contrast(4)` на контейнере для резких краёв
- Блобы уменьшаются на мобильных через `@media (max-width: 640px)`

### SVG Glass Distortion
```html
<filter id="glass-distortion">
  <feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="3" />
  <feGaussianBlur stdDeviation="2.5" />
  <feDisplacementMap in="SourceGraphic" scale="120" />
</filter>
```

### Glass Panel CSS паттерн
- `isolation: isolate` на контейнере
- `::before` (z-index:1) — tint + inner shadow + specular gradient
- `::after` (z-index:-1) — `backdrop-filter: blur(24px)` + SVG `filter: url(#glass-distortion)`
- Shimmer line сверху панели

### Workspace Layout (Desktop)
- Слева: выдвижная панель сессий (260px, анимация width)
- Центр: чат в glass panel (flex-1, min-w-320px) с хедером (toggle сайдбара + название сессии)
- Справа: 2 glass panel — файлы/превью сверху (с табами) + терминал снизу (35%)

### Workspace Layout (Mobile)
- Один glass panel, переключение панелей через нижнюю навигацию
- SVG иконки в MobileNav
- Overlay сайдбар с blur фоном

---

## Текущее состояние реализации

### Готово
- [x] Структура проекта (Go backend + React frontend)
- [x] PostgreSQL подключение (локально, пользователь `clauder`)
- [x] Модели и миграции (User, ChatSession, Message, RefreshToken)
- [x] Auth: Login + JWT + refresh tokens
- [x] Auth: TOTP setup + confirm + verify (backend endpoints)
- [x] Auth middleware + CORS + rate limiting
- [x] Frontend: Login страница с Liquid Glass стилем
- [x] Frontend: Eye toggle на поле пароля
- [x] Frontend: TOTP setup UI в Sidebar (QR код, ввод кода)
- [x] Frontend: Workspace с lava lamp фоном и glass panels
- [x] Frontend: Sidebar (сессии, new chat, 2FA setup, logout)
- [x] Frontend: ChatPanel + MessageList + ChatInput + streaming
- [x] Frontend: FileTree + CodeEditor (Monaco)
- [x] Frontend: Terminal (xterm.js)
- [x] Frontend: MobileNav с SVG иконками
- [x] Sessions CRUD API
- [x] Files REST API
- [x] Chat WebSocket handler
- [x] Terminal WebSocket handler
- [x] Admin user seeding при запуске

### В процессе / Планируется
- [ ] Множественные терминалы (табы как в VS Code)
- [ ] Возможность менять местами окна
- [ ] Скрытие/раскрытие консоли и файлового менеджера
- [ ] Кнопка настроек с навигационной панелью для управления окнами
- [ ] Landing страница с Liquid Glass стилем
- [ ] Docker + CI/CD (GitHub Actions → neon-server)
- [ ] Установка Claude Code CLI на сервере

---

## Локальная разработка

```bash
# PostgreSQL: пользователь clauder, БД clauder, хост 127.0.0.1
# .env в корне проекта

# Backend (порт 8080)
cd backend && go run .

# Frontend (порт 5174)
cd frontend && npm run dev

# Логин: admin / change_me (из .env ADMIN_USERNAME/ADMIN_PASSWORD)
```

---

## Порядок реализации (оставшиеся этапы)

### Этап: Workspace Polish
1. Множественные терминалы с табами
2. Управление панелями (скрытие/показ, перестановка)
3. Кнопка настроек + навигационная панель

### Этап: Landing
4. Liquid Glass лендинг

### Этап: Docker + CI/CD
5. Dockerfile (multi-stage: build frontend → build Go → minimal image)
6. docker-compose.yml (app + PostgreSQL)
7. GitHub Actions workflow: build → push → SSH deploy
8. Скрипт настройки neon-server
