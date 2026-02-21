# Безопасность сервера

## Уровни защиты

### 1. Сетевой уровень

**UFW (файрвол)**
- Открыты только порты: 22 (SSH), 80 (HTTP→redirect), 443 (HTTPS)
- Порт 8080 **закрыт** снаружи — приложение доступно только через Nginx

**Fail2ban**
- Защита от brute-force SSH
- 5 неудачных попыток → бан IP на 1 час

### 2. Nginx

- SSL/TLS через Let's Encrypt (certbot)
- Проксирование на `127.0.0.1:8080` (не наружу)
- WebSocket поддержка (Upgrade headers)
- Лимит размера загрузки: 50MB

### 3. Docker изоляция

- PostgreSQL **не выставлен наружу** (нет `ports:`)
- App слушает только `127.0.0.1` (не `0.0.0.0`)
- `.ssh` и `.gitconfig` смонтированы как **read-only** (`:ro`)
- Контейнеры в отдельной Docker network

### 4. Приложение (Go backend)

**Аутентификация**
- JWT токены (15 минут жизни)
- Refresh токены (7 дней)
- TOTP 2FA (опционально, через Google Authenticator)
- Rate limiting: 10 запросов/минуту на auth endpoints

**Файловая система**
- Все файловые операции через API **sandbox'ны** — проверка `strings.HasPrefix` от `CLAUDE_WORKING_DIR`
- Попытка выйти за пределы workspace → ошибка `Permission denied`
- Скрытые файлы (`.env`, `.ssh`) не показываются в файловом менеджере

**WebSocket**
- JWT токен проверяется при подключении
- Сессия привязана к user_id

### 5. Секреты

| Секрет | Где хранится | Доступ |
|--------|-------------|--------|
| ANTHROPIC_API_KEY | `/opt/clauder/.env` | chmod 600, только root |
| DB_PASSWORD | `/opt/clauder/.env` | chmod 600, только root |
| JWT_SECRET | `/opt/clauder/.env` | chmod 600, только root |
| ADMIN_PASSWORD | `/opt/clauder/.env` | chmod 600, только root |
| SSH ключ (GitHub) | `/home/clauder/.ssh/` | read-only mount |
| SSH ключ (сервер) | `~/.ssh/` | только root |

## Что НЕЛЬЗЯ делать

- Не хранить `.env` в git (уже в `.gitignore`)
- Не открывать порт PostgreSQL (5432) наружу
- Не менять `127.0.0.1:8080` на `0.0.0.0:8080` в docker-compose
- Не коммитить SSH ключи
- Не отключать UFW

## Рекомендации

- Регулярно обновлять: `apt update && apt upgrade -y`
- Обновлять SSL сертификат (certbot renew по крону, обычно настраивается автоматически)
- Мониторить логи: `docker compose logs -f app`
- Периодически проверять fail2ban: `fail2ban-client status sshd`
