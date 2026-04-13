/**
 * ==================================================================================
 * ПРИЛОЖЕНИЕ: СТУДЕНЧЕСКИЙ ПОРТАЛ (РАСПИСАНИЕ, ДЕДЛАЙНЫ, КАЛЕНДАРЬ)
 * ==================================================================================
 */

// -------------------------------------------------------------------------
// 1. ПРОВЕРКА АВТОРИЗАЦИИ И ДАННЫЕ ПОЛЬЗОВАТЕЛЯ
// -------------------------------------------------------------------------

const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;

if (!currentUser) {
    window.location.href = 'auth/auth.html';
}

// Отображаем имя пользователя в интерфейсе
const userNameEl = document.getElementById('user-name');
const usernameDisplayEl = document.getElementById('username-display');
if (userNameEl) userNameEl.textContent = currentUser?.username || 'Гость';
if (usernameDisplayEl) usernameDisplayEl.textContent = currentUser?.username || '';


// -------------------------------------------------------------------------
// 2. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ СОСТОЯНИЯ
// -------------------------------------------------------------------------

let scheduleData = [];        // Данные расписания из API
let deadlines = [];           // Массив дедлайнов пользователя
let currentDate = new Date(); // Выбранная дата для календаря
let currentWeekIndex = 0;     // Индекс текущей отображаемой недели
let weeks = [];               // Сгруппированные по неделям занятия
let editingDeadlineId = null; // ID редактируемого дедлайна


// -------------------------------------------------------------------------
// 3. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (DATE UTILS)
// -------------------------------------------------------------------------

function getMondayBasedDay(date) {
    const day = date.getDay();
    return day === 0 ? 7 : day;
}

function getCalendarOffset(date) {
    const day = date.getDay();
    if (day === 0) return 6;
    return day - 1;
}

function getStartOfWeek(date) {
    const d = new Date(date);
    const day = getMondayBasedDay(d);
    d.setDate(d.getDate() - day + 1);
    d.setHours(0, 0, 0, 0);
    return d;
}

function getEndOfWeek(date) {
    const d = getStartOfWeek(date);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
}

