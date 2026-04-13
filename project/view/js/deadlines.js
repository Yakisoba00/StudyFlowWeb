import { escapeHtml } from './utils.js';
import { getScheduleData } from './schedule.js';

let deadlines = [];
let editingDeadlineId = null;
function formatDate(dateStr) {
    if (!dateStr) return '';
    // Если это ISO строка (содержит 'T'), берём только дату
    const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    // Если пришло что-то другое, пробуем распарсить
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr; // fallback
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
// Загрузка дедлайнов из БД через API
export async function initDeadlines() {
    try {
        const response = await fetch('/api/deadlines', {
            credentials: 'include'   // ← отправляем куки сессии
        });
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/auth/auth.html';
                return;
            }
            throw new Error('Ошибка сети');
        }
        deadlines = await response.json();
        updateSubjectSelect();
        renderDeadlines();
    } catch (err) {
        console.error("Ошибка при загрузке дедлайнов:", err);
        deadlines = [];
        renderDeadlines();
    }
}

export function getDeadlines() { return deadlines; }

export function updateSubjectSelect() {
    const select = document.getElementById('deadline-subject');
    if (!select) return;
    const subjects = new Set();

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
        const options = {
            method: editingDeadlineId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',   // ← важно
            body: JSON.stringify(deadlineData)
        };
        const url = editingDeadlineId ? `/api/deadlines/${editingDeadlineId}` : '/api/deadlines';
        response = await fetch(url, options);

        if (response.ok) {
            closeDeadlineModal();
            await initDeadlines();
        } else {
            const err = await response.json();
            alert(err.error || 'Ошибка сохранения');
        }
    } catch (err) {
        console.error("Ошибка при сохранении:", err);
        alert("Не удалось сохранить дедлайн");
    }
}

export async function deleteDeadline(id) {
    if (confirm('Удалить дедлайн?')) {
        try {
            const response = await fetch(`/api/deadlines/${id}`, {
                method: 'DELETE',
                credentials: 'include'   // ← важно
            });
            if (response.ok) {
                await initDeadlines();
            } else {
                alert('Ошибка удаления');
            }
        } catch (err) {
            console.error("Ошибка при удалении:", err);
        }
    }
}

// Новая функция – отметить выполнение
export async function toggleDeadlineCompletion(id, completed) {
    try {
        const response = await fetch(`/api/deadlines/${id}/complete`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ completed })
        });
        if (response.ok) {
            const deadline = deadlines.find(d => d.id === id);
            if (deadline) deadline.completed = completed;
            renderDeadlines();  // перерисовываем для обновления стиля
        } else {
            alert('Ошибка обновления статуса');
        }
    } catch (err) {
        console.error("Ошибка обновления статуса:", err);
        alert('Не удалось обновить статус');
    }
}

export function editDeadline(d) {
    editingDeadlineId = d.id;
    document.getElementById('deadline-modal-title').textContent = '✏️ Редактировать';
    document.getElementById('deadline-subject').value = d.subject || '';
    document.getElementById('deadline-title').value = d.title;
    document.getElementById('deadline-date').value = d.date;
    document.getElementById('deadline-time').value = d.time || '';
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

        const completedClass = d.completed ? 'deadline-completed' : '';
        const checkedAttr = d.completed ? 'checked' : '';

        return `
            <div class="deadline-card ${completedClass}">
                <button class="delete-deadline" onclick="window.deleteDeadline(${d.id})">×</button>
                <div class="deadline-header">
                    <div class="deadline-info">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" 
                                   class="deadline-checkbox" 
                                   onchange="window.toggleDeadlineCompletion(${d.id}, this.checked)" 
                                   ${checkedAttr}>
                            <h3>${escapeHtml(d.title)}</h3>
                        </div>
                        <span class="subject-tag">${escapeHtml(d.subject)}</span>
                    </div>
                    <div class="deadline-time">
                        <div class="time-left">${daysText}</div>
                        <div class="deadline-date">${formatDate(d.date)} ${d.time ? d.time : ''}</div>
                    </div>
                </div>
                <button class="edit-deadline-btn" onclick='window.editDeadline(${JSON.stringify(d)})'>✏️ Редактировать</button>
            </div>`;
    }).join('');
}

// Экспортируем функции в глобальную область для onclick-обработчиков
window.deleteDeadline = deleteDeadline;
window.editDeadline = editDeadline;
window.toggleDeadlineCompletion = toggleDeadlineCompletion;