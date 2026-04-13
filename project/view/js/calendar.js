import { getCalendarOffset, escapeHtml, formatDate } from './utils.js';
import { getDeadlines, initDeadlines } from './deadlines.js';

let currentDate = new Date();

export async function initCalendar() {
    await initDeadlines(); // загружаем дедлайны перед первым рендером
    renderCalendar();
}

export function prevMonth() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
}

export function nextMonth() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
}

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

    for (let i = 0; i < offset; i++) {
        grid.appendChild(Object.assign(document.createElement('div'), { className: 'calendar-day empty' }));
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        // Фильтруем дедлайны на этот день с учётом formatDate
        const dayDeadlines = deadlines.filter(dl => formatDate(dl.date) === dateStr);
        const hasDeadline = dayDeadlines.length > 0;

        const el = document.createElement('div');
        el.className = `calendar-day ${hasDeadline ? 'has-event' : ''}`;
        if (date.getTime() === today.getTime()) el.classList.add('today');
        el.textContent = day;

        // Добавляем счётчик дедлайнов, если они есть
        if (hasDeadline) {
            const badge = document.createElement('span');
            badge.className = 'event-count-badge';
            badge.textContent = dayDeadlines.length;
            el.appendChild(badge);
        }

        el.onclick = () => openDayModal(date);
        grid.appendChild(el);
    }
}

function openDayModal(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    
    const dayDeadlines = getDeadlines().filter(dl => {
        const dlDate = formatDate(dl.date);
        return dlDate === dateStr;
    });
    document.getElementById('modal-date').textContent = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    const eventsEl = document.getElementById('modal-events');
    eventsEl.innerHTML = dayDeadlines.length
        ? dayDeadlines.map(d => `
            <div class="event-card">
                <strong>${escapeHtml(d.title)}</strong><br>
                ${escapeHtml(d.subject)}${d.time ? '<br>🕒 ' + d.time : ''}
            </div>
        `).join('')
        : 'Нет дедлайнов';
    document.getElementById('day-modal').classList.add('active');
}