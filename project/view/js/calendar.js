import { getCalendarOffset, escapeHtml } from './utils.js';
import { getDeadlines } from './deadlines.js';

let currentDate = new Date();

export function initCalendar() {
    renderCalendar();
}

export function prevMonth() { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); }
export function nextMonth() { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); }

export function renderCalendar() {
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
    const deadlines = getDeadlines();

    for (let i = 0; i < offset; i++) grid.appendChild(Object.assign(document.createElement('div'), {className: 'calendar-day empty'}));

    const today = new Date();
    today.setHours(0,0,0,0);

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);

        // Вместо ISOString используем локальный формат YYYY-MM-DD
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        const hasDeadline = deadlines.some(dl => dl.date === dateStr);

        const el = document.createElement('div');
        el.className = `calendar-day ${hasDeadline ? 'has-event' : ''}`;
        if (date.getTime() === today.getTime()) el.classList.add('today');
        el.textContent = day;
        el.onclick = () => openDayModal(date);
        grid.appendChild(el);
    }
}

function openDayModal(date) {
    const dateStr = date.toISOString().split('T')[0];
    const dayDeadlines = getDeadlines().filter(d => d.date === dateStr);
    document.getElementById('modal-date').textContent = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    const eventsEl = document.getElementById('modal-events');
    eventsEl.innerHTML = dayDeadlines.length ? dayDeadlines.map(d => `
        <div class="event-card"><strong>${escapeHtml(d.title)}</strong><br>${escapeHtml(d.subject)}</div>
    `).join('') : 'Нет дедлайнов';
    document.getElementById('day-modal').classList.add('active');
}