 node server.js - запуск сервера (сайта)

 Структура проекта:
project/
├── server/
│   ├── db.js
│   └── server.js
├── view/
│   ├── auth/
│   │   ├── auth.html
│   │   ├── auth.js
│   │   └── auth.css
│   ├── profile/
│   │   ├── profile.html
│   │   ├── profile.js
│   │   └── profile.css
│   ├── schedule/
│   │   ├── scheduler.js
│   │   └── scheduleService.js
│   ├── module.html
│   ├── script.js
│   └── style.css
│   ├── js/
│   │   ├── calendar.js
│   │   ├── deadlines.js
│   │   ├── main.js
│   │   ├── schedule.js
│   │   └── utils.js


Сюда писать комментарии

1. Раскидал файлы по папкам
2. Теперь всё сохраняется и берётся из бд (Дедлайны, профиль (авторизация), расписание)

