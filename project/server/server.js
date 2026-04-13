// ==========================================================================
// 🚀 ОСНОВНОЙ СЕРВЕР ПРИЛОЖЕНИЯ (server.js)
// ==========================================================================

const path = require("path");
const express = require("express");
const pool = require("./db"); // Подключение к PostgreSQL
const bcrypt = require("bcryptjs");
const session = require('express-session');
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
app.use(session({
    secret: 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // для разработки на http
}));

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

// ЕДИНЫЙ ЭНДПОИНТ ВХОДА (с сохранением группы)
app.post("/api/auth/login", async (req, res) => {
    const { login, email, password } = req.body;
    const identifier = login || email;
    if (!identifier || !password) {
        return res.status(400).json({ error: "Логин/email и пароль обязательны" });
    }

    try {
        const result = await pool.query(
            `SELECT id, name, login, email, password, "group", avatar 
             FROM public.users 
             WHERE login = $1 OR email = $1`,
            [identifier]
        );
        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Пользователь не найден" });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Неверный пароль" });
        }

        // Регенерируем сессию, чтобы сбросить предыдущие данные
        req.session.regenerate((err) => {
            if (err) {
                console.error('Ошибка регенерации сессии:', err);
                return res.status(500).json({ error: "Ошибка сервера" });
            }

            // Сохраняем userId и group в новой сессии
            req.session.userId = user.id;
            req.session.group = user.group;

            // Логирование для отладки
            console.log(`Пользователь ${user.login} (ID: ${user.id}) вошёл, сессия: ${req.session.id}`);

            res.json({
                userId: user.id,
                name: user.name,
                login: user.login,
                email: user.email,
                group: user.group,
                avatar: user.avatar
            });
        });
    } catch (err) {
        console.error("Ошибка входа:", err);
        res.status(500).json({ error: "Ошибка сервера" });
    }
});

// Получение профиля текущего пользователя (с группой и остальным)
app.get('/api/auth/me', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
        const result = await pool.query(
            `SELECT id, name, login, email, "group", avatar 
             FROM users 
             WHERE id = $1`,
            [req.session.userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('/api/auth/me error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Выход
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Ошибка при выходе:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
        }
        res.clearCookie('connect.sid'); // стандартное имя куки для express-session
        res.json({ success: true });
    });
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

    if (activeSyncs.has(group)) {
        return res.status(429).json({ error: "Расписание этой группы уже обновляется. Подождите..." });
    }

    try {
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
// 📝 API ДЕДЛАЙНОВ (личные, с полями subject, date, time, description)
// --------------------------------------------------------------------------

app.get('/api/deadlines', async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const result = await pool.query(`
            SELECT d.id, d.subject, d.title, to_char(d.date, 'YYYY-MM-DD') as date, d.time, d.description, d.tag,
                   ud.completed
            FROM deadlines d
            JOIN user_deadlines ud ON d.id = ud.deadline_id
            WHERE ud.user_id = $1
            ORDER BY d.date ASC, d.time ASC
        `, [userId]);

        res.json(result.rows);
    } catch (err) {
        console.error('GET /api/deadlines error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/deadlines', async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { subject, title, date, time, description, tag } = req.body;
    if (!title || !date) {
        return res.status(400).json({ error: 'Title and date are required' });
    }

    try {
        const deadlineRes = await pool.query(`
            INSERT INTO deadlines (subject, title, date, time, description, tag)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `, [subject || '', title, date, time || '', description || '', tag || null]);

        const deadlineId = deadlineRes.rows[0].id;

        await pool.query(`
            INSERT INTO user_deadlines (user_id, deadline_id, completed)
            VALUES ($1, $2, false)
        `, [userId, deadlineId]);

        res.status(201).json({
            id: deadlineId,
            subject: subject || '',
            title,
            date,
            time: time || '',
            description: description || '',
            tag,
            completed: false
        });
    } catch (err) {
        console.error('POST /api/deadlines error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/deadlines/:id', async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const deadlineId = req.params.id;
    const { subject, title, date, time, description, tag } = req.body;

    try {
        const checkRes = await pool.query(`
            SELECT 1 FROM user_deadlines
            WHERE user_id = $1 AND deadline_id = $2
        `, [userId, deadlineId]);

        if (checkRes.rowCount === 0) {
            return res.status(404).json({ error: 'Deadline not found or not owned' });
        }

        await pool.query(`
            UPDATE deadlines
            SET subject = $1, title = $2, date = $3, time = $4, description = $5, tag = $6
            WHERE id = $7
        `, [subject || '', title, date, time || '', description || '', tag || null, deadlineId]);

        res.json({ success: true });
    } catch (err) {
        console.error('PUT /api/deadlines/:id error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/deadlines/:id/complete', async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const deadlineId = req.params.id;
    const { completed } = req.body;

    if (typeof completed !== 'boolean') {
        return res.status(400).json({ error: 'completed must be boolean' });
    }

    try {
        const result = await pool.query(`
            UPDATE user_deadlines
            SET completed = $1
            WHERE user_id = $2 AND deadline_id = $3
        `, [completed, userId, deadlineId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Deadline not found or not owned' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('PUT /api/deadlines/:id/complete error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/deadlines/:id', async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const deadlineId = req.params.id;

    try {
        await pool.query(`
            DELETE FROM user_deadlines
            WHERE user_id = $1 AND deadline_id = $2
        `, [userId, deadlineId]);

        const countRes = await pool.query(`
            SELECT COUNT(*) FROM user_deadlines WHERE deadline_id = $1
        `, [deadlineId]);

        if (parseInt(countRes.rows[0].count) === 0) {
            await pool.query(`DELETE FROM deadlines WHERE id = $1`, [deadlineId]);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/deadlines/:id error:', err);
        res.status(500).json({ error: 'Server error' });
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

    try {
        startScheduler();
    } catch (e) {
        console.error("❌ Не удалось запустить планировщик:", e.message);
    }

    console.log(`🕒 Ожидание запросов и плановых задач...`);
});