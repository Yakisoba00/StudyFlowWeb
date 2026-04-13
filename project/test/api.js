const { Pool } = require('pg');
const fs = require("fs");
const express = require("express");

// --------------------
// Настройки подключения к PostgreSQL
// --------------------
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: '123',
  database: 'StudyFlow'
});

const app = express();
const PORT = 3000;

// --------------------
// Константы
// --------------------
const GROUP = "ЦИС-37";
const API_URL = `https://gg-api.ystuty.ru/s/schedule/v1/schedule/group/${GROUP}`;
const FILE = "schedule.json";

// --------------------
// Функция сохранения данных в таблицу schedule
// --------------------
async function saveToDB(data) {
  const client = await pool.connect();

  try {
    for (const item of data.items) {
      for (const day of item.days) {

        // 📅 Дата дня
        const dayDate = new Date(day.info.date);

        // 📊 Номер недели
        const weekNumber = day.info.weekNumber;

        // 📌 Тип дня (0-5)
        const dayType = day.info.type;

        for (const lesson of day.lessons) {

          // ⚠️ ВАЖНО: в JSON поле называется trainingId!
          const trainingId = lesson.trainingId || null;

          // ⏰ Преобразуем в timestamp
          const startAt = new Date(lesson.startAt);
          const endAt = new Date(lesson.endAt);

          await client.query(`
            INSERT INTO schedule (
              week_number,
              day_date,
              day_type,
              lesson_number,
              training_id,
              lesson_name,
              start_at,
              end_at,
              time_range,
              original_time_title,
              parity,
              lesson_type,
              is_stream,
              duration_pairs,
              duration_minutes,
              is_division,
              teacher_name,
              teacher_id,
              auditory_name,
              is_distant,
              is_short,
              is_lecture,
              sub_info
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
              $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
            )
            ON CONFLICT DO NOTHING
          `, [
            weekNumber,

            // 📅 Только дата
            dayDate.toISOString().split('T')[0],

            dayType,
            lesson.number,

            trainingId,

            // может быть null!
            lesson.lessonName || null,

            startAt,
            endAt,

            lesson.timeRange || null,
            lesson.originalTimeTitle || null,

            lesson.parity ?? null,
            lesson.type ?? null,

            lesson.isStream ?? false,

            lesson.duration ?? 1,
            lesson.durationMinutes ?? null,

            lesson.isDivision ?? false,

            lesson.teacherName ?? null,
            lesson.teacherId ?? null,

            lesson.auditoryName ?? null,

            lesson.isDistant ?? false,
            lesson.isShort ?? false,
            lesson.isLecture ?? false,

            lesson.subInfo ?? null
          ]);
        }
      }
    }

    console.log("Данные успешно сохранены в БД");

  } catch (err) {
    console.error("Ошибка при записи в БД:", err);

  } finally {
    client.release();
  }
}

// --------------------
// Функция обновления расписания
// --------------------
async function updateSchedule() {
  try {
    // Получаем данные с API
    const response = await fetch(API_URL);
    const data = await response.json();

    // Сохраняем локально JSON для API
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));

    // Сохраняем данные в БД
    await saveToDB(data);

    console.log("Расписание обновлено:", new Date().toLocaleTimeString());
  } catch (error) {
    console.error("Ошибка обновления расписания:", error);
  }
}

// --------------------
// Запуск обновления каждые 10 минут
// --------------------
setInterval(updateSchedule, 600000);

// Сразу при старте
updateSchedule();

// --------------------
// Endpoint для получения расписания через API
// --------------------
app.get("/schedule", (req, res) => {
  const data = fs.readFileSync(FILE);
  res.json(JSON.parse(data));
});

app.listen(PORT, () => {
  console.log("Server started on port " + PORT);
});