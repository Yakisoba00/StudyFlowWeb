/**
 * Вспомогательные функции (Утилиты)
 */

export function getMondayBasedDay(date) {
    const day = date.getDay();
    return day === 0 ? 7 : day;
}

export function getCalendarOffset(date) {
    const day = date.getDay();
    if (day === 0) return 6;
    return day - 1;
}

export function getStartOfWeek(date) {
    const d = new Date(date);
    const day = getMondayBasedDay(d);
    d.setDate(d.getDate() - day + 1);
    d.setHours(0, 0, 0, 0);
    return d;
}

export function getEndOfWeek(date) {
    const d = getStartOfWeek(date);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
}

export function formatDateRange(start, end) {
    const startStr = `${start.getDate()}.${start.getMonth() + 1}`;
    const endStr = `${end.getDate()}.${end.getMonth() + 1}`;
    return `${startStr} - ${endStr}`;
}

export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

export function mapLessonType(typeId) {
    const types = { 1: '1', 2: 'Лекция', 3: '3', 4: 'Практика', 4096: 'Лекция' };
    return types[typeId] || 'Занятие';
}

export function formatDate(dateStr) {
    if (!dateStr) return '';
    const match = String(dateStr).match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}