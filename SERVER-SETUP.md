# Настройка сервера с нуля — Ubuntu 22.04/24.04

Полная инструкция: безопасность, SSH, firewall, fail2ban, Docker, Go, Node.js.

---

## Шаг 1: SSH-ключ на Windows (на своём компьютере)

Открой PowerShell:

```powershell
# Создать ключ (спросит passphrase — запомни его!)
ssh-keygen -t ed25519 -C "nebulide" -f "$env:USERPROFILE\.ssh\nebulide"
```

- `-t ed25519` — алгоритм шифрования (современный, быстрый, надёжный)
- `-C "nebulide"` — комментарий внутри ключа (чтобы отличать от других ключей)
- `-f ...` — путь куда сохранить файл ключа
- Passphrase — дополнительный пароль на сам ключ. Даже если кто-то украдёт файл ключа, без passphrase он бесполезен

```powershell
# Посмотреть публичный ключ (скопируй — понадобится на сервере)
cat "$env:USERPROFILE\.ssh\nebulide.pub"
```

Результат — два файла:
- `~/.ssh/nebulide` — **приватный** ключ (никому не давать, никуда не копировать)
- `~/.ssh/nebulide.pub` — **публичный** ключ (ставим на сервер)

---

## Шаг 2: SSH config на Windows

SSH config — файл, который позволяет подключаться по короткому имени вместо полной команды.
Вместо `ssh -p 45191 -i ~/.ssh/nebulide nebulide@45.156.20.105` можно просто `ssh nebulide`.

```powershell
# Открыть файл конфигурации SSH в блокноте
notepad "$env:USERPROFILE\.ssh\config"
```

Добавить:

```
Host nebulide
    HostName 45.156.20.105
    User nebulide
    Port 45191
    IdentityFile ~/.ssh/nebulide
    IdentitiesOnly yes
```

- `Host nebulide` — псевдоним. После настройки: `ssh nebulide` = подключиться
- `HostName` — IP-адрес сервера
- `User` — имя пользователя на сервере
- `Port` — нестандартный SSH-порт (по умолчанию 22, мы меняем для безопасности)
- `IdentityFile` — какой приватный ключ использовать
- `IdentitiesOnly yes` — не пробовать другие ключи, только указанный

---

## Шаг 3: Настройка сервера

Подключись от root (через панель хостера или по паролю):

```bash
ssh root@45.156.20.105
```

### 3.1. Обновление системы

```bash
# Обновить список пакетов и установить все обновления
apt update && apt upgrade -y
```

- `apt update` — скачать свежий список доступных пакетов из репозиториев
- `apt upgrade -y` — установить все доступные обновления (`-y` = без подтверждения)

```bash
# Установить нужные утилиты
apt install -y curl wget git ufw fail2ban unattended-upgrades
```

- `curl`, `wget` — скачивание файлов из интернета (разные инструменты, нужны оба)
- `git` — система контроля версий (для клонирования проекта)
- `ufw` — простой firewall (Uncomplicated Firewall)
- `fail2ban` — защита от брутфорса (банит IP после неудачных попыток входа)
- `unattended-upgrades` — автоматическая установка критических обновлений безопасности в фоне

### 3.2. Пароль root

```bash
# Задай надёжный пароль для root — запомни его (нужен для sudo -i)
passwd root
```

- `passwd root` — установить/изменить пароль пользователя root
- Этот пароль понадобится при `sudo -i` (переключение в root из-под nebulide)
- Используй надёжный пароль: минимум 16 символов, буквы + цифры + спецсимволы

### 3.3. Создание пользователя (без пароля)

nebulide — обычный пользователь. Он НЕ root. У него нет пароля — войти можно только по SSH-ключу.
Чтобы выполнить команду от root, нужно ввести `sudo` + пароль root.

```bash
adduser nebulide --disabled-password --gecos ""
```

- `adduser nebulide` — создать пользователя `nebulide` с домашней папкой `/home/nebulide`
- `--disabled-password` — аккаунт без пароля. Войти по паролю невозможно (ни через SSH, ни через `su`). Единственный способ входа — SSH-ключ
- `--gecos ""` — пропустить интерактивные вопросы (имя, телефон, комната и т.д.)

