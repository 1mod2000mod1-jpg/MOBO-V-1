// Cold Room Chat System - Client Side
console.log('❄️ Cold Room loading...');

let socket = null;
let currentUser = null;
let currentRoom = null;
let systemSettings = {};
let selectedUserId = null;
let selectedUsername = null;
let currentPrivateChatUser = null;

// التهيئة
function initializeSocket() {
    console.log('Connecting to server...');
    
    socket = io({
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10,
        timeout: 20000
    });

    setupSocketListeners();
}

function setupSocketListeners() {
    socket.on('connect', () => {
        console.log('✅ Connected');
        hideLoading();
    });

    socket.on('disconnect', () => {
        console.log('⚠️ Disconnected');
    });

    socket.on('login-success', (data) => {
        handleLoginSuccess(data);
    });

    socket.on('login-error', (message) => {
        hideLoading();
        showAlert(message, 'error');
    });

    socket.on('banned-user', (data) => {
        hideLoading();
        showAlert(`Banned: ${data.reason}`, 'error');
        document.getElementById('support-section').style.display = 'block';
    });

    socket.on('register-success', (data) => {
        hideLoading();
        showAlert(data.message, 'success');
        document.getElementById('login-username').value = data.username;
    });

    socket.on('register-error', (message) => {
        hideLoading();
        showAlert(message, 'error');
    });

    socket.on('new-message', (message) => {
        addMessage(message);
        scrollToBottom();
    });

    socket.on('new-private-message', (message) => {
        if (currentPrivateChatUser === message.from) {
            addPrivateMessage(message);
        }
        showNotification(`New private message from ${message.fromName}`);
    });

    socket.on('private-message-sent', (message) => {
        addPrivateMessage(message);
    });

    socket.on('private-messages-list', (data) => {
        displayPrivateMessages(data.messages);
    });

    socket.on('room-joined', (data) => {
        handleRoomJoined(data);
    });

    socket.on('room-created', (data) => {
        showAlert('Room created', 'success');
        socket.emit('join-room', { roomId: data.roomId });
        hideModal('create-room-modal');
    });

    socket.on('users-list', updateUsersList);
    socket.on('rooms-list', updateRoomsList);

    socket.on('user-joined', (data) => {
        showNotification(`${data.username} joined`);
    });

    socket.on('message-deleted', (data) => {
        const msgEl = document.querySelector(`[data-message-id="${data.messageId}"]`);
        if (msgEl) msgEl.remove();
    });

    socket.on('chat-cleaned', (data) => {
        clearMessages();
        showAlert(data.message, 'info');
    });

    socket.on('room-silenced', (data) => {
        document.getElementById('message-input').disabled = !currentUser?.isOwner;
        showAlert(data.message, 'warning');
    });

    socket.on('room-unsilenced', (data) => {
        document.getElementById('message-input').disabled = false;
        showAlert(data.message, 'success');
    });

    socket.on('room-deleted', (data) => {
        showAlert(data.message, 'error');
        socket.emit('join-room', { roomId: 'global_cold' });
    });

    socket.on('action-success', (message) => {
        showAlert(message, 'success');
    });

    socket.on('error', (message) => {
        showAlert(message, 'error');
    });

    socket.on('message-error', (message) => {
        showAlert(message, 'error');
    });

    socket.on('banned', (data) => {
        showAlert(`Banned: ${data.reason}`, 'error');
        setTimeout(() => logout(true), 3000);
    });

    socket.on('account-deleted', (data) => {
        showAlert(data.message, 'error');
        setTimeout(() => logout(true), 2000);
    });

    socket.on('settings-updated', (settings) => {
        systemSettings = settings;
        applySiteSettings();
        showAlert('Settings updated', 'info');
    });

    socket.on('support-message-sent', (data) => {
        showAlert(data.message, 'success');
    });

    socket.on('support-messages-list', (messages) => {
        displaySupportMessages(messages);
    });

    socket.on('muted-list', (list) => {
        displayMutedList(list);
    });

    socket.on('banned-list', (list) => {
        displayBannedList(list);
    });
}

