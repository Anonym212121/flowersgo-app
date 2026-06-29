# 🌸 FlowersGo

**FlowersGo** — дипломний проєкт, що являє собою онлайн інтернет-магазин для замовлення квітів. Система побудована за архітектурою модульного моноліту з використанням сучасних хмарних технологій для забезпечення стабільної роботи та автоматизованого розгортання.

## 🛠 Технологічний стек

* **Backend:** Node.js 20, Express.js
* **Frontend:** EJS (Server-side rendering)
* **Database:** MySQL 8.0 (Хмарне рішення на **Aiven**)
* **Containerization:** Docker / Docker Compose
* **Deployment:** Render.com (API), Aiven (Cloud Database)

## 🏗 Архітектура проєкту

Проєкт організований за принципами Clean Architecture з чітким розподілом обов'язків:

* `backend/src/routes` — Маршрутизація API та сторінок.
* `backend/src/controllers` — Обробка логіки запитів та формування відповідей.
* `backend/src/services` — Рівень бізнес-логіки застосунку.
* `backend/src/models` — Взаємодія з MySQL через SQL-запити.
* `backend/src/config` — Налаштування інфраструктури (підключення до БД через змінні оточення).
* `backend/views` — Інтерфейс користувача на базі EJS-шаблонів.

## 🚀 Розгортання (Deployment)

Проєкт розгорнуто у хмарному середовищі для публічного доступу:
* **Backend API:** [https://flowersgo-app.onrender.com](https://flowersgo-app.onrender.com)
* **Database:** Керований екземпляр MySQL на платформі Aiven.

## 🔄 CI/CD та віддзеркалення

Ланцюжок розробки та розгортання:

```
локально → develop → GitLab (git.ztu.edu.ua) → GitLab CI
                ↓
         Merge Request → main (захищена гілка на ЗТУ)
                ↓
         push GitHub main → Render (auto-deploy) + mirror → GitLab
```

### GitLab CI (`.gitlab-ci.yml`)

При `push` на GitLab запускається pipeline:

1. **build** — `npm install` у `backend/`
2. **test** — `npm test`
3. **docker** — `docker build` для перевірки образу

Це перевірка якості коду (CI), без деплою на production.

### Деплой на Render (CD)

Render підключений до **GitHub**, гілка **`main`**. Після `git push github main` сервіс автоматично збирає та перезапускає застосунок (`npm install`, `npm start`, root directory: `backend`).

База даних — окремо на **Aiven**; підключення через змінні оточення на Render (`DB_HOST`, `DB_NAME`, `DB_SSL=1`).

### Mirror GitHub → GitLab (`.github/workflows/mirror.yml`)

Після `push` у GitHub (`main` або `docker`) GitHub Actions намагається віддзеркалити коміт на GitLab ЗТУ.

Гілка `main` на GitLab захищена (лише через Merge Request), тому синхронізація офіційного `main` на ЗТУ — через **MR `develop` → `main`**. Mirror доповнює зв’язок репозиторіїв, але не замінює MR.

### Remotes

| Remote   | Призначення                          |
|----------|--------------------------------------|
| `origin` | GitLab ЗТУ (розробка, CI, захист)  |
| `github` | GitHub (тригер деплою на Render)     |

## 🐳 Швидкий запуск локально

1. Створіть файл `.env` у папці `backend/` із параметрами підключення до бази даних.
2. Запустіть систему через Docker Compose:

```bash
docker compose up --build -d