```bash
usermod -aG sudo nebulide
```

- `usermod` — изменить существующего пользователя
- `-a` — **append** (добавить к группам, а не заменить все группы)
- `-G sudo` — добавить в группу `sudo` (право выполнять команды от root)
- Без флага `-a` пользователь был бы удалён из ВСЕХ остальных групп — это сломает аккаунт
- Быть в группе `sudo` ≠ быть root. Это лишь право ЗАПРОСИТЬ повышение, каждый раз с паролем

```bash
# Настроить sudo: запрашивать пароль ROOT (а не пользователя)
echo 'Defaults targetpw' > /etc/sudoers.d/targetpw
chmod 440 /etc/sudoers.d/targetpw
```

- По умолчанию `sudo` спрашивает пароль **текущего** пользователя. Но у nebulide пароля нет — `sudo` не сработает
- `Defaults targetpw` — меняет поведение: sudo спрашивает пароль **целевого** пользователя (target = root)
- `/etc/sudoers.d/` — директория для дополнительных правил sudo (безопаснее чем редактировать основной sudoers)
- `chmod 440` — sudo требует строгие права на свои конфиг-файлы (только чтение для root и группы)

**Итог — разделение прав:**

| Действие | Кто | Пароль |
|----------|-----|--------|
| SSH-вход на сервер | nebulide | SSH-ключ (без пароля) |
| Обычные операции (git, docker, файлы) | nebulide | не нужен |
| `sudo -i` (стать root) | nebulide → root | пароль root |
| `sudo команда` (одна команда от root) | nebulide → root | пароль root |

CI/CD деплой: GitHub Actions подключается по SSH как nebulide, затем выполняет команды через `echo "$ROOT_PASSWORD" | sudo -S команда` (флаг `-S` = читать пароль из stdin).

### 3.4. SSH-ключ для пользователя

```bash
# Создать директорию .ssh для пользователя nebulide
mkdir -p /home/nebulide/.ssh
chmod 700 /home/nebulide/.ssh
```

- `mkdir -p` — создать директорию (и все родительские, если нужно)
- `chmod 700` — доступ только владельцу (чтение + запись + выполнение). SSH отклонит ключ, если права слишком открытые

```bash
# ВСТАВЬ СВОЙ ПУБЛИЧНЫЙ КЛЮЧ (из шага 1) вместо "ssh-ed25519 ..."
echo "ssh-ed25519 AAAA... nebulide-server" > /home/nebulide/.ssh/authorized_keys
```

- `authorized_keys` — файл со списком публичных ключей, которым разрешён вход
- Сервер сравнивает приватный ключ клиента с публичными ключами в этом файле
- Совпало — вход разрешён. Не совпало — `Permission denied`

```bash
chmod 600 /home/nebulide/.ssh/authorized_keys
chown -R nebulide:nebulide /home/nebulide/.ssh
```

- `chmod 600` — чтение и запись только владельцу. SSH строго проверяет права
- `chown -R nebulide:nebulide` — сделать nebulide владельцем директории и всех файлов внутри (`-R` = рекурсивно). Без этого SSH откажет — файл принадлежит root, а пользователь nebulide

### 3.5. Настройка SSH-демона (часть 1 — смена порта, проверка nebulide)

Сначала меняем порт и включаем ключи, но **оставляем root доступ** на случай проблем.

```bash
# Бэкап оригинального конфига (на случай если что-то сломается)
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak
```

```bash
cat > /etc/ssh/sshd_config.d/hardening.conf << 'EOF'
Port 45191
PermitRootLogin yes
PasswordAuthentication yes
PubkeyAuthentication yes
MaxAuthTries 3
MaxSessions 5
LoginGraceTime 30
AllowUsers nebulide root
X11Forwarding no
PermitEmptyPasswords no
EOF
```

