// ==========================================================================
// 🕒 ПЛАНИРОВЩИК И СЕРВИС ОБНОВЛЕНИЯ РАСПИСАНИЯ (scheduler.js)
// ==========================================================================

const { saveToDB } = require("./scheduleService");
const pool = require("../../server/db");
const cron = require("node-cron"); // Не забудь: npm install node-cron

/**
 * Функция для получения и сохранения расписания КОНКРЕТНОЙ группы
 * Используется:
 * 1. Планировщиком (ночью)
 * 2. Сервером (ручное обновление по кнопке)
 */
async function fetchAndSaveScheduleByGroup(groupName) {
    if (!groupName) return;

    const API_URL = `https://gg-api.ystuty.ru/s/schedule/v1/schedule/group/${encodeURIComponent(groupName)}`;

    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`API ВУЗа недоступно для группы ${groupName}`);

        const data = await response.json();

        // 1. Сохраняем уроки в БД
        await saveToDB(data, groupName);

        // 2. Обновляем метаданные (время последней синхронизации)
        await pool.query(
            `INSERT INTO schedule_metadata (group_name, last_updated)
             VALUES ($1, CURRENT_TIMESTAMP)
             ON CONFLICT (group_name) DO UPDATE SET last_updated = CURRENT_TIMESTAMP`,
            [groupName]
        );

        console.log(`✅ [${new Date().toLocaleTimeString()}] Расписание успешно синхронизировано: ${groupName}`);
        return data;
    } catch (error) {
        console.error(`❌ ОШИБКА СИНХРОНИЗАЦИИ (${groupName}):`, error.message);
        throw error;
    }
}

/**
 * Основная функция планировщика: обновляет расписания всех активных групп
 */
async function updateAllSchedules() {
    console.log("🔄 [CRON] Запуск планового обновления всех расписаний...");
    try {
        // 1. Получаем список всех уникальных групп, которые выбрали пользователи
        const result = await pool.query('SELECT DISTINCT "group" FROM public.users WHERE "group" IS NOT NULL');
        const groups = result.rows.map(row => row.group);

        if (groups.length === 0) {
            console.log("ℹ️ В базе пока нет пользователей с выбранными группами. Пропускаем.");
            return;
        }

        // 2. Проходимся по каждой группе по очереди (не всё сразу!)
        for (const groupName of groups) {
            try {
                await fetchAndSaveScheduleByGroup(groupName);
                // Пауза 2 секунды между группами, чтобы не злить API ВУЗа
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (e) {
                console.error(`⚠️ Пропуск группы ${groupName} из-за ошибки.`);
            }
        }

        console.log("🏁 [CRON] Плановое обновление завершено успешно.");
    } catch (error) {
        console.error("❌ КРИТИЧЕСКАЯ ОШИБКА ПЛАНИРОВЩИКА:", error.message);
    }
}

/**
 * Инициализация планировщика
 */
function startScheduler() {
    // Больше не запускаем обновление СРАЗУ.
    // Только ставим задачу в Cron.

    // Формат: 'минуты часы день месяц день_недели'
    // '0 4 * * *' — каждый день в 04:00 утра
    cron.schedule('0 4 * * *', () => {
        updateAllSchedules();
    }, {
        scheduled: true,
        timezone: "Europe/Moscow" // Установи свой часовой пояс
    });

    console.log("📅 Планировщик настроен: ежедневное обновление в 04:00.");
}

// Экспортируем функции
module.exports = {
    startScheduler,
    fetchAndSaveScheduleByGroup
};