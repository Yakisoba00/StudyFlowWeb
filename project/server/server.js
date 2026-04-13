// ==========================================================================
// 🚀 ОСНОВНОЙ СЕРВЕР ПРИЛОЖЕНИЯ (server.js)
// ==========================================================================

const path = require("path");
const express = require("express");
const pool = require("./db"); // Подключение к PostgreSQL
const bcrypt = require("bcryptjs");

// Импортируем функции расписания и планировщик
const { fetchAndSaveScheduleByGroup, startScheduler } = require("../view/schedule/scheduler");

const app = express();
const PORT = 3000;

// Переменная для предотвращения одновременного парсинга одной и той же группы
const activeSyncs = new Set();

// --------------------------------------------------------------------------
// 🛠️ МИДДЛВЕРЫ
// --------------------------------------------------------------------------

app.use(express.json());
app.use(express.static(path.join(__dirname, "../view")));

// --------------------------------------------------------------------------
// 🏠 МАРШРУТЫ (ROUTES)
// --------------------------------------------------------------------------

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../view", "mobile.html"));
});

// --------------------------------------------------------------------------
// 📊 API АВТОРИЗАЦИИ
// --------------------------------------------------------------------------

app.post("/api/auth/register", async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const result = await pool.query(
            `INSERT INTO public.users (name, login, email, password, avatar)
             VALUES ($1, $1, $2, $3, $4)
             RETURNING id, name, login, email, "group", avatar`,
            [username, email, hash, 'https://i.pravatar.cc/150?u=' + username]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("Ошибка регистрации:", err.message);
        res.status(400).json({ error: "Логин или Email уже заняты" });
    }
});

app.post("/api/auth/login", async (req, res) => {
    const { login, password } = req.body;
    try {
        const result = await pool.query("SELECT * FROM public.users WHERE login = $1 OR email = $1", [login]);
        if (result.rows.length === 0) return res.status(401).json({ error: "Пользователь не найден" });

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: "Неверный пароль" });

        res.json({
            id: user.id,
            username: user.name,
            login: user.login,
            email: user.email,
            group: user.group,
            avatar: user.avatar
        });
    } catch (err) {
        res.status(500).json({ error: "Ошибка сервера" });
    }
});

// --------------------------------------------------------------------------
// 📅 API РАСПИСАНИЯ И СИНХРОНИЗАЦИИ
// --------------------------------------------------------------------------

/**
 * Ручное обновление расписания с защитой от спама
 */
app.post("/api/schedule/sync", async (req, res) => {
    const { group } = req.body;
    if (!group) return res.status(400).json({ error: "Группа не указана" });

    // 1. Проверка на активный процесс (Locking)
    if (activeSyncs.has(group)) {
        return res.status(429).json({ error: "Расписание этой группы уже обновляется. Подождите..." });
    }

    try {
        // 2. Проверка кулдауна (15 минут) из БД
        const meta = await pool.query(
            "SELECT last_updated FROM schedule_metadata WHERE group_name = $1",
            [group]
        );

        if (meta.rows.length > 0) {
            const lastUpdate = new Date(meta.rows[0].last_updated);
            const diffMin = (new Date() - lastUpdate) / 1000 / 60;

            if (diffMin < 15) {
                const waitMin = Math.ceil(15 - diffMin);
                return res.status(429).json({
                    error: `Слишком часто! Обновить можно будет через ${waitMin} мин.`
                });
            }
        }

        // 3. Запуск синхронизации
        activeSyncs.add(group);
        console.log(`🔄 Ручной запуск обновления для группы: ${group}`);

        await fetchAndSaveScheduleByGroup(group);

        res.json({ message: "Расписание успешно обновлено!" });

    } catch (err) {
        console.error("❌ Ошибка при ручной синхронизации:", err.message);
        res.status(500).json({ error: "Не удалось обновить расписание" });
    } finally {
        activeSyncs.delete(group);
    }
});

app.get("/api/schedule", async (req, res) => {
    try {
        const group = req.query.group;
        if (!group) return res.status(400).json({ error: "Группа обязательна" });

        const scheduleResult = await pool.query(
            "SELECT * FROM schedule WHERE group_name = $1 ORDER BY day_date ASC, start_at ASC",
            [group]
        );

        const metaResult = await pool.query(
            "SELECT last_updated FROM schedule_metadata WHERE group_name = $1",
            [group]
        );

        res.json({
            items: scheduleResult.rows,
            lastUpdated: metaResult.rows[0]?.last_updated || null
        });
    } catch (err) {
        res.status(500).json({ error: "Ошибка получения расписания" });
    }
});

// --------------------------------------------------------------------------
// 📝 API ДЕДЛАЙНОВ
// --------------------------------------------------------------------------

app.get("/api/deadlines", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, subject, name as title, description,
            to_char(date_deadline, 'YYYY-MM-DD') as date,
            time_deadline as time FROM deadlines ORDER BY date_deadline ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/deadlines", async (req, res) => {
    const { subject, title, description, date, time } = req.body;
    try {
        await pool.query(
            "INSERT INTO deadlines (subject, name, description, date_deadline, time_deadline) VALUES ($1, $2, $3, $4, $5)",
            [subject, title, description, date, time]
        );
        res.sendStatus(201);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --------------------------------------------------------------------------
// 👤 API ПОЛЬЗОВАТЕЛЯ
// --------------------------------------------------------------------------

app.put("/api/user/:id/group", async (req, res) => {
    const { group } = req.body;
    try {
        await pool.query('UPDATE public.users SET "group" = $1 WHERE id = $2', [group, req.params.id]);
        res.sendStatus(200);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --------------------------------------------------------------------------
// 🏁 ЗАПУСК СЕРВЕРА
// --------------------------------------------------------------------------

app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`🚀 Сервер StudyFlow запущен!`);
    console.log(`🔗 Адрес: http://localhost:${PORT}`);
    console.log(`=================================================`);

    // ЗАПУСК ПЛАНИРОВЩИКА (Ночная смена в 4 утра)
    try {
        startScheduler();
    } catch (e) {
        console.error("❌ Не удалось запустить планировщик:", e.message);
    }

    console.log(`🕒 Ожидание запросов и плановых задач...`);
});