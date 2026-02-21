# CI/CD — автоматический деплой

## Как работает

При каждом push в ветку `main` GitHub Actions автоматически:

```
Push в main
    │
    ▼
GitHub Actions (ubuntu-latest)
    │
    ├── 1. Checkout код
    ├── 2. docker build -t clauder:latest .
    ├── 3. docker save | gzip → clauder.tar.gz
    ├── 4. SCP: копирует clauder.tar.gz + docker-compose.yml → /opt/clauder/
    └── 5. SSH: docker load + docker compose down + docker compose up -d
```

## Файл workflow

`.github/workflows/deploy.yml`

## Необходимые GitHub Secrets

Настраиваются в: GitHub repo → Settings → Secrets and variables → Actions

| Secret | Значение | Где взять |
|--------|----------|-----------|
| `SERVER_HOST` | `155.212.186.174` | IP сервера |
| `SERVER_USER` | `root` | Пользователь SSH |
| `SERVER_SSH_KEY` | Приватный ключ | `cat C:\Users\unfor\.ssh\neon-server` |

## Что происходит на сервере при деплое

```bash
cd /opt/clauder
docker load < clauder.tar.gz          # загрузка нового образа
docker compose down                     # остановка старых контейнеров
docker compose up -d                    # запуск с новым образом
rm clauder.tar.gz                       # очистка
```

## Что сохраняется при деплое

- ✅ Данные PostgreSQL (volume `postgres_data`)
- ✅ Файлы в workspace (bind mount)
- ✅ npm global пакеты (volume `usr_local`)
- ✅ `.env` конфигурация (на хосте, не в образе)
- ✅ SSH ключи и git конфиг (на хосте)
- ⚠️ apk пакеты — переустанавливаются entrypoint'ом из `.packages` (~10-30 сек)

## Ручной деплой (без CI/CD)

Если нужно задеплоить вручную:

### С локальной машины:
```bash
cd c:/Users/unfor/YandexDisk/Projects/MYOWN/Clauder
docker build -t clauder:latest .
docker save clauder:latest | gzip > clauder.tar.gz
scp clauder.tar.gz docker-compose.yml neon-server:/opt/clauder/
rm clauder.tar.gz
```

### На сервере:
```bash
cd /opt/clauder
docker load < clauder.tar.gz
docker compose down && docker compose up -d
rm clauder.tar.gz
```

## Откат к предыдущей версии

Docker сохраняет предыдущие образы. Для отката:
```bash
# Посмотреть доступные образы
docker images clauder

# Откатить к конкретному (по IMAGE ID)
docker tag <IMAGE_ID> clauder:latest
docker compose down && docker compose up -d
```

## Логи деплоя

```bash
# Проверить что контейнеры запустились
docker compose -f /opt/clauder/docker-compose.yml ps

# Логи приложения
docker compose -f /opt/clauder/docker-compose.yml logs -f app

# Health check
curl http://localhost:8080/api/health
```
