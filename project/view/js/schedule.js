import { getMondayBasedDay, getStartOfWeek, getEndOfWeek, formatDateRange, escapeHtml, mapLessonType } from './utils.js';

let scheduleData = [];
let weeks = [];
let currentWeekIndex = 0;
let countdownInterval = null; // Для хранения интервала таймера

/**
 * Вспомогательная функция форматирования даты обновления
 */
function formatUpdateDate(dateString) {
    if (!dateString) return "Дата обновления неизвестна";
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * ФУНКЦИЯ ТАЙМЕРА ДЛЯ КНОПКИ
 * Блокирует кнопку и запускает обратный отсчет
 */
function startButtonTimer(minutes) {
    const btnText = document.getElementById('sync-btn-text');
    const syncBtn = document.getElementById('sync-schedule-btn');

    if (!btnText || !syncBtn) return;
    if (countdownInterval) clearInterval(countdownInterval);

    let seconds = minutes * 60;
    syncBtn.disabled = true;

    countdownInterval = setInterval(() => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        btnText.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;

        if (seconds <= 0) {
            clearInterval(countdownInterval);
            btnText.textContent = "Обновить";
            syncBtn.disabled = false;
            countdownInterval = null;
        }
        seconds--;
    }, 1000);
}

/**
 * ФУНКЦИЯ РУЧНОЙ СИНХРОНИЗАЦИИ
 */
async function syncSchedule() {
    const syncBtn = document.getElementById('sync-schedule-btn');
    const btnText = document.getElementById('sync-btn-text');
    const statusText = document.getElementById('update-status');

    const userStr = localStorage.getItem('deadlinehub_current_user');
    if (!userStr) return;
    const currentUser = JSON.parse(userStr);
    const userGroup = currentUser.group;

    if (!userGroup) {
        alert("Сначала выберите группу в профиле!");
        return;
    }

    // Состояние загрузки
    syncBtn.disabled = true;
    syncBtn.classList.add('loading');
    const prevBtnText = btnText.textContent;
    btnText.textContent = "Ждите...";

    try {
        const response = await fetch('/api/schedule/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ group: userGroup })
        });

        const result = await response.json();

        if (response.ok) {
            // Успех: перегружаем данные и возвращаем кнопку в норму
            await initSchedule();
            btnText.textContent = "Готово!";
            setTimeout(() => { if(!countdownInterval) btnText.textContent = "Обновить"; }, 3000);
        } else if (response.status === 429) {
            // Кулдаун: запускаем таймер на кнопке
            // Пытаемся достать число минут из ошибки или ставим 15 по умолчанию
            const match = result.error.match(/\d+/);
            const waitTime = match ? parseInt(match[0]) : 15;
            startButtonTimer(waitTime);
        } else {
            alert(result.error || "Ошибка обновления");
            btnText.textContent = "Обновить";
        }
    } catch (err) {
        console.error("Ошибка сети:", err);
        btnText.textContent = "Ошибка";
        setTimeout(() => { btnText.textContent = "Обновить"; }, 3000);
    } finally {
        syncBtn.classList.remove('loading');
        // Если таймер не запущен, разблокируем кнопку
        if (!countdownInterval) {
            syncBtn.disabled = false;
        }
    }
}

/**
 * Инициализация расписания
 */
export async function initSchedule() {
    try {
        const userStr = localStorage.getItem('deadlinehub_current_user');
        const titleElement = document.getElementById('schedule-title');
        const statusElement = document.getElementById('update-status');
        const syncBtn = document.getElementById('sync-schedule-btn');

        if (!userStr) {
            console.warn("Пользователь не авторизован");
            if (titleElement) titleElement.textContent = "📅 Расписание (авторизуйтесь)";
            return;
        }

        const currentUser = JSON.parse(userStr);
        const userGroup = currentUser.group;

        // Привязываем обработчик кнопки
        if (syncBtn && !syncBtn.onclick) {
            syncBtn.onclick = syncSchedule;
        }

        // Заголовок страницы
        if (titleElement) {
            titleElement.textContent = userGroup
                ? `📅 Расписание: группа ${userGroup}`
                : `📅 Расписание (группа не выбрана)`;
        }

        if (!userGroup) {
            if (statusElement) statusElement.textContent = "Выберите группу в профиле";
            return;
        }

        // Запрос данных
        const res = await fetch(`/api/schedule?group=${encodeURIComponent(userGroup)}`);
        const json = await res.json();

        // Обновляем текст статуса (справа)
        if (statusElement) {
            statusElement.textContent = `Обновлено: ${formatUpdateDate(json.lastUpdated)}`;
        }

        const data = json.items || [];
        const now = new Date();
        const year = now.getFullYear();

        const isSpring = now.getMonth() >= 1 && now.getMonth() <= 7;
        const semStart = isSpring ? new Date(year, 1, 1) : new Date(year, 8, 1);
        const semEnd = isSpring ? new Date(year, 7, 31) : new Date(year + 1, 0, 31);

        scheduleData = data
            .filter(item => {
                const d = new Date(item.start_at);
                return d >= semStart && d <= semEnd;
            })
            .map(item => ({
                Дата: new Date(item.start_at).toISOString().split('T')[0],
                Время: item.time_range,
                Предмет: item.lesson_name,
                Тип: mapLessonType(item.lesson_type),
                Аудитория: item.auditory_name,
                Преподаватель: item.teacher_name,
                week_number: item.week_number
            }));

        renderSchedule();

    } catch (err) {
        console.error("Ошибка загрузки расписания:", err);
        const statusElement = document.getElementById('update-status');
        if (statusElement) statusElement.textContent = "Ошибка загрузки данных";
        renderSchedule();
    }
}