// تسجيل الدخول
function handleLoginSuccess(data) {
    currentUser = data.user;
    currentRoom = data.room.id;
    systemSettings = data.systemSettings;

    document.getElementById('current-user-name').textContent = currentUser.displayName;
    document.getElementById('current-user-avatar').textContent = currentUser.avatar;
    updateUserBadges();

    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('chat-screen').classList.add('active');

    hideLoading();
    showAlert(`Welcome ${currentUser.displayName}!`, 'success');

    clearMessages();
    data.room.messages.forEach(msg => addMessage(msg));

    document.getElementById('message-input').disabled = false;
    document.querySelector('#message-form button').disabled = false;

    socket.emit('get-rooms');
    socket.emit('get-users', { roomId: currentRoom });

    if (currentUser.isOwner) {
        document.getElementById('owner-panel-btn').style.display = 'inline-block';
    }

    applySiteSettings();
    startHeartbeat();
    createSnowfall();
    drawSnowman();
}

function handleRoomJoined(data) {
    currentRoom = data.room.id;
    document.getElementById('room-info').textContent = data.room.name;
    
    clearMessages();
    data.room.messages.forEach(msg => addMessage(msg));
    
    document.getElementById('message-input').disabled = false;
    document.querySelector('#message-form button').disabled = false;
    
    socket.emit('get-users', { roomId: currentRoom });
    scrollToBottom();
}

// تسجيل الدخول والتسجيل
window.login = function() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!username || !password) {
        showAlert('Please enter all fields', 'error');
        return;
    }

    showLoading('Logging in...');
    socket.emit('login', { username, password });
};

window.register = function() {
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value.trim();
    const displayName = document.getElementById('register-displayname').value.trim();

    if (!username || !password || !displayName) {
        showAlert('Please fill all fields', 'error');
        return;
    }

    if (username.length < 3 || username.length > 20) {
        showAlert('Username must be 3-20 characters', 'error');
        return;
    }

    if (password.length < 6) {
        showAlert('Password must be 6+ characters', 'error');
        return;
    }

    showLoading('Creating account...');
    socket.emit('register', { username, password, displayName });
};

window.sendSupportMessage = function() {
    const message = document.getElementById('support-message').value.trim();
    
    if (!message) {
        showAlert('Write your message first', 'error');
        return;
    }

    socket.emit('send-support-message', {
        from: document.getElementById('login-username').value || 'Anonymous',
        message: message
    });

    document.getElementById('support-message').value = '';
};

window.logout = function(forced = false) {
    if (forced || confirm('Logout?')) {
        showLoading('Logging out...');
        if (socket) socket.disconnect();
        setTimeout(() => location.reload(), 1000);
    }
};

// إرسال الرسائل
document.addEventListener('DOMContentLoaded', function() {
    const messageForm = document.getElementById('message-form');
    if (messageForm) {
        messageForm.addEventListener('submit', function(e) {
            e.preventDefault();
            sendMessage();
        });
    }

    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        messageInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    document.getElementById('login-password')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') login();
    });
});

function sendMessage() {
    const textarea = document.getElementById('message-input');
    const text = textarea.value.trim();

    if (!text) return;

    socket.emit('send-message', { text: text, roomId: currentRoom });
    textarea.value = '';
}

