/**
 * 🔐 ЛОГИКА АВТОРИЗАЦИИ И РЕГИСТРАЦИИ (auth.js)
 */

// Переменная для временного хранения данных только что зарегистрированного юзера
let registeredUser = null;

/**
 * Выход из системы
 */
export function logout() {
    localStorage.removeItem('deadlinehub_current_user');
    window.location.href = '../auth/auth.html';
}

/**
 * Получение текущего пользователя
 */
export function getCurrentUser() {
    const user = localStorage.getItem('deadlinehub_current_user');
    return user ? JSON.parse(user) : null;
}

// Показать сообщение об ошибке
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    if (!errorDiv) return alert(message);
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
    setTimeout(() => errorDiv.classList.remove('show'), 3000);
}

// Переключение вкладок (Логин / Регистрация)
export function switchTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    if (loginForm) {
        loginForm.classList.toggle('active', tab === 'login');
        loginForm.style.display = tab === 'login' ? 'block' : 'none';
    }
    if (registerForm) {
        registerForm.classList.toggle('active', tab === 'register');
        registerForm.style.display = tab === 'register' ? 'block' : 'none';
    }
}

// РЕГИСТРАЦИЯ
export async function register() {
    const username = document.getElementById('reg-username')?.value.trim();
    const email = document.getElementById('reg-email')?.value.trim();
    const password = document.getElementById('reg-password')?.value;
    const confirm = document.getElementById('reg-confirm')?.value;

    if (!username || !email || !password) return showError('Заполните все поля');
    if (password !== confirm) return showError('Пароли не совпадают');
    if (password.length < 6) return showError('Пароль слишком короткий (мин. 6 симв.)');

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();
        if (response.ok) {
            // Сохраняем данные юзера во временную переменную
            registeredUser = data;
            // Показываем модалку выбора группы (Onboarding)
            showGroupModal();
        } else {
            showError(data.error || 'Ошибка регистрации');
        }
    } catch (err) {
        showError('Нет связи с сервером');
    }
}

// ВХОД
export async function login() {
    const loginVal = document.getElementById('login-username')?.value.trim();
    const password = document.getElementById('login-password')?.value;

    if (!loginVal || !password) return showError('Заполните поля');

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: loginVal, password })
        });

        const data = await response.json();
        if (response.ok) {
            // При обычном входе просто пускаем на главную
            finalizeAuth(data);
        } else {
            showError(data.error || 'Неверные данные');
        }
    } catch (err) {
        showError('Ошибка сервера');
    }
}

/**
 * ОНБОРДИНГ: Работа с модальным окном группы
 */
function showGroupModal() {
    const modal = document.getElementById('setup-group-modal');
    if (modal) modal.classList.add('active');
}

async function finishSetup() {
    const groupSelect = document.getElementById('setup-group-select');
    const group = groupSelect?.value;

    if (!group) return alert('Пожалуйста, выберите группу из списка');

    try {
        // Отправляем выбранную группу на сервер
        const response = await fetch(`/api/user/${registeredUser.id}/group`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ group })
        });

        if (response.ok) {
            registeredUser.group = group;
            finalizeAuth(registeredUser);
        } else {
            alert('Не удалось сохранить группу, но аккаунт создан.');
            finalizeAuth(registeredUser);
        }
    } catch (err) {
        console.error("Ошибка синхронизации группы:", err);
        finalizeAuth(registeredUser);
    }
}

function skipSetup() {
    finalizeAuth(registeredUser);
}

/**
 * Финальный этап: сохранение в LocalStorage и редирект
 */
function finalizeAuth(user) {
    localStorage.setItem('deadlinehub_current_user', JSON.stringify(user));
    window.location.href = '../mobile.html';
}

/**
 * ИНИЦИАЛИЗАЦИЯ СОБЫТИЙ
 */
document.addEventListener('DOMContentLoaded', () => {
    // Табы
    document.querySelectorAll('.auth-tab').forEach(tabBtn => {
        tabBtn.addEventListener('click', () => switchTab(tabBtn.dataset.tab));
    });

    // Кнопки форм (через ID, так как мы убрали onclick из HTML)
    document.getElementById('login-btn')?.addEventListener('click', login);
    document.getElementById('register-btn')?.addEventListener('click', register);

    // Кнопки модального окна
    document.getElementById('finish-setup-btn')?.addEventListener('click', finishSetup);
    document.getElementById('skip-setup-btn')?.addEventListener('click', skipSetup);
});

// Проброс в window (на случай, если в HTML остались старые onclick)
window.login = login;
window.register = register;
window.switchTab = switchTab;
window.finishSetup = finishSetup;
window.skipSetup = skipSetup;