export function getScheduleData() { return scheduleData; }
export function getWeeks() { return weeks; }
export function getCurrentWeekIndex() { return currentWeekIndex; }

function groupByWeeks(schedule) {
    if (!schedule || schedule.length === 0) return [];

    const minApiWeek = Math.min(...schedule.map(item => item.week_number || 0));
    const weeksMap = new Map();

    schedule.forEach(item => {
        if (!item.Дата) return;
        const date = new Date(item.Дата);
        const realWeekNum = item.week_number;
        const displayWeekNumber = (realWeekNum - minApiWeek) + 1;
        const weekKey = `${date.getFullYear()}-W${realWeekNum}`;

        if (!weeksMap.has(weekKey)) {
            weeksMap.set(weekKey, {
                key: weekKey,
                realWeekNumber: realWeekNum,
                displayWeekNumber: displayWeekNumber,
                startDate: getStartOfWeek(date),
                endDate: getEndOfWeek(date),
                days: {}
            });
        }
        const week = weeksMap.get(weekKey);
        const dayOfWeek = getMondayBasedDay(date);
        if (!week.days[dayOfWeek]) week.days[dayOfWeek] = [];
        week.days[dayOfWeek].push({ ...item, date, dayOfWeek });
    });
    return Array.from(weeksMap.values()).sort((a, b) => a.startDate - b.startDate);
}

function renderSchedule() {
    const container = document.getElementById('schedule-list');
    if (!container) return;

    if (!scheduleData.length) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #aaa;">Расписание не найдено</div>';
        return;
    }

    weeks = groupByWeeks(scheduleData);
    const today = new Date();
    const autoIndex = weeks.findIndex(w => today >= w.startDate && today <= w.endDate);
    currentWeekIndex = autoIndex !== -1 ? autoIndex : 0;

    renderWeekTabs();
    renderCurrentWeek();
}

function renderWeekTabs() {
    const tabsContainer = document.getElementById('week-tabs');
    if (!tabsContainer) return;
    tabsContainer.innerHTML = '';

    weeks.forEach((week, index) => {
        const tab = document.createElement('button');
        tab.className = `week-tab ${index === currentWeekIndex ? 'active' : ''}`;
        tab.textContent = `${week.displayWeekNumber} нед.`;
        tab.onclick = () => {
            currentWeekIndex = index;
            renderWeekTabs();
            renderCurrentWeek();
        };
        tabsContainer.appendChild(tab);
    });
}

function renderCurrentWeek() {
    const container = document.getElementById('schedule-list');
    const weekInfo = document.getElementById('week-info');
    if (!container || !weeks[currentWeekIndex]) return;

    const week = weeks[currentWeekIndex];
    if (weekInfo) {
        weekInfo.textContent = `${week.displayWeekNumber} неделя (${formatDateRange(week.startDate, week.endDate)})`;
    }

    const daysOfWeek = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

    container.innerHTML = `
        <div class="schedule-table">
             <table>
                <thead>
                    <tr>
                        <th>День</th>
                        <th>Занятия</th>
                    </tr>
                </thead>
                <tbody>
                    ${daysOfWeek.map((dayName, index) => {
                        const dayNumber = index + 1;
                        const date = new Date(week.startDate);
                        date.setDate(date.getDate() + index);
                        const items = week.days[dayNumber] || [];

                        return `
                            <tr>
                                <td class="day-cell">
                                    <div class="day-name">${dayName}</div>
                                    <div class="day-date">${date.getDate()}.${date.getMonth() + 1}</div>
                                </td>
                                <td>
                                    <div class="schedule-items">
                                        ${items.length > 0 ? items.map(item => {
                                            let typeClass = '';
                                            const typeStr = (item.Тип || '').toLowerCase();

                                            if (typeStr.includes('лекция')) {
                                                typeClass = 'lecture';
                                            } else if (typeStr.includes('практика') || typeStr.includes('лаб')) {
                                                typeClass = 'practice';
                                            }

                                            const displayRoom = (item.Аудитория && item.Аудитория !== 'null') ? item.Аудитория : '—';
                                            const displayTeacher = (item.Преподаватель && item.Преподаватель !== 'null') ? item.Преподаватель : 'Не указан';

                                            return `
                                                <div class="schedule-item ${typeClass}">
                                                    <div class="item-time">⏰ ${item.Время || '--:--'}</div>
                                                    <div class="item-subject">${escapeHtml(item.Предмет)}</div>
                                                    <div><span class="item-type">${item.Тип}</span></div>
                                                    <div class="item-room">📍 ${displayRoom} 👤 ${displayTeacher}</div>
                                                </div>
                                            `;
                                        }).join('') : '<div class="empty-day">📭 Нет занятий</div>'}
                                    </div>
                                </td>
                            </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>`;
}

export function nextWeek() {
    if (currentWeekIndex < weeks.length - 1) {
        currentWeekIndex++;
        renderWeekTabs();
        renderCurrentWeek();
    }
}

export function prevWeek() {
    if (currentWeekIndex > 0) {
        currentWeekIndex--;
        renderWeekTabs();
        renderCurrentWeek();
    }
}