- `Port 45191` — нестандартный порт. Боты сканируют порт 22 — смена порта отсекает 99% автоматических атак
- `PermitRootLogin yes` — **временно** оставляем вход root (для подстраховки)
- `PasswordAuthentication yes` — **временно** оставляем пароли (чтобы root мог войти)
- `PubkeyAuthentication yes` — разрешить аутентификацию по SSH-ключу
- `MaxAuthTries 3` — максимум 3 попытки аутентификации за сессию
- `MaxSessions 5` — максимум 5 одновременных SSH-сессий
- `LoginGraceTime 30` — 30 секунд на аутентификацию
- `AllowUsers nebulide root` — **временно** разрешаем обоих
- `X11Forwarding no` — отключить проброс графики (не нужна на сервере)
- `PermitEmptyPasswords no` — запретить вход с пустым паролем

```bash
# Проверить конфиг на ошибки (не должно быть вывода)
sshd -t

# Включить автозапуск SSH при загрузке сервера (на Ubuntu сервис называется "ssh", не "sshd")
systemctl enable ssh

# Применить новый конфиг
systemctl restart ssh
```

**ВАЖНО:** НЕ закрывай текущую root-сессию! Открой НОВЫЙ терминал и проверь:

```powershell
ssh nebulide
```

Если подключился — отлично, переходи к шагу 3.6.
Если нет — исправляй в текущей (ещё открытой root) сессии. Root всё ещё доступен по `ssh -p 45191 root@45.156.20.105`.

### 3.6. Настройка SSH-демона (часть 2 — отключение root)

**Выполняй этот шаг ТОЛЬКО после успешного `ssh nebulide` из шага 3.5!**

```bash
cat > /etc/ssh/sshd_config.d/hardening.conf << 'EOF'
Port 45191
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthenticationMethods publickey
MaxAuthTries 3
MaxSessions 5
LoginGraceTime 30
AllowUsers nebulide
X11Forwarding no
PermitEmptyPasswords no
EOF
```

Что изменилось:
- `PermitRootLogin yes` → **`no`** — вход root по SSH полностью запрещён
- `PasswordAuthentication yes` → **`no`** — вход по паролю запрещён для всех. Только SSH-ключ
- `AuthenticationMethods publickey` — добавлено: единственный допустимый метод — ключ
- `AllowUsers nebulide root` → **`nebulide`** — root убран из списка

```bash
sshd -t
systemctl restart ssh
```

Проверь ещё раз из нового терминала:
```powershell
ssh nebulide
```

Теперь root по SSH недоступен. Доступ к root — только через `sudo -i` после входа как nebulide.

### 3.7. Firewall (UFW)

UFW (Uncomplicated Firewall) — надстройка над iptables. Блокирует все входящие подключения, кроме разрешённых.

```bash
# Политика по умолчанию: блокировать все входящие, разрешить все исходящие
ufw default deny incoming
ufw default allow outgoing
```

- `deny incoming` — любой входящий трафик заблокирован, если не разрешён правилом ниже
- `allow outgoing` — сервер может обращаться куда угодно (скачивать пакеты, делать API-запросы и т.д.)

```bash
# Открыть порты для нужных сервисов
ufw allow 45191/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
```

