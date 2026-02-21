# Серверная документация Clauder

## Файлы

| Документ | Описание |
|----------|----------|
| [deploy.md](deploy.md) | Пошаговая инструкция деплоя — все команды по порядку |
| [architecture.md](architecture.md) | Архитектура: схема работы, контейнеры, компоненты |
| [volumes.md](volumes.md) | Volumes, персистентность данных, `apk-persist` |
| [security.md](security.md) | Безопасность: UFW, SSL, fail2ban, sandbox, секреты |
| [cicd.md](cicd.md) | CI/CD: GitHub Actions, ручной деплой, откат |

## Быстрый старт

1. Прочитать [deploy.md](deploy.md) — там все команды
2. Выполнить шаги 1-11 на сервере (`ssh neon-server`)
3. Push в main → автодеплой через GitHub Actions

## Сервер

- IP: `155.212.186.174`
- SSH: `ssh neon-server`
- Домен: `clauder.smartrs.tech`
- ОС: Ubuntu
