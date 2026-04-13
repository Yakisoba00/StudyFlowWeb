// ==========================================================================
// 💾 СЕРВИС СОХРАНЕНИЯ РАСПИСАНИЯ В БД (scheduleService.js)
// ==========================================================================

const pool = require("../../server/db");

/**
 * Сохраняет данные расписания конкретной группы в БД
 * @param {Object} data - Объект от API ВУЗа
 * @param {string} groupName - Название группы (например, "ЦИС-37")
 */
async function saveToDB(data, groupName) {
  if (!groupName) {
    console.error("❌ Ошибка: groupName не передан в saveToDB");
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN'); // Начинаем транзакцию

    // 1. Очищаем старые данные только для этой группы
    await client.query('DELETE FROM schedule WHERE group_name = $1', [groupName]);

    // Настройки текущего семестра (2026 год)
    const now = new Date();
    const currentYear = now.getFullYear();
    // Весна: с 1 февраля по 31 августа
    const semStart = new Date(currentYear, 1, 1);
    const semEnd = new Date(currentYear, 7, 31);

    const items = data.items || [];

    for (const item of items) {
      if (!item.days) continue;

      for (const day of item.days) {
        if (!day.lessons) continue;

        for (const lesson of day.lessons) {
          const startAt = new Date(lesson.startAt);
          const endAt = new Date(lesson.endAt);

          // Фильтр семестра
          if (startAt < semStart || startAt > semEnd) continue;

          const dayDate = startAt.toISOString().split('T')[0];
          const weekNumber = day.info.weekNumber;

          // Вставляем занятие
          await client.query(`
            INSERT INTO schedule (
              week_number, day_date, day_type, lesson_number, training_id,
              lesson_name, start_at, end_at, time_range, original_time_title,
              parity, lesson_type, is_stream, duration_pairs, duration_minutes,
              is_division, teacher_name, teacher_id, auditory_name, is_distant,
              is_short, is_lecture, sub_info, group_name
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
          `, [
            weekNumber,
            dayDate,
            day.info.type,
            lesson.number,
            lesson.trainingId || null,
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
            lesson.subInfo ?? null,
            groupName
          ]);
        }
      }
    }

    // 2. Исправленное обновление метаданных
    // Используем group_name вместо статического id, чтобы избежать ошибки NOT NULL
    await client.query(`
      INSERT INTO schedule_metadata (group_name, last_updated)
      VALUES ($1, NOW())
      ON CONFLICT (group_name)
      DO UPDATE SET last_updated = EXCLUDED.last_updated
    `, [groupName]);

    await client.query('COMMIT');
    console.log(`✅ [${new Date().toLocaleTimeString()}] Расписание для группы ${groupName} успешно синхронизировано.`);

  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error(`❌ Ошибка при сохранении в БД (${groupName}):`, err);
    throw err; // Пробрасываем ошибку дальше для обработки в контроллере
  } finally {
    client.release();
  }
}

module.exports = { saveToDB };