- `45191/tcp` — наш SSH-порт
- `80/tcp` — HTTP (нужен для Let's Encrypt и редиректа на HTTPS)
- `443/tcp` — HTTPS (основной трафик Nebulide)
- `comment` — пометка, чтобы потом понимать зачем правило

```bash
# Включить firewall (спросит подтверждение — ввести "y")
ufw enable

# Показать все правила
ufw status verbose
```

### 3.8. Fail2ban (умеренный)

Fail2ban следит за логами и банит IP-адреса, которые слишком часто ошибаются при входе.

```bash
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 30m
findtime = 10m
maxretry = 5
ignoreip = 127.0.0.1/8 ::1

[sshd]
enabled = true
port = 45191
maxretry = 5
bantime = 30m
EOF
```

- `bantime = 30m` — заблокированный IP забанен на 30 минут (не слишком строго — если случайно заблокируешь себя, через 30 минут разбанит)
- `findtime = 10m` — окно наблюдения: считать неудачные попытки за последние 10 минут
- `maxretry = 5` — после 5 неудачных попыток за 10 минут — бан
- `ignoreip` — никогда не банить localhost
- `port = 45191` — следить за нашим SSH-портом

```bash
# Включить fail2ban при загрузке системы и запустить сейчас
systemctl enable fail2ban
systemctl restart fail2ban

# Показать статус: сколько IP забанено, сколько попыток отловлено
fail2ban-client status sshd
```

### 3.9. Автообновления безопасности

Автоматически устанавливает критические патчи безопасности в фоне.
Например, если выходит исправление уязвимости в OpenSSL — оно установится само,
даже если ты не заходил на сервер неделями. Обновляются только security-патчи,
обычные пакеты не трогаются.

```bash
dpkg-reconfigure -plow unattended-upgrades
# Выбери "Yes"
```

### 3.10. Docker

```bash
# Скачать и установить Docker (официальный скрипт)
curl -fsSL https://get.docker.com | sh
```

- `curl -fsSL` — скачать скрипт (тихо, без прогрессбара, следуя редиректам)
- `| sh` — и сразу выполнить. Скрипт определяет ОС и ставит Docker из официального репозитория
- nebulide **не** добавлен в группу `docker` намеренно — любая docker-команда требует `sudo` (= пароль root). CI/CD использует `echo "$ROOT_PASSWORD" | sudo -S docker ...`

```bash
# Включить автозапуск Docker при загрузке сервера
systemctl enable docker
```

### 3.11. Go и Node.js

Нужны для сборки проекта на сервере (Go — бэкенд, Node.js — фронтенд).

```bash
# Go — скачать архив и распаковать в /usr/local
curl -fsSL https://go.dev/dl/go1.24.4.linux-amd64.tar.gz -o /tmp/go.tar.gz
tar -C /usr/local -xzf /tmp/go.tar.gz
```

- `tar -C /usr/local -xzf` — распаковать (`x`) gzip-архив (`z`) из файла (`f`) в директорию (`-C`) /usr/local
- Результат: `/usr/local/go/bin/go`

```bash
# Добавить Go в PATH для всех пользователей
echo 'export PATH=$PATH:/usr/local/go/bin' >> /etc/profile.d/go.sh
source /etc/profile.d/go.sh
```

- `/etc/profile.d/` — скрипты из этой директории выполняются при входе любого пользователя
- `source` — применить прямо сейчас (без перелогина)

```bash
# Node.js 22 LTS — добавить репозиторий и установить
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
```

- Первая команда добавляет официальный репозиторий NodeSource (в стандартном репозитории Ubuntu устаревшая версия)
- Вторая — устанавливает Node.js + npm

### 3.12. Директория проекта

```bash
# Создать директорию для проекта (владелец — root)
mkdir -p /opt/nebulide
```

- `/opt/` — стандартное место для стороннего ПО в Linux
- Владелец — **root** (намеренно). nebulide не может изменять файлы проекта без `sudo`
- CI/CD выполняет все операции через `sudo -S` (git pull, npm ci, go build, docker compose)

```bash
# Склонировать проект (от root)
git clone https://github.com/vvadimkuznetsovv/Nebulide.git /opt/nebulide
```

- `git clone` — скачать репозиторий в указанную директорию

### 3.13. DH-параметры (Diffie-Hellman)

Нужны для усиленного SSL-шифрования. Nginx-конфиг ссылается на этот файл.

```bash
mkdir -p /etc/letsencrypt
openssl dhparam -out /etc/letsencrypt/ssl-dhparams.pem 2048
```

- `openssl dhparam` — генерация параметров Diffie-Hellman для Perfect Forward Secrecy
- `2048` — длина ключа в битах (баланс безопасности и скорости)
- Занимает 1–2 минуты. Генерируется один раз

### 3.14. SSL-сертификаты (Let's Encrypt)

```bash
apt install -y certbot
```

- `certbot` — официальный клиент Let's Encrypt. Получает бесплатные SSL-сертификаты

Получить сертификаты через standalone-режим (порты 80/443 должны быть свободны — nginx ещё не запущен):

```bash
# Nebulide (основной домен)
certbot certonly --standalone -d nebulide.ru --non-interactive --agree-tos -m unforgettableemoji@gmail.com
```

- `certonly` — только получить сертификат, не настраивать nginx
- `--standalone` — certbot сам запускает временный HTTP-сервер для подтверждения владения доменом
- `-d nebulide.ru` — домен (DNS должен указывать на этот сервер!)
- `--non-interactive` — без интерактивных вопросов
- `--agree-tos` — принять условия Let's Encrypt
- `-m` — email для уведомлений об истечении сертификатов

```bash
# EduLearn
certbot certonly --standalone -d edulearn.tech -d www.edulearn.tech --non-interactive --agree-tos -m unforgettableemoji@gmail.com

# SmartRS
certbot certonly --standalone -d smartrs.tech -d www.smartrs.tech --non-interactive --agree-tos -m unforgettableemoji@gmail.com
```

- `-d domain -d www.domain` — один сертификат на два варианта (с www и без)

```bash
# Включить автопродление сертификатов (каждые 60 дней)
systemctl enable certbot.timer
systemctl start certbot.timer
```

- Сертификаты Let's Encrypt живут 90 дней. Таймер проверяет и продлевает их автоматически
- deploy.yml устанавливает renewal hook — при продлении Docker nginx автоматически перечитает новые сертификаты

**ВАЖНО:** Перед запуском certbot убедись, что DNS-записи для всех доменов указывают на IP этого сервера (45.156.20.105). Без этого certbot не сможет подтвердить владение доменом.

### 3.15. Директории для других сайтов

Nginx монтирует эти директории для статических сайтов:

```bash
mkdir -p /var/www/edulearn/dist
mkdir -p /var/www/smartrs/dist
```

- Сюда деплоятся собранные фронтенды edulearn и smartrs
- Если сайты ещё не собраны — создай пустые `index.html`:

```bash
echo '<h1>Coming soon</h1>' > /var/www/edulearn/dist/index.html
echo '<h1>Coming soon</h1>' > /var/www/smartrs/dist/index.html
```

### 3.16. Workspace и SSH-ключи для контейнера

Контейнер Nebulide монтирует workspace и SSH-ключи с хоста:

```bash
# Создать workspace (рабочая директория Claude внутри контейнера)
mkdir -p /home/nebulide/workspace
chown nebulide:nebulide /home/nebulide/workspace

# Создать tmpdir для контейнера
mkdir -p /tmp/nebulide
```

- `/home/nebulide/workspace` — монтируется в контейнер, здесь Claude хранит файлы
- `/tmp/nebulide` — монтируется как `/tmp` в контейнере

SSH-ключи и git config для nebulide **не нужны** — Claude работает как отдельный пользователь через code-server плагин, не от имени nebulide.

Если SSH-ключи уже были сгенерированы — удали:

```bash
rm -f /home/nebulide/.ssh/id_ed25519 /home/nebulide/.ssh/id_ed25519.pub
rm -f /home/nebulide/.gitconfig
```

### 3.17. Файл `.env`

Файл с переменными окружения для приложения:

```bash
nano /opt/nebulide/.env
```

Содержимое:

```
PORT=8080
GIN_MODE=release

DB_HOST=postgres
DB_PORT=5432
DB_USER=nebulide
DB_PASSWORD=СГЕНЕРИРУЙ_ПАРОЛЬ_БД
DB_NAME=nebulide

JWT_SECRET=СГЕНЕРИРУЙ_64_СИМВОЛА
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

CLAUDE_ALLOWED_TOOLS=Read,Edit,Write,Bash,Glob,Grep
CLAUDE_WORKING_DIR=/home/nebulide/workspace

ADMIN_USERNAME=admin
ADMIN_PASSWORD=ПАРОЛЬ_АДМИНА
```

Сгенерировать надёжные значения:

```bash
# Пароль БД (32 символа)
openssl rand -base64 32

# JWT секрет (64 символа)
openssl rand -base64 48
```

- `DB_HOST=postgres` — имя сервиса в docker-compose (не localhost!)
- `GIN_MODE=release` — Go-фреймворк в production-режиме (без debug-логов)
- `ADMIN_USERNAME/PASSWORD` — первый пользователь (создаётся при первом запуске)

### 3.18. Первая сборка и запуск

```bash
# Собрать фронтенд
npm ci --prefix /opt/nebulide/frontend
npm run build --prefix /opt/nebulide/frontend
```

- `npm ci` — установка зависимостей (быстрее и надёжнее чем `npm install` для production)
- `npm run build` — собрать React-приложение → `/opt/nebulide/frontend/dist/`

```bash
# Собрать бэкенд
cd /opt/nebulide/backend && /usr/local/go/bin/go build -o nebulide .
```

- `go build -o nebulide .` — скомпилировать Go-приложение в бинарный файл `nebulide`

```bash
# Собрать Docker-образы
docker compose -f /opt/nebulide/docker-compose.yml build
```

```bash
# Остановить системный nginx (если запущен) — Docker nginx займёт порты 80/443
systemctl stop nginx 2>/dev/null || true
systemctl disable nginx 2>/dev/null || true
```

```bash
# Запустить все контейнеры
docker compose -f /opt/nebulide/docker-compose.yml up -d
```

- `-d` — в фоне (detached mode)
- Запускает: nginx, postgres, app, code-server

```bash
# Проверить статус контейнеров (все должны быть "Up")
docker compose -f /opt/nebulide/docker-compose.yml ps

# Посмотреть логи приложения
docker compose -f /opt/nebulide/docker-compose.yml logs app

# Посмотреть логи nginx
docker compose -f /opt/nebulide/docker-compose.yml logs nginx
```

```bash
# Установить certbot renewal hook (перезагрузка nginx при обновлении сертификатов)
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/reload-docker-nginx.sh << 'HOOK'
#!/bin/bash
docker compose -f /opt/nebulide/docker-compose.yml exec -T nginx nginx -s reload
HOOK
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-docker-nginx.sh
```

---

## Шаг 4: GitHub Secrets (для CI/CD)

GitHub Actions использует эти секреты для автоматического деплоя при push в main.

В репозитории на GitHub: Settings → Secrets and variables → Actions.

| Secret | Значение | Для чего |
|--------|----------|----------|
| `SERVER_HOST` | `45.156.20.105` | IP-адрес сервера |
| `SERVER_PORT` | `45191` | SSH-порт |
| `SERVER_USER` | `nebulide` | Пользователь для SSH-подключения |
| `SSH_PRIVATE_KEY` | содержимое файла `~/.ssh/nebulide` | Приватный ключ целиком (включая BEGIN/END строки) |
| `SSH_PASSPHRASE` | passphrase от ключа | Пароль для расшифровки приватного ключа |
| `ROOT_PASSWORD` | пароль root | Для `sudo` команд в скрипте деплоя |

---

## Проверка

С Windows:

```powershell
ssh nebulide                           # Подключение по ключу
ssh nebulide "sudo ufw status"         # Firewall активен
ssh nebulide "sudo fail2ban-client status"  # Fail2ban работает
ssh nebulide "docker --version"        # Docker установлен
ssh nebulide "go version"              # Go установлен
ssh nebulide "node --version"          # Node.js установлен
```

В браузере:

```
https://nebulide.ru                    # Должна загрузиться страница логина
```

На сервере:

```bash
sudo docker compose -f /opt/nebulide/docker-compose.yml ps     # Все контейнеры "Up"
sudo docker compose -f /opt/nebulide/docker-compose.yml logs app   # Без ошибок
curl -I https://nebulide.ru            # HTTP 200 или 301
```

---

## Порядок действий (кратко)

1. Создать SSH-ключ на Windows (шаг 1)
2. Настроить SSH config (шаг 2)
3. Подключиться к серверу от root
4. Выполнить шаги 3.1–3.5 по порядку
5. Проверить подключение по ключу из НОВОГО терминала (перед закрытием root-сессии!)
6. Отключить root SSH (шаг 3.6)
7. Выполнить шаги 3.7–3.18 (firewall → запуск)
8. Настроить GitHub Secrets (шаг 4)
9. Проверить: открыть https://nebulide.ru
10. Запушить код — CI/CD задеплоит автоматически