// عرض الرسائل
function addMessage(message) {
    const container = document.getElementById('messages');
    if (!container) return;

    const welcomeMsg = container.querySelector('.welcome-message');
    if (welcomeMsg) welcomeMsg.remove();

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.isOwner ? 'owner-message' : ''}`;
    messageDiv.setAttribute('data-message-id', message.id);

    let badges = '';
    if (message.isOwner) {
        badges += '<span class="badge owner-badge">👑</span>';
    } else if (message.isModerator) {
        badges += '<span class="badge moderator-badge">⭐</span>';
    }

    messageDiv.innerHTML = `
        <div class="message-header">
            <div>
                <span class="message-user">${escapeHtml(message.avatar)} ${escapeHtml(message.username)}</span>
                ${badges}
            </div>
        </div>
        <div class="message-text">${escapeHtml(message.text)}</div>
        <div class="message-footer">
            <span class="message-time">${message.timestamp}</span>
        </div>
    `;

    if (message.userId !== currentUser?.id) {
        messageDiv.style.cursor = 'pointer';
        messageDiv.addEventListener('click', () => {
            selectedUserId = message.userId;
            selectedUsername = message.username;
            showMessageActions(message);
        });
    }

    container.appendChild(messageDiv);
    scrollToBottom();
}

function showMessageActions(message) {
    const actions = [];

    // خيار تغيير الاسم للمستخدم نفسه
    if (message.userId === currentUser?.id) {
        actions.push({ text: '✏️ Change My Name', action: () => changeName() });
    }

    // خيارات المالك
    if (currentUser?.isOwner) {
        actions.push({ text: '👑 Add Moderator', action: () => addModerator() });
        actions.push({ text: '🔇 Mute', action: () => muteUser() });
        actions.push({ text: '🚫 Ban', action: () => banUser() });
        actions.push({ text: '🗑️ Delete Account', action: () => deleteAccount() });
        actions.push({ text: '❌ Delete Message', action: () => deleteMessage(message.id) });
    } else if (currentUser?.isModerator) {
        actions.push({ text: '🔇 Mute', action: () => muteUser() });
    }

    actions.push({ text: '💬 Private Message', action: () => openPrivateChat(selectedUserId) });
    actions.push({ text: '❌ Cancel', action: () => {} });

    showActionsMenu(actions);
}

function showActionsMenu(actions) {
    const menu = document.getElementById('message-actions-menu');
    const list = document.getElementById('message-actions-list');
    
    list.innerHTML = '';
    
    actions.forEach(action => {
        const btn = document.createElement('button');
        btn.className = 'action-menu-btn';
        btn.textContent = action.text;
        btn.onclick = () => {
            menu.style.display = 'none';
            action.action();
        };
        list.appendChild(btn);
    });

    menu.style.display = 'block';

    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.style.display = 'none';
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 100);
}

// إجراءات المستخدمين
window.changeName = function() {
    const newName = prompt('Enter new display name:', currentUser.displayName);
    if (newName && newName.trim()) {
        socket.emit('change-display-name', { newName: newName.trim() });
    }
};

window.muteUser = function() {
    const duration = prompt(`Mute duration for ${selectedUsername} (minutes, 0=permanent):`, '10');
    if (duration === null) return;
    
    const reason = prompt('Reason:', 'Rule violation');
    if (!reason) return;

    socket.emit('mute-user', {
        userId: selectedUserId,
        username: selectedUsername,
        duration: parseInt(duration),
        reason: reason
    });
};

window.banUser = function() {
    if (!confirm(`Ban ${selectedUsername} permanently?`)) return;
    
    const reason = prompt('Reason:', 'Serious violation');
    if (!reason) return;

    socket.emit('ban-user', {
        userId: selectedUserId,
        username: selectedUsername,
        reason: reason
    });
};

window.deleteAccount = function() {
    if (!confirm(`Delete account ${selectedUsername} permanently?`)) return;

    socket.emit('delete-account', {
        userId: selectedUserId
    });
};

window.addModerator = function() {
    if (!confirm(`Add ${selectedUsername} as moderator?`)) return;
    
    socket.emit('add-moderator', {
        userId: selectedUserId,
        username: selectedUsername,
        roomId: currentRoom
    });
};

function deleteMessage(messageId) {
    if (!confirm('Delete this message?')) return;
    
    socket.emit('delete-message', {
        messageId: messageId,
        roomId: currentRoom
    });
}

// الرسائل الخاصة
window.showPrivateMessages = function() {
    document.getElementById('private-messages-modal').classList.add('active');
    loadPrivateUsersList();
};

function loadPrivateUsersList() {
    socket.emit('get-users', { roomId: currentRoom });
}

function openPrivateChat(userId) {
    currentPrivateChatUser = userId;
    socket.emit('get-private-messages', { withUserId: userId });
    document.getElementById('private-messages-modal').classList.add('active');
}

window.sendPrivateMessage = function() {
    const input = document.getElementById('private-message-input');
    const text = input.value.trim();
    
    if (!text || !currentPrivateChatUser) return;

    socket.emit('send-private-message', {
        toUserId: currentPrivateChatUser,
        text: text
    });

    input.value = '';
};

function displayPrivateMessages(messages) {
    const container = document.getElementById('private-messages');
    if (!container) return;

    container.innerHTML = '';

    messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = 'message';
        div.innerHTML = `
            <div class="message-header">
                <span class="message-user">${escapeHtml(msg.fromName)}</span>
            </div>
            <div class="message-text">${escapeHtml(msg.text)}</div>
            <div class="message-footer">
                <span class="message-time">${msg.timestamp}</span>
            </div>
        `;
        container.appendChild(div);
    });

    container.scrollTop = container.scrollHeight;
}

function addPrivateMessage(message) {
    const container = document.getElementById('private-messages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'message';
    div.innerHTML = `
        <div class="message-header">
            <span class="message-user">${escapeHtml(message.fromName)}</span>
        </div>
        <div class="message-text">${escapeHtml(message.text)}</div>
        <div class="message-footer">
            <span class="message-time">${message.timestamp}</span>
        </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// إدارة الغرف
