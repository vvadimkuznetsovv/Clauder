# Деплой Clauder на neon-server

## Сервер

- IP: `155.212.186.174`
- SSH: `ssh neon-server`
- Домен: `clauder.smartrs.tech`
- ОС: Ubuntu

---

## Все команды по порядку

### 1. Обновление системы

```bash
apt update && apt upgrade -y
```

### 2. Установка Docker

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
docker --version
docker compose version
```

### 3. Структура директорий

```bash
mkdir -p /opt/clauder
mkdir -p /home/clauder/workspace/projects
mkdir -p /tmp/clauder
mkdir -p /home/clauder/.ssh
```

### 4. Git для Claude

```bash
cat > /home/clauder/.gitconfig << 'EOF'
[user]
    name = Clauder
    email = clauder@smartrs.tech
[init]
    defaultBranch = main
[safe]
    directory = *
EOF

# SSH ключ для GitHub
ssh-keygen -t ed25519 -C "clauder@smartrs.tech" -f /home/clauder/.ssh/id_ed25519 -N ""
cat /home/clauder/.ssh/id_ed25519.pub
# ^^^ Добавить в GitHub → Settings → SSH keys

ssh-keyscan github.com >> /home/clauder/.ssh/known_hosts 2>/dev/null
```

### 5. Создание .env

```bash
DB_PASS=$(openssl rand -base64 32)
JWT_SEC=$(openssl rand -base64 48)
echo "DB Password: $DB_PASS"
echo "JWT Secret:  $JWT_SEC"

cat > /opt/clauder/.env << EOF
# Server
PORT=8080
GIN_MODE=release

# Database
DB_HOST=postgres
DB_PORT=5432
DB_USER=clauder
DB_PASSWORD=$DB_PASS
DB_NAME=clauder

# JWT
JWT_SECRET=$JWT_SEC
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=168h

# Claude Code
CLAUDE_ALLOWED_TOOLS=Read,Edit,Write,Bash,Glob,Grep
CLAUDE_WORKING_DIR=/home/clauder/workspace
ANTHROPIC_API_KEY=sk-ant-ВСТАВИТЬ_КЛЮЧ

# Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=ВСТАВИТЬ_ПАРОЛЬ
EOF

chmod 600 /opt/clauder/.env
```

Отредактировать вручную:
```bash
nano /opt/clauder/.env
# Вставить ANTHROPIC_API_KEY и ADMIN_PASSWORD
```

### 6. Nginx (clauder.smartrs.tech)

```bash
cat > /etc/nginx/sites-available/clauder << 'EOF'
server {
    listen 80;
    server_name clauder.smartrs.tech;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        client_max_body_size 50M;
    }
}
EOF

ln -sf /etc/nginx/sites-available/clauder /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 7. SSL

```bash
certbot --nginx -d clauder.smartrs.tech --non-interactive --agree-tos -m admin@smartrs.tech
```

### 8. Файрвол

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status
```

### 9. Fail2ban

```bash
apt install -y fail2ban

cat > /etc/fail2ban/jail.local << 'EOF'
[sshd]
enabled = true
port = 22
maxretry = 5
bantime = 3600
findtime = 600
EOF

systemctl enable fail2ban
systemctl restart fail2ban
```

### 10. GitHub Actions Secrets

В GitHub → Settings → Secrets → Actions:

| Secret | Значение |
|--------|----------|
| `SERVER_HOST` | `155.212.186.174` |
| `SERVER_USER` | `root` |
| `SERVER_SSH_KEY` | Приватный SSH ключ neon-server |

### 11. DNS

Добавить A-запись:
```
clauder.smartrs.tech → 155.212.186.174
```

---

## Первый деплой (ручной)

### На локальной машине:
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
docker compose up -d
rm clauder.tar.gz
```

---

## Проверка

```bash
docker compose -f /opt/clauder/docker-compose.yml ps
docker compose -f /opt/clauder/docker-compose.yml logs -f app
curl http://localhost:8080/api/health
docker compose -f /opt/clauder/docker-compose.yml exec app claude --version
docker compose -f /opt/clauder/docker-compose.yml exec app ls -la /home/clauder/workspace
docker compose -f /opt/clauder/docker-compose.yml exec app git --version
curl -I https://clauder.smartrs.tech
```

---

## Архитектура

```
Internet → clauder.smartrs.tech
         → Nginx (SSL, порт 443)
         → 127.0.0.1:8080 (Docker: app)
         → PostgreSQL (внутри Docker network)

/opt/clauder/
├── .env                     # Секреты (chmod 600)
└── docker-compose.yml

/home/clauder/
├── workspace/               # bind mount → контейнер
│   └── projects/
├── .gitconfig               # ro mount → /root/.gitconfig
└── .ssh/                    # ro mount → /root/.ssh
    ├── id_ed25519
    ├── id_ed25519.pub
    └── known_hosts

/tmp/clauder/                # mount → /tmp в контейнере

Docker volumes:
├── postgres_data            # данные PostgreSQL
└── usr_local                # npm globals, pip packages — переживают рестарт

Персистентность пакетов:
- npm install -g ... → сохраняется в volume usr_local
- apk add ...       → записать в /home/clauder/workspace/.packages
                       (автоустановка при рестарте через entrypoint.sh)
```

## Установка пакетов Claude (персистентно)

Claude через терминал может устанавливать пакеты. Чтобы они пережили рестарт:

**npm globals** — сохраняются автоматически (volume `usr_local`):
```bash
npm install -g typescript    # сохранится
```

**apk пакеты** — добавить в файл `.packages`:
```bash
apk add postgresql-client python3
echo -e "postgresql-client\npython3" >> /home/clauder/workspace/.packages
# При следующем рестарте контейнера пакеты установятся автоматически
```
