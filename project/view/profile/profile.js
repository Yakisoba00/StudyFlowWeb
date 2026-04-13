// ==========================================================================
// 👤 ЛОГИКА ПРОФИЛЯ (profile.js)
// ==========================================================================

let currentUser = null;

document.addEventListener('DOMContentLoaded', initProfile);

/**
 * Инициализация профиля
 */
async function initProfile() {
    const userStr = localStorage.getItem('deadlinehub_current_user');
    if (!userStr) {
        window.location.href = '../auth/auth.html';
        return;
    }
    currentUser = JSON.parse(userStr);

    // 1. Отображаем данные из локального хранилища (мгновенно)
    renderUserData(currentUser);

    // 2. Загружаем свежие данные из БД
    await fetchUserProfile();

    // 3. Инициализируем друзей и статистику
    loadFriends();
    updateStats();
}

/**
 * Получение свежих данных профиля из API
 */
async function fetchUserProfile() {
    try {
        const response = await fetch(`/api/user/${currentUser.id}`);
        if (!response.ok) throw new Error('Ошибка сети');

        const user = await response.json();

        // Обновляем UI и локальную сессию
        renderUserData(user);
        currentUser = user;
        localStorage.setItem('deadlinehub_current_user', JSON.stringify(user));
    } catch (err) {
        console.error("❌ Ошибка загрузки профиля:", err);
    }
}

/**
 * Отрисовка данных пользователя на странице
 */
function renderUserData(user) {
    if (!user) return;

    const nameEl = document.getElementById('profile-name');
    const usernameEl = document.getElementById('profile-username');
    const emailEl = document.getElementById('profile-email');
    const avatarEl = document.getElementById('profile-avatar');
    const groupSelect = document.getElementById('group-select');
    const groupInfo = document.getElementById('group-info');

    if (nameEl) nameEl.textContent = user.name || user.login;
    if (usernameEl) usernameEl.textContent = `@${user.login}`;
    if (emailEl) emailEl.textContent = user.email;
    if (avatarEl) avatarEl.src = user.avatar || 'https://i.pravatar.cc/150?u=student';

    // Устанавливаем выбранную группу в списке
    if (user.group) {
        if (groupSelect) groupSelect.value = user.group;
        if (groupInfo) groupInfo.textContent = `Текущая группа: ${user.group}`;
    }
}

/**
 * СОХРАНЕНИЕ ГРУППЫ И СИНХРОНИЗАЦИЯ РАСПИСАНИЯ
 */
async function saveGroup() {
    const groupSelect = document.getElementById('group-select');
    const group = groupSelect.value;

    if (!group) return alert('Пожалуйста, выберите группу');

    try {
        // 1. Отправляем запрос на обновление группы в профиле
        // Наш сервер в этот момент сам запустит fetchAndSaveScheduleByGroup
        const response = await fetch(`/api/user/${currentUser.id}/group`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ group: group })
        });

        if (response.ok) {
            // 2. Обновляем локальные данные, чтобы страница расписания видела новую группу
            currentUser.group = group;
            localStorage.setItem('deadlinehub_current_user', JSON.stringify(currentUser));

            // 3. Обновляем текст на странице
            const groupInfo = document.getElementById('group-info');
            if (groupInfo) groupInfo.textContent = `Текущая группа: ${group}`;

            alert('✅ Группа сохранена! Расписание обновится в течение нескольких секунд.');
        } else {
            alert('Ошибка при сохранении группы на сервере');
        }
    } catch (err) {
        console.error(err);
        alert('❌ Не удалось сохранить группу');
    }
}

/**
 * СМЕНА АВАТАРА
 */
async function setAvatar(url) {
    try {
        const response = await fetch(`/api/user/${currentUser.id}/avatar`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avatarUrl: url })
        });

        if (response.ok) {
            currentUser.avatar = url;
            localStorage.setItem('deadlinehub_current_user', JSON.stringify(currentUser));

            const profileImg = document.getElementById('profile-avatar');
            if (profileImg) profileImg.src = url;

            const headerImg = document.querySelector('.avatar img');
            if (headerImg) headerImg.src = url;

            closeAvatarModal();
        }
    } catch (err) {
        console.error(err);
        alert('Ошибка смены аватара');
    }
}

// Утилиты для UI
window.changeAvatar = () => document.getElementById('avatar-modal')?.classList.add('active');
window.closeAvatarModal = () => document.getElementById('avatar-modal')?.classList.remove('active');
window.setAvatar = setAvatar;
window.saveGroup = saveGroup;
window.logout = logout;

/**
 * ДРУЗЬЯ (пока LocalStorage)
 */
function loadFriends() {
    const friends = JSON.parse(localStorage.getItem(`friends_${currentUser.id}`) || '[]');
    const container = document.getElementById('friends-list');
    const countEl = document.getElementById('friends-count');

    if (countEl) countEl.textContent = friends.length;
    if (!container) return;

    if (friends.length === 0) {
        container.innerHTML = '<div class="empty-friends">👥 Друзей пока нет</div>';
        return;
    }

    container.innerHTML = friends.map(f => `
        <div class="friend-card">
            <img src="${f.avatar || 'https://i.pravatar.cc/150?u=' + f.username}" class="friend-avatar">
            <div class="friend-info">
                <div class="friend-name">${f.username}</div>
                <div class="friend-group">${f.group || 'Группа не указана'}</div>
            </div>
        </div>
    `).join('');
}

function updateStats() {
    const completedEl = document.getElementById('deadlines-completed');
    const activeEl = document.getElementById('active-deadlines');
    if (completedEl) completedEl.textContent = "0";
    if (activeEl) activeEl.textContent = "0";
}

function logout() {
    if (confirm('Вы уверены, что хотите выйти?')) {
        localStorage.removeItem('deadlinehub_current_user');
        window.location.href = '../auth/auth.html';
    }
}