window.showCreateRoomModal = function() {
    document.getElementById('create-room-modal').classList.add('active');
};

window.createRoom = function() {
    const name = document.getElementById('room-name-input').value.trim();
    const description = document.getElementById('room-desc-input').value.trim();
    const password = document.getElementById('room-pass-input').value.trim();

    if (!name) {
        showAlert('Enter room name', 'error');
        return;
    }

    socket.emit('create-room', { name, description, password });
    
    document.getElementById('room-name-input').value = '';
    document.getElementById('room-desc-input').value = '';
    document.getElementById('room-pass-input').value = '';
};

window.joinRoom = function(roomId) {
    showLoading('Joining...');
    socket.emit('join-room', { roomId: roomId });
    setTimeout(() => hideLoading(), 1000);
};

window.toggleRoomsList = function() {
    const sidebar = document.getElementById('rooms-sidebar');
    const usersSidebar = document.getElementById('users-sidebar');
    
    sidebar.classList.toggle('active');
    usersSidebar.classList.remove('active');
};

window.toggleUsersList = function() {
    const sidebar = document.getElementById('users-sidebar');
    const roomsSidebar = document.getElementById('rooms-sidebar');
    
    sidebar.classList.toggle('active');
    roomsSidebar.classList.remove('active');
};

function updateRoomsList(rooms) {
    const container = document.getElementById('rooms-list');
    if (!container) return;

    container.innerHTML = '';

    rooms.forEach(room => {
        const div = document.createElement('div');
        div.className = 'room-item';
        
        const lock = room.hasPassword ? '🔒 ' : '';
        const official = room.isOfficial ? '⭐ ' : '';

        div.innerHTML = `
            <div class="room-item-name">${official}${lock}${escapeHtml(room.name)}</div>
            <div class="room-item-desc">${escapeHtml(room.description)}</div>
            <div class="room-item-info">
                <span>👥 ${room.userCount}</span>
                <span>${escapeHtml(room.createdBy)}</span>
            </div>
        `;

        div.onclick = () => joinRoom(room.id);

        // إضافة خيارات للمالك عند الضغط المطول
        if (currentUser?.isOwner && !room.isOfficial) {
            div.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showRoomActions(room.id);
            });
        }

        container.appendChild(div);
    });
}

function showRoomActions(roomId) {
    const actions = [
        { text: '🔇 Silence Room', action: () => silenceRoom(roomId) },
        { text: '🔊 Unsilence Room', action: () => unsilenceRoom(roomId) },
        { text: '🧹 Clean Chat', action: () => cleanChat(roomId) },
        { text: '🗑️ Delete Room', action: () => deleteRoom(roomId) },
        { text: '❌ Cancel', action: () => {} }
    ];
    showActionsMenu(actions);
}

