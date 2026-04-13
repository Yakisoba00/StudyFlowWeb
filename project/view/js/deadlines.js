import { escapeHtml } from './utils.js';
import { getScheduleData } from './schedule.js';

let deadlines = [];
let editingDeadlineId = null;

// Загрузка дедлайнов из БД через API
export async function initDeadlines() {
    try {
        const response = await fetch('/api/deadlines');
        if (!response.ok) throw new Error('Ошибка сети');
        deadlines = await response.json();

        updateSubjectSelect();
        renderDeadlines();
    } catch (err) {
        console.error("Ошибка при загрузке дедлайнов:", err);
        // Если сервер не отвечает, рисуем пустой список, чтобы не блокировать интерфейс
        deadlines = [];
        renderDeadlines();
    }
}

export function getDeadlines() { return deadlines; }

export function updateSubjectSelect() {
    const select = document.getElementById('deadline-subject');
    if (!select) return;
    const subjects = new Set();

    // Безопасное получение данных из расписания
    const schedule = typeof getScheduleData === 'function' ? getScheduleData() : [];
    schedule.forEach(item => { if (item.Предмет) subjects.add(item.Предмет); });

    deadlines.forEach(d => { if (d.subject) subjects.add(d.subject); });
    if (subjects.size === 0) ['Математика', 'Программирование'].forEach(s => subjects.add(s));

    select.innerHTML = Array.from(subjects).map(s =>
        `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`
    ).join('');
}

export async function saveDeadline() {
    const subject = document.getElementById('deadline-subject').value;
    const title = document.getElementById('deadline-title').value;
    const date = document.getElementById('deadline-date').value;
    const time = document.getElementById('deadline-time').value;
    const description = document.getElementById('deadline-description').value;

    if (!title || !date) return alert('Заполните название и дату');

    const deadlineData = { subject, title, date, time, description };

    try {
        let response;
        if (editingDeadlineId) {
            response = await fetch(`/api/deadlines/${editingDeadlineId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(deadlineData)
            });
        } else {
            response = await fetch('/api/deadlines', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(deadlineData)
            });
        }

        if (response.ok) {
            closeDeadlineModal();
            await initDeadlines();
            // renderCalendar() здесь удален, он вызывается в main.js
        }
    } catch (err) {
        console.error("Ошибка при сохранении:", err);
        alert("Не удалось сохранить дедлайн");
    }
}

export async function deleteDeadline(id) {
    if (confirm('Удалить дедлайн?')) {
        try {
            const response = await fetch(`/api/deadlines/${id}`, { method: 'DELETE' });
            if (response.ok) {
                await initDeadlines();
                // renderCalendar() здесь удален
            }
        } catch (err) {
            console.error("Ошибка при удалении:", err);
        }
    }
}

export function editDeadline(d) {
    editingDeadlineId = d.id;
    document.getElementById('deadline-modal-title').textContent = '✏️ Редактировать';
    document.getElementById('deadline-subject').value = d.subject;
    document.getElementById('deadline-title').value = d.title;
    document.getElementById('deadline-date').value = d.date;
    document.getElementById('deadline-time').value = d.time;
    document.getElementById('deadline-description').value = d.description || '';
    document.getElementById('deadline-modal').classList.add('active');
}

export function openAddDeadlineModal() {
    editingDeadlineId = null;
    document.getElementById('deadline-modal-title').textContent = '➕ Добавить дедлайн';
    document.querySelectorAll('#deadline-modal input, #deadline-modal textarea').forEach(i => i.value = '');
    document.getElementById('deadline-modal').classList.add('active');
}

export function closeDeadlineModal() {
    document.getElementById('deadline-modal').classList.remove('active');
}

export function renderDeadlines() {
    const container = document.getElementById('deadlines-list');
    if (!container) return;

    if (!deadlines || deadlines.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #aaa;">🎉 Нет дедлайнов!</div>';
        return;
    }

    const sorted = [...deadlines].sort((a, b) => new Date(a.date) - new Date(b.date));

    container.innerHTML = sorted.map(d => {
        const diff = Math.ceil((new Date(d.date) - new Date()) / (1000 * 60 * 60 * 24));
        const daysText = diff === 0 ? 'Сегодня' : diff === 1 ? 'Завтра' : diff < 0 ? 'Просрочено' : `Через ${diff} дн.`;

        return `
            <div class="deadline-card">
                <button class="delete-deadline" onclick="window.deleteDeadline(${d.id})">×</button>
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
                <button class="edit-deadline-btn" onclick='window.editDeadline(${JSON.stringify(d)})'>✏️ Редактировать</button>
            </div>`;
    }).join('');
}