function formatDateRange(start, end) {
    const startStr = `${start.getDate()}.${start.getMonth() + 1}`;
    const endStr = `${end.getDate()}.${end.getMonth() + 1}`;
    return `${startStr} - ${endStr}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}


// -------------------------------------------------------------------------
// 4. ЛОГИКА РАБОТЫ С РАСПИСАНИЕМ (SCHEDULE)
// -------------------------------------------------------------------------

function groupByWeeks(schedule) {
    if (!schedule || schedule.length === 0) return [];

    // Находим минимальный реальный номер недели в данных (для относительного счета)
    const minApiWeek = Math.min(...schedule.map(item => item.week_number || 0));

    const weeksMap = new Map();

    schedule.forEach(item => {
        if (!item.Дата) return;
        const date = new Date(item.Дата);
        if (isNaN(date.getTime())) return;

        const realWeekNum = item.week_number;
        const displayWeekNumber = (realWeekNum - minApiWeek) + 1;

        const year = date.getFullYear();
        const weekKey = `${year}-W${realWeekNum}`;

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

        if (!week.days[dayOfWeek]) {
            week.days[dayOfWeek] = [];
        }
        week.days[dayOfWeek].push({ ...item, date, dayOfWeek });
    });

    return Array.from(weeksMap.values()).sort((a, b) => a.startDate - b.startDate);
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
            renderCalendar();
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
        weekInfo.textContent = `${week.displayWeekNumber} учебная неделя (${formatDateRange(week.startDate, week.endDate)})`;
    }

    const daysOfWeek = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

    container.innerHTML = `
        <div class="schedule-table">
             <table>
                <thead>
                    <tr><th>День</th><th>Занятия</th></tr>
                </thead>
                <tbody>
                    ${daysOfWeek.map((dayName, index) => {
                        const dayNumber = index + 1;
                        const date = new Date(week.startDate);
                        date.setDate(date.getDate() + index);
                        const dateStr = `${date.getDate()}.${date.getMonth() + 1}`;
                        const items = week.days[dayNumber] || [];

                        return `
                            <tr>
                                <td class="day-cell">
                                    <div class="day-name">${dayName}</div>
                                    <div class="day-date">${dateStr}</div>
                                </td>
                                <td>
                                    <div class="schedule-items">
                                        ${items.length > 0 ? items.map(item => `
                                            <div class="schedule-item">
                                                <div class="item-time">⏰ ${item.Время || '--:--'}</div>
                                                <div class="item-subject">${escapeHtml(item.Предмет)}</div>
                                                <div><span class="item-type">${item.Тип || 'Занятие'}</span></div>
                                                <div class="item-room">📍 ${item.Аудитория || '-'} 👤 ${item.Преподаватель || '-'}</div>
                                            </div>
                                        `).join('') : '<div class="empty-day">📭 Нет занятий</div>'}
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderSchedule() {
    const container = document.getElementById('schedule-list');
    if (!container) return;

    if (!scheduleData || scheduleData.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #aaa;">Нет данных о расписании</div>';
        return;
    }

    weeks = groupByWeeks(scheduleData);
    if (weeks.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #aaa;">Нет актуальных данных на этот семестр</div>';
        return;
    }

    // Автовыбор текущей недели
    const today = new Date();
    if (today.getDay() === 0) today.setDate(today.getDate() + 1);

    const autoIndex = weeks.findIndex(w => today >= w.startDate && today <= w.endDate);
    currentWeekIndex = autoIndex !== -1 ? autoIndex : 0;

    renderWeekTabs();
    renderCurrentWeek();
}


// -------------------------------------------------------------------------
// 5. ЛОГИКА РАБОТЫ С ДЕДЛАЙНАМИ (DEADLINES)
// -------------------------------------------------------------------------

function loadDeadlines() {
    const saved = localStorage.getItem('deadlines');
    if (saved) {
        deadlines = JSON.parse(saved);
    }
    updateSubjectSelect();
    renderDeadlines();
    renderCalendar();
}

function saveDeadlinesToStorage() {
    localStorage.setItem('deadlines', JSON.stringify(deadlines));
}

function updateSubjectSelect() {
    const select = document.getElementById('deadline-subject');
    if (!select) return;

    const subjects = new Set();
    scheduleData.forEach(item => { if (item.Предмет) subjects.add(item.Предмет); });
    deadlines.forEach(d => { if (d.subject) subjects.add(d.subject); });

    if (subjects.size === 0) ['Математика', 'Программирование', 'Другое'].forEach(s => subjects.add(s));

    select.innerHTML = Array.from(subjects).map(s =>
        `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`
    ).join('');
}

function saveDeadline() {
    const subject = document.getElementById('deadline-subject').value;
    const title = document.getElementById('deadline-title').value;
    const description = document.getElementById('deadline-description').value;
    const date = document.getElementById('deadline-date').value;
    const time = document.getElementById('deadline-time').value;

    if (!title || !date) return alert('Заполните название и дату');

    if (editingDeadlineId) {
        const idx = deadlines.findIndex(d => d.id === editingDeadlineId);
        if (idx !== -1) deadlines[idx] = { ...deadlines[idx], subject, title, description, date, time };
    } else {
        deadlines.push({ id: Date.now(), subject, title, description, date, time });
    }

    saveDeadlinesToStorage();
    closeDeadlineModal();
    renderDeadlines();
    renderCalendar();
}

function deleteDeadline(id) {
    if (confirm('Удалить дедлайн?')) {
        deadlines = deadlines.filter(d => d.id !== id);
        saveDeadlinesToStorage();
        renderDeadlines();
        renderCalendar();
    }
}

function renderDeadlines() {
    const container = document.getElementById('deadlines-list');
    if (!container) return;

    if (deadlines.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #aaa;">🎉 Нет активных дедлайнов!</div>';
        return;
    }

    const sorted = [...deadlines].sort((a, b) => new Date(a.date) - new Date(b.date));
    container.innerHTML = sorted.map(d => {
        const date = new Date(d.date);
        const diff = Math.ceil((date - new Date()) / (1000 * 60 * 60 * 24));
        const daysText = diff === 0 ? 'Сегодня' : diff === 1 ? 'Завтра' : diff < 0 ? 'Просрочено' : `Через ${diff} дн.`;

        return `
            <div class="deadline-card">
                <button class="delete-deadline" onclick="deleteDeadline(${d.id})">×</button>
                <div class="deadline-header">
                    <div class="deadline-info">
                        <h3>${escapeHtml(d.title)}</h3>
                        <span class="subject-tag">${escapeHtml(d.subject)}</span>
                    </div>
                    <div class="deadline-time">
                        <div class="time-left">${daysText}</div>
                        <div class="deadline-date">${d.date}</div>
                    </div>
                </div>
                <button class="edit-deadline-btn" onclick='editDeadline(${JSON.stringify(d)})'>✏️ Редактировать</button>
            </div>
        `;
    }).join('');
}


// -------------------------------------------------------------------------
// 6. ЛОГИКА КАЛЕНДАРЯ (CALENDAR)
// -------------------------------------------------------------------------

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const monthTitle = document.getElementById('month-title');
    if (!grid || !monthTitle) return;

    grid.innerHTML = '';
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthNames = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
    monthTitle.textContent = `${monthNames[month]} ${year}`;

    const offset = getCalendarOffset(new Date(year, month, 1));
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < offset; i++) grid.appendChild(Object.assign(document.createElement('div'), {className: 'calendar-day empty'}));

    const today = new Date();
    today.setHours(0,0,0,0);

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateStr = date.toISOString().split('T')[0];
        const hasDeadline = deadlines.some(d => d.date === dateStr);

        const el = document.createElement('div');
        el.className = `calendar-day ${hasDeadline ? 'has-event' : ''}`;
        if (date.getTime() === today.getTime()) el.classList.add('today');
        el.textContent = day;
        el.onclick = () => openDayModal(date);
        grid.appendChild(el);
    }
}


// -------------------------------------------------------------------------
// 7. МОДАЛЬНЫЕ ОКНА
// -------------------------------------------------------------------------

function openAddDeadlineModal() {
    editingDeadlineId = null;
    document.getElementById('deadline-modal-title').textContent = '➕ Добавить дедлайн';
    document.getElementById('deadline-title').value = '';
    document.getElementById('deadline-date').value = '';
    document.getElementById('deadline-modal').classList.add('active');
}

function editDeadline(d) {
    editingDeadlineId = d.id;
    document.getElementById('deadline-modal-title').textContent = '✏️ Редактировать';
    document.getElementById('deadline-subject').value = d.subject;
    document.getElementById('deadline-title').value = d.title;
    document.getElementById('deadline-date').value = d.date;
    document.getElementById('deadline-time').value = d.time;
    document.getElementById('deadline-modal').classList.add('active');
}

function closeDeadlineModal() { document.getElementById('deadline-modal').classList.remove('active'); }

function openDayModal(date) {
    const dateStr = date.toISOString().split('T')[0];
    const dayDeadlines = deadlines.filter(d => d.date === dateStr);
    document.getElementById('modal-date').textContent = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    const eventsEl = document.getElementById('modal-events');
    eventsEl.innerHTML = dayDeadlines.length ? dayDeadlines.map(d => `
        <div class="event-card">
            <strong>${escapeHtml(d.title)}</strong><br>${escapeHtml(d.subject)}
        </div>`).join('') : 'Нет дедлайнов';
    document.getElementById('day-modal').classList.add('active');
}

function closeDayModal() { document.getElementById('day-modal').classList.remove('active'); }

function openWeekdayModal(num) {
    const week = weeks[currentWeekIndex];
    if (!week) return;
    const modal = document.getElementById('weekday-modal');
    document.getElementById('weekday-modal-title').textContent = `Дедлайны на выбранный день`;
    // Тут можно добавить логику фильтрации дедлайнов именно для этого дня недели
    modal.classList.add('active');
}

function closeWeekdayModal() { document.getElementById('weekday-modal').classList.remove('active'); }


// -------------------------------------------------------------------------
// 8. НАВИГАЦИЯ
// -------------------------------------------------------------------------

function switchTab(id) {
    document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
}

function updateTodayText() {
    const el = document.getElementById('today-text');
    if (el) el.textContent = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
}

function prevMonth() { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); }
function nextMonth() { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); }


// -------------------------------------------------------------------------
// 9. ЗАГРУЗКА ДАННЫХ
// -------------------------------------------------------------------------

window.onload = () => {
    updateTodayText();

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = () => switchTab(btn.dataset.tab);
    });

    const bindClick = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    bindClick('prev-month', prevMonth);
    bindClick('next-month', nextMonth);
    bindClick('add-deadline-btn', openAddDeadlineModal);

    document.querySelectorAll('.calendar-weekdays div').forEach(el => {
        el.onclick = () => openWeekdayModal(parseInt(el.dataset.day));
    });

    // Загрузка расписания
    fetch("/api/schedule")
        .then(res => res.json())
        .then(data => {
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
                    // Теперь здесь будет "Лекция" вместо "1"
                    Тип: mapLessonType(item.lesson_type),
                    Аудитория: item.auditory_name,
                    Преподаватель: item.teacher_name,
                    week_number: item.week_number
                }));

            renderSchedule();
            loadDeadlines();
        })
        .catch(err => {
            console.error(err);
            renderSchedule();
            loadDeadlines();
        });
};

function mapLessonType(typeId) {
    const types = {
        1: '1',
        2: 'Лекция',
        3: '3',
        4: 'Практика'
    };
    // Если в базе число, которого нет в списке, вернет 'Занятие'
    return types[typeId] || 'Занятие';
}
// Глобальные ссылки для HTML
window.deleteDeadline = deleteDeadline;
window.editDeadline = editDeadline;
window.saveDeadline = saveDeadline;
window.closeDeadlineModal = closeDeadlineModal;
window.closeDayModal = closeDayModal;
window.closeWeekdayModal = closeWeekdayModal;