function silenceRoom(roomId) {
    if (confirm('Silence this room?')) {
        socket.emit('silence-room', { roomId: roomId });
    }
}

function unsilenceRoom(roomId) {
    socket.emit('unsilence-room', { roomId: roomId });
}

function cleanChat(roomId) {
    if (confirm('Clean all messages in this room?')) {
        socket.emit('clean-chat', { roomId: roomId });
    }
}

function deleteRoom(roomId) {
    if (confirm('Delete this room permanently?')) {
        socket.emit('delete-room', { roomId: roomId });
    }
}

function updateUsersList(users) {
    const container = document.getElementById('users-list');
    if (!container) return;

    document.getElementById('users-count').textContent = users.length;
    container.innerHTML = '';

    users.forEach(user => {
        if (user.id === currentUser?.id) return;

        const div = document.createElement('div');
        div.className = 'user-item';

        let badges = '';
        if (user.isOwner) badges += '<span class="badge owner-badge">👑</span>';
        else if (user.isModerator) badges += '<span class="badge moderator-badge">⭐</span>';

        div.innerHTML = `
            <div class="user-avatar-wrapper">
                <div class="user-avatar">${escapeHtml(user.avatar)}</div>
                ${user.isOnline ? '<span class="online-indicator"></span>' : ''}
            </div>
            <div class="user-info">
                <div class="user-name">${escapeHtml(user.displayName)} ${badges}</div>
            </div>
        `;

        div.onclick = () => {
            selectedUserId = user.id;
            selectedUsername = user.displayName;
            openPrivateChat(user.id);
        };

        container.appendChild(div);
    });
}

function updateUserBadges() {
    const container = document.getElementById('user-badges');
    if (!container) return;

    let badges = '';
    
    if (currentUser.isOwner) {
        badges += '<span class="badge owner-badge">👑 Owner</span>';
    }

    container.innerHTML = badges;
}

// لوحة المالك
window.showOwnerPanel = function() {
    document.getElementById('owner-panel-modal').classList.add('active');
    switchOwnerTab('muted');
};

window.switchOwnerTab = function(tabName) {
    document.querySelectorAll('.owner-tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    document.getElementById(`owner-${tabName}`).classList.add('active');
    event.target.classList.add('active');

    if (tabName === 'muted') {
        socket.emit('get-muted-list');
    } else if (tabName === 'banned') {
        socket.emit('get-banned-list');
    } else if (tabName === 'support') {
        socket.emit('get-support-messages');
    } else if (tabName === 'settings') {
        loadSettings();
    }
};

function displayMutedList(list) {
    const container = document.getElementById('muted-list');
    if (!container) return;

    container.innerHTML = '';

    if (list.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 2rem;">No muted users</div>';
        return;
    }

    list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'owner-item';

        const timeLeft = item.temporary && item.expires ? 
            Math.ceil((item.expires - Date.now()) / 60000) + ' min' : 'Permanent';

        div.innerHTML = `
            <div class="owner-item-header">
                <div>
                    <strong>${escapeHtml(item.username)}</strong><br>
                    <small>By: ${escapeHtml(item.mutedBy)}</small>
                </div>
                <div class="owner-item-actions">
                    <button class="modern-btn small" onclick="unmute('${item.userId}')">Unmute</button>
                </div>
            </div>
            <div>
                <small>Reason: ${escapeHtml(item.reason)}</small><br>
                <small>Duration: ${timeLeft}</small>
            </div>
        `;

        container.appendChild(div);
    });
}

function displayBannedList(list) {
    const container = document.getElementById('banned-list');
    if (!container) return;

    container.innerHTML = '';

    if (list.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 2rem;">No banned users</div>';
        return;
    }

    list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'owner-item';

        div.innerHTML = `
            <div class="owner-item-header">
                <div>
                    <strong>${escapeHtml(item.username)}</strong><br>
                    <small>By: ${escapeHtml(item.bannedBy)}</small>
                </div>
                <div class="owner-item-actions">
                    <button class="modern-btn small" onclick="unban('${item.userId}')">Unban</button>
                </div>
            </div>
            <div>
                <small>Reason: ${escapeHtml(item.reason)}</small><br>
                <small>Date: ${new Date(item.bannedAt).toLocaleString()}</small>
            </div>
        `;

        container.appendChild(div);
    });
}

