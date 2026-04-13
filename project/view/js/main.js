// 1. ИМПОРТЫ
console.log("🚀 main.js загружается...");
import { logout } from '../auth/auth.js';
import { initSchedule, nextWeek, prevWeek } from './schedule.js';
import { initDeadlines, saveDeadline, deleteDeadline, editDeadline, openAddDeadlineModal, closeDeadlineModal } from './deadlines.js';
import { initCalendar, prevMonth, nextMonth, renderCalendar } from './calendar.js';

// 2. ГЛОБАЛЬНАЯ ПРИВЯЗКА (Важно сделать до onload)
window.logout = logout;
window.switchTab = (id) => {
    document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));
    const targetTab = document.getElementById(id);
    if (targetTab) targetTab.classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
};

window.saveDeadline = async () => {
    await saveDeadline();
    if (typeof renderCalendar === 'function') renderCalendar();
};

window.deleteDeadline = async (id) => {
    await deleteDeadline(id);
    if (typeof renderCalendar === 'function') renderCalendar();
};

window.editDeadline = editDeadline;
window.closeDeadlineModal = closeDeadlineModal;
window.openAddDeadlineModal = openAddDeadlineModal;
window.prevMonth = prevMonth;
window.nextMonth = nextMonth;
window.nextWeek = nextWeek;
window.prevWeek = prevWeek;
window.closeDayModal = () => document.getElementById('day-modal')?.classList.remove('active');
window.closeWeekdayModal = () => document.getElementById('weekday-modal')?.classList.remove('active');

// 3. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
function updateTodayText() {
    const el = document.getElementById('today-text');
    if (el) el.textContent = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
}

function bind(id, fn) {
    const el = document.getElementById(id);
    if (el) el.onclick = fn;
}

// 4. ОСНОВНАЯ ЛОГИКА ЗАПУСКА
window.addEventListener('DOMContentLoaded', async () => {
    console.log("📍 DOMContentLoaded: Начинаем инициализацию...");

    const userStr = localStorage.getItem('deadlinehub_current_user');
    if (!userStr) {
        console.warn("⚠️ Пользователь не найден, уходим на логин.");
        const pathPrefix = window.location.pathname.includes('profile/') ? '../' : '';
        window.location.href = pathPrefix + 'auth/auth.html';
        return;
    }

    const currentUser = JSON.parse(userStr);
    const userNameEl = document.getElementById('user-name');
    if (userNameEl) userNameEl.textContent = currentUser.username || currentUser.name || 'Студент';

    const headerAvatar = document.querySelector('.avatar img');
    if (headerAvatar && currentUser.avatar) headerAvatar.src = currentUser.avatar;

    updateTodayText();

    // Пошаговый запуск с отслеживанием
    try {
        console.log("🕒 Шаг 1: Расписание...");
        await initSchedule();

        console.log("🕒 Шаг 2: Дедлайны...");
        // Если initDeadlines зависнет, мы увидим это в консоли
        await initDeadlines();

        console.log("🕒 Шаг 3: Календарь...");
        initCalendar();

        console.log("✅ StudyFlow полностью готов!");
    } catch (err) {
        console.error("❌ КРИТИЧЕСКИЙ СБОЙ ПРИ ЗАПУСКЕ:", err);
    }

    // Привязка навигации
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = () => window.switchTab(btn.dataset.tab);
    });

    bind('prev-month', prevMonth);
    bind('next-month', nextMonth);
    bind('prev-week', prevWeek);
    bind('next-week', nextWeek);
    bind('add-deadline-btn', openAddDeadlineModal);

    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = () => { if (confirm('Выйти?')) logout(); };
    }
});