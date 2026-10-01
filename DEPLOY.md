# Деплой центра карьеры ИУБиП (форк `iuubip-career-hub-modern`)

Сайт — один файл `index.html` без зависимостей. Тесты — `npm test` (Node 20+, jsdom).

Выберите один из трёх вариантов. Файлы для каждого уже лежат в репозитории:

| Файл | Для чего |
|---|---|
| `_headers` | Cloudflare Pages / Netlify — заголовки безопасности |
| `deploy/nginx.conf` | VPS (nginx) — заголовки, HTTPS, кэш |
| `.github/workflows/weekly-vacancies.yml` | автоподбор вакансий по понедельникам |
| `.github/workflows/tests.yml` | автотесты на каждый push и pull request |

> ⚠️ **GitHub Pages не отдаёт свои заголовки.** На нём работает только `<meta>` CSP
> из `index.html`. Если нужны HSTS, `X-Frame-Options`, `Permissions-Policy` —
> используйте Cloudflare Pages или VPS.

---

## Вариант A. GitHub Pages (быстро, для демо)

1. Создайте репозиторий (например, `iuubip-career-hub-modern`) и запушьте:

   ```bash
   git remote set-url origin https://github.com/<ваш-логин>/iuubip-career-hub-modern.git
   git push -u origin main
   ```

2. GitHub → **Settings → Pages** → Source: `Deploy from a branch`,
   Branch: `main`, папка `/ (root)` → **Save**.

3. Через 1–2 минуты сайт откроется по адресу
   `https://<ваш-логин>.github.io/iuubip-career-hub-modern/`.

**Ограничения:** нет своих заголовков безопасности, адрес вида `github.io`
(может быть недоступен из некоторых сетей), нет защиты от индексации
сторонними сервисами.

---

## Вариант B. Cloudflare Pages + поддомен `career.iubip.ru` (рекомендуется)

Бесплатно, HTTPS и заголовки из `_headers` «из коробки», быстрый CDN.

1. Запушьте репозиторий в GitHub/GitLab.
2. Cloudflare → **Workers & Pages → Create → Pages → Connect to Git**.
3. Настройки сборки:
   - **Framework preset:** `None`
   - **Build command:** *(оставить пустым)*
   - **Build output directory:** `/`
4. **Save and Deploy** — сайт уже доступен на `*.pages.dev`.
5. Подключение домена: **Custom domains → Set up a custom domain** →
   `career.iubip.ru`.
6. В DNS-зоне `iubip.ru` добавьте запись:

   ```
   Тип:   CNAME
   Имя:   career
   Значение: <имя-проекта>.pages.dev
   Проксирование: включено (оранжевое облако)
   ```

7. Дождитесь статуса **Active** в Custom domains — сертификат Let's Encrypt
   выпустится автоматически.

**Проверка заголовков:**

```bash
curl -sI https://career.iubip.ru/ | findstr /I "content-security x-frame referrer strict-transport"
```

---

## Вариант C. VPS в РФ (для требований 152-ФЗ)

Подходит, если данные студентов и заявки должны физически храниться в России.

1. Сервер: Ubuntu 22.04/24.04, домен `career.iubip.ru` (A-запись → IP сервера).
2. Установка nginx и сертификата:

   ```bash
   sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx git
   sudo mkdir -p /var/www/career-hub
   ```

3. Конфиг сайта (файл уже в репозитории):

   ```bash
   sudo cp deploy/nginx.conf /etc/nginx/sites-available/career.iubip.ru
   sudo ln -s /etc/nginx/sites-available/career.iubip.ru /etc/nginx/sites-enabled/
   sudo rm -f /etc/nginx/sites-enabled/default
   sudo nginx -t && sudo systemctl reload nginx
   ```

4. HTTPS:

   ```bash
   sudo certbot --nginx -d career.iubip.ru
   sudo systemctl status certbot.timer      # автопродление
   ```

5. Первый деплой файлов:

   ```bash
   sudo git clone <адрес-репозитория> /tmp/career-src
   sudo cp /tmp/career-src/index.html /var/www/career-hub/
   sudo chown -R www-data:www-data /var/www/career-hub
   sudo chmod -R 755 /var/www/career-hub
   ```

6. Обновления сайта одной командой (сохраните как `deploy.sh`):

   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   cd /tmp/career-src && git pull --ff-only
   sudo cp index.html /var/www/career-hub/index.html
   sudo chown www-data:www-data /var/www/career-hub/index.html
   sudo nginx -s reload
   echo "OK: $(date)"
   ```

7. Еженедельное обновление вакансий на сервере (если не хотите GitHub Actions):

   ```bash
   sudo crontab -e
   # каждый понедельник в 06:30
   30 6 * * 1 cd /tmp/career-src && /usr/bin/python3 tools/update_vacancies.py && ./deploy.sh >> /var/log/career-hub-update.log 2>&1
   ```

8. Резервные копии (обязательно для 152-ФЗ):

   ```bash
   sudo tar -czf /root/backup-career-$(date +%F).tar.gz /var/www/career-hub
   ```

### Что важно по 152-ФЗ

- Сейчас сайт **не отправляет** персональные данные на сервер: заявка на звонок
  и конструктор резюме работают в браузере (`localStorage`), резюме скачивается
  файлом. Серверная обработка ПД отсутствует — значит нет и обязанностей
  оператора по этим данным.
- Как только появится backend (сохранение заявок, база резюме), потребуется:
  сервер на территории РФ, согласие на обработку ПД, политика
  конфиденциальности, уведомление в Роскомнадзор, журналирование доступа.
- Пока ПД не уходят на сервер, на странице достаточно пометки
  «Нажимая кнопку, вы соглашаетесь на обработку персональных данных».

---

## Проверка после любого деплоя

1. **Заголовки** (кроме GitHub Pages):

   ```bash
   curl -sI https://career.iubip.ru/ | findstr /I "content-security x-frame x-content referrer strict-transport permissions"
   ```

2. **Консоль браузера** — не должно быть ошибок CSP и 404.
3. **Мобильная вёрстка** — DevTools → iPhone SE (375×667) и 390×844:
   - нижняя панель из 5 кнопок видна, контент не перекрывается;
   - шторка «Ещё» открывается, раздел переключается;
   - «Фильтры и направления» открывают шторку, выбор направления её закрывает.
4. **Тап-таргеты** — не меньше 44 px, поля ввода не вызывают зум на iOS.
5. **Автотесты локально:**

   ```bash
   npm install
   npm test
   ```

   Ожидаемый результат: `pass 51`, `fail 0`.
6. **Живая подборка** — вкладка «Вакансии» → «Загрузить с hh.ru» должна
   показать 6 карточек (нужен доступ к `api.hh.ru`; в CSP он разрешён).
7. **Еженедельное обновление** — Actions → *Weekly vacancies refresh* →
   *Run workflow* → в `index.html` меняются дата и список вакансий.

## Откат

```bash
# GitHub/Cloudflare
git revert <коммит> && git push

# VPS
sudo cp /root/backup-career-<дата>.tar.gz /tmp/ && sudo tar -xzf /tmp/backup-career-<дата>.tar.gz -C /
sudo nginx -s reload
```