function displaySupportMessages(messages) {
    const container = document.getElementById('support-messages-list');
    if (!container) return;

    container.innerHTML = '';

    if (messages.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 2rem;">No support messages</div>';
        return;
    }

    messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = 'owner-item';

        div.innerHTML = `
            <div class="owner-item-header">
                <div>
                    <strong>${escapeHtml(msg.from)}</strong><br>
                    <small>${new Date(msg.sentAt).toLocaleString()}</small>
                </div>
                <div class="owner-item-actions">
                    <button class="modern-btn small" onclick="deleteSupportMessage('${msg.id}')">Delete</button>
                </div>
            </div>
            <div style="margin-top: 1rem; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 10px;">
                ${escapeHtml(msg.message)}
            </div>
        `;

        container.appendChild(div);
    });
}

window.unmute = function(userId) {
    if (confirm('Unmute this user?')) {
        socket.emit('unmute-user', { userId: userId });
        setTimeout(() => socket.emit('get-muted-list'), 500);
    }
};

window.unban = function(userId) {
    if (confirm('Unban this user?')) {
        socket.emit('unban-user', { userId: userId });
        setTimeout(() => socket.emit('get-banned-list'), 500);
    }
};

window.deleteSupportMessage = function(messageId) {
    if (confirm('Delete this message?')) {
        socket.emit('delete-support-message', { messageId: messageId });
        setTimeout(() => socket.emit('get-support-messages'), 500);
    }
};

function loadSettings() {
    document.getElementById('setting-logo').value = systemSettings.siteLogo || '';
    document.getElementById('setting-title').value = systemSettings.siteTitle || '';
    document.getElementById('setting-music').value = systemSettings.backgroundMusic || '';
}

window.updateLogo = function() {
    const logo = document.getElementById('setting-logo').value.trim();
    if (!logo) {
        showAlert('Enter logo URL', 'error');
        return;
    }
    socket.emit('update-settings', { siteLogo: logo });
};

window.updateTitle = function() {
    const title = document.getElementById('setting-title').value.trim();
    if (!title) {
        showAlert('Enter title', 'error');
        return;
    }
    socket.emit('update-settings', { siteTitle: title });
};

window.updateMusic = function() {
    const music = document.getElementById('setting-music').value.trim();
    socket.emit('update-settings', { backgroundMusic: music });
};

function applySiteSettings() {
    // تحديث الشعار
    document.querySelectorAll('#main-logo, #header-logo, #site-favicon').forEach(el => {
        if (el.tagName === 'IMG') {
            el.src = systemSettings.siteLogo;
        } else if (el.tagName === 'LINK') {
            el.href = systemSettings.siteLogo;
        }
    });

    // تحديث العنوان
    document.getElementById('site-title').textContent = systemSettings.siteTitle;
    document.getElementById('main-title').textContent = systemSettings.siteTitle;
    document.getElementById('header-title').textContent = systemSettings.siteTitle;

    // تشغيل الموسيقى
    const audio = document.getElementById('background-music');
    if (systemSettings.backgroundMusic) {
        audio.src = systemSettings.backgroundMusic;
        audio.play().catch(() => {});
    } else {
        audio.pause();
        audio.src = '';
    }
}

// النوافذ
window.hideModal = function(modalId) {
    document.getElementById(modalId).classList.remove('active');
};

function clearMessages() {
    const container = document.getElementById('messages');
    if (container) {
        container.innerHTML = `
            <div class="welcome-message glass-card">
                <img src="${systemSettings.siteLogo}" alt="Welcome" class="welcome-logo">
                <h3>Welcome to ${systemSettings.siteTitle}! ❄️</h3>
                <p>Start chatting</p>
            </div>
        `;
    }
}

