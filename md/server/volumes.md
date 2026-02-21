# Volumes и персистентность данных

## Проблема

Docker контейнер — эфемерный. Всё что установлено/создано внутри контейнера **теряется** при перезапуске (`docker compose restart`, `docker compose up -d` после обновления образа).

## Решение: volumes и bind mounts

### Bind mounts (файлы хоста → контейнер)

| Хост | Контейнер | Режим | Что хранит |
|------|-----------|-------|------------|
| `/home/clauder/workspace` | `/home/clauder/workspace` | rw | Проекты, код, файлы Claude |
| `/tmp/clauder` | `/tmp` | rw | Временные файлы |
| `/home/clauder/.gitconfig` | `/root/.gitconfig` | ro | Git конфигурация |
| `/home/clauder/.ssh` | `/root/.ssh` | ro | SSH ключи для GitHub |

### Docker named volumes

| Volume | Контейнер | Что хранит |
|--------|-----------|------------|
| `postgres_data` | `/var/lib/postgresql/data` | Данные PostgreSQL |
| `usr_local` | `/usr/local` | npm global пакеты, pip пакеты, кастомные бинарники |

## Что переживает рестарт

| Тип данных | Сохраняется? | Как |
|------------|:---:|-----|
| Файлы в `/home/clauder/workspace` | ✅ | Bind mount |
| Файлы в `/tmp` | ✅ | Bind mount → `/tmp/clauder` на хосте |
| PostgreSQL данные | ✅ | Named volume `postgres_data` |
| `npm install -g` пакеты | ✅ | Named volume `usr_local` |
| `pip install` пакеты | ✅ | Named volume `usr_local` |
| `apk add` пакеты | ❌ | Теряются! Использовать `apk-persist` |
| `apk-persist` пакеты | ✅ | Записываются в `.packages`, переустанавливаются entrypoint'ом |

## apk-persist — персистентная установка системных пакетов

### Проблема
`apk add python3` устанавливает пакет в `/usr/bin`, `/usr/lib` и т.д. — эти пути не в volume, пакет теряется при рестарте.

### Решение
Скрипт `apk-persist` (в `/usr/local/bin/`):
1. Выполняет `apk add --no-cache` с переданными пакетами
2. Записывает имена пакетов в `/home/clauder/workspace/.packages` (дедупликация)
3. При старте контейнера `entrypoint.sh` читает `.packages` и переустанавливает всё

### Использование
```bash
# Вместо:
apk add python3 postgresql-client

# Писать:
apk-persist python3 postgresql-client
```

### Файл .packages
Расположение: `/home/clauder/workspace/.packages`
Формат: по одному имени пакета на строку
```
python3
postgresql-client
make
gcc
```

## entrypoint.sh — что делает при старте

1. Если `CLAUDE.md` отсутствует в workspace — копирует из `/app/CLAUDE.md` (первый запуск)
2. Если файл `.packages` существует — устанавливает все перечисленные пакеты через `apk add`
3. Запускает основной процесс (`./clauder`)

## Важные замечания

- **Не хранить секреты в workspace** — он доступен через веб-интерфейс (файловый менеджер)
- **Бэкап**: для полного бэкапа нужно сохранить `/home/clauder/workspace`, `/home/clauder/.ssh`, `/opt/clauder/.env` и Docker volumes
- **Обновление образа**: при `docker compose up -d` с новым образом volumes сохраняются, но `apk add` пакеты переустановятся через entrypoint (~10-30 сек задержки старта)
