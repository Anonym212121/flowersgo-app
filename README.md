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

## 🔄 CI/CD та Віддзеркалення (Mirroring)

У проєкті реалізовано автоматизований Pipeline, що зв'язує університетський GitLab та GitHub для деплою:

1. **GitLab (git.ztu.edu.ua):** Основне місце розробки та зберігання коду
2. **GitHub Mirroring:** Налаштовано автоматичне віддзеркалення коду через SSH-Key. Кожний `push` у GitLab автоматично оновлює репозиторій на GitHub.
3. **Render Auto-Deploy:** Render відстежує зміни в GitHub-репозиторії та автоматично оновлює робову версію сайту.

##Швидкий запуск локально

1. Створіть файл `.env` у папці `backend/` із параметрами підключення до бази даних.
2. Запустіть систему через Docker Compose:

```bash
docker compose up --build -d