function scrollToBottom() {
    const container = document.getElementById('messages');
    if (container) {
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 100);
    }
}

// الدوال المساعدة
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showAlert(message, type = 'info') {
    const colors = {
        error: '#dc2626',
        success: '#10b981',
        warning: '#f59e0b',
        info: '#4a90e2'
    };
    
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type]};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        z-index: 10000;
        font-weight: 600;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        max-width: 400px;
        animation: slideIn 0.3s ease-out;
    `;
    alertDiv.textContent = message;
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => alertDiv.remove(), 300);
    }, 4000);
}

function showNotification(message) {
    const div = document.createElement('div');
    div.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: rgba(74, 144, 226, 0.9);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        z-index: 9999;
        animation: slideIn 0.3s ease-out;
    `;
    div.textContent = message;
    document.body.appendChild(div);
    
    setTimeout(() => {
        div.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => div.remove(), 300);
    }, 3000);
}

function showLoading(message = 'Loading...') {
    let div = document.getElementById('loading-overlay');
    
    if (!div) {
        div = document.createElement('div');
        div.id = 'loading-overlay';
        div.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(10px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            color: white;
        `;
        document.body.appendChild(div);
    }
    
    div.innerHTML = `
        <div style="text-align: center;">
            <div class="spinner"></div>
            <div style="margin-top: 1.5rem; font-size: 1.2rem; font-weight: 600;">${message}</div>
        </div>
    `;
}

function hideLoading() {
    const div = document.getElementById('loading-overlay');
    if (div) div.remove();
}

function startHeartbeat() {
    setInterval(() => {
        if (socket && socket.connected) {
            socket.emit('ping');
        }
    }, 30000);
}

// تساقط الثلوج
function createSnowfall() {
    const container = document.getElementById('snowflakes');
    if (!container) return;
    
    container.innerHTML = '';
    
    for (let i = 0; i < 50; i++) {
        const snowflake = document.createElement('div');
        snowflake.className = 'snowflake';
        snowflake.textContent = '❄';
        snowflake.style.cssText = `
            left: ${Math.random() * 100}%;
            animation-duration: ${Math.random() * 3 + 2}s;
            animation-delay: ${Math.random() * 5}s;
            font-size: ${Math.random() * 10 + 10}px;
        `;
        container.appendChild(snowflake);
    }
}

// رسم رجل الثلج
function drawSnowman() {
    const canvas = document.getElementById('snowman-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = 200;
    canvas.height = 250;

    // الجسم
    ctx.fillStyle = 'white';
    
    // الكرة السفلية
    ctx.beginPath();
    ctx.arc(100, 180, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4a90e2';
    ctx.lineWidth = 2;
    ctx.stroke();

    // الكرة الوسطى
    ctx.beginPath();
    ctx.arc(100, 110, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // الرأس
    ctx.beginPath();
    ctx.arc(100, 50, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // العيون
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(90, 45, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(110, 45, 3, 0, Math.PI * 2);
    ctx.fill();

    // الأنف
    ctx.fillStyle = 'orange';
    ctx.beginPath();
    ctx.moveTo(100, 50);
    ctx.lineTo(120, 50);
    ctx.lineTo(100, 55);
    ctx.fill();

    // الفم
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(100, 60, 10, 0, Math.PI);
    ctx.stroke();

    // الأزرار
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(100, 100, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(100, 115, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(100, 130, 4, 0, Math.PI * 2);
    ctx.fill();

    // تحريك بسيط
    let y = 0;
    let direction = 1;
    setInterval(() => {
        y += direction * 0.5;
        if (y > 10 || y < -10) direction *= -1;
        canvas.style.transform = `translateX(-50%) translateY(${y}px)`;
    }, 50);
}

// CSS للأنيميشن
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);

// التهيئة
document.addEventListener('DOMContentLoaded', function() {
    console.log('❄️ Cold Room Ready');
    initializeSocket();
    createSnowfall();
    drawSnowman();
});

console.log('✅ Script loaded successfully');
