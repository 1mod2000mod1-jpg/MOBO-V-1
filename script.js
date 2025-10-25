// 🚀 نظام MOBO العالمي - النظام الأمامي الأقوى © 2025
let socket = null;
let currentUser = null;
let currentRoom = null;
let systemSettings = {};
let selectedUserId = null;
let selectedUsername = null;
let selectedMessageId = null;
let usersList = [];
let roomsList = [];
let privateConversations = new Map();
let currentPrivateChat = null;

// ═══════════════════ إنشاء الاتصال ═══════════════════
function initializeSocket() {
    try {
        socket = io({
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 10,
            timeout: 20000
        });

        setupSocketListeners();
    } catch (error) {
        console.error('خطأ في الاتصال:', error);
        showAlert('فشل الاتصال بالخادم', 'error');
    }
}

// ═══════════════════ إعداد مستمعي الأحداث ═══════════════════
function setupSocketListeners() {
    socket.on('connect', () => {
        console.log('✅ تم الاتصال بالخادم');
        hideLoading();
    });

    socket.on('disconnect', (reason) => {
        console.log('⚠️ انقطع الاتصال:', reason);
        showAlert('انقطع الاتصال بالخادم...', 'warning');
    });

    socket.on('reconnect', () => {
        showAlert('تم إعادة الاتصال', 'success');
        if (currentUser && currentRoom) {
            socket.emit('join-room', { roomId: currentRoom });
        }
    });

    // تسجيل الدخول
    socket.on('login-success', handleLoginSuccess);
    socket.on('login-error', (message) => {
        hideLoading();
        showAlert(message, 'error');
    });

    socket.on('banned-user', (data) => {
        hideLoading();
        showAlert(`تم حظرك: ${data.reason}`, 'error');
        document.getElementById('support-section').style.display = 'block';
    });

    // التسجيل
    socket.on('register-success', (data) => {
        hideLoading();
        showAlert(data.message, 'success');
        document.getElementById('login-username').value = data.username;
        document.getElementById('login-username').focus();
    });

    socket.on('register-error', (message) => {
        hideLoading();
        showAlert(message, 'error');
    });

    // الرسائل
    socket.on('new-message', (message) => {
        addMessage(message);
        playNotificationSound();
    });

    socket.on('message-deleted', (messageId) => {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            messageElement.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => messageElement.remove(), 300);
        }
    });

    socket.on('chat-cleaned', (data) => {
        showAlert(data.message, 'info');
    });

    // الغرف
    socket.on('room-joined', handleRoomJoined);
    socket.on('room-created', (data) => {
        showAlert(data.message, 'success');
        socket.emit('join-room', { roomId: data.roomId });
        hideModal('create-room-modal');
    });

    socket.on('room-password-required', (data) => {
        const password = prompt(`أدخل كلمة سر الغرفة: ${data.roomName}`);
        if (password) {
            socket.emit('join-room', { roomId: data.roomId, password: password });
        }
    });

    socket.on('room-silenced', (data) => {
        showAlert(data.message, 'warning');
    });

    socket.on('room-unsilenced', (data) => {
        showAlert(data.message, 'success');
    });

    socket.on('room-deleted', (data) => {
        showAlert(`تم حذف الغرفة: ${data.roomName}`, 'warning');
    });

    socket.on('room-chat-cleaned', (data) => {
        clearMessages();
        showAlert(data.message, 'info');
    });

    // المستخدمين
    socket.on('users-list', updateUsersList);
    socket.on('rooms-list', updateRoomsList);

    socket.on('user-joined-room', (data) => {
        showNotification(`${data.username} ${data.avatar} انضم إلى ${data.roomName}`, 'info');
    });

    socket.on('user-muted', (data) => {
        showAlert(`تم كتم ${data.username} ${data.duration === 'دائم' ? 'بشكل دائم' : 'لمدة ' + data.duration + ' دقيقة'}`, 'warning');
    });

    socket.on('moderator-added', (data) => {
        showAlert(`تم إضافة ${data.username} كمشرف في ${data.roomName}`, 'success');
    });

    // الرسائل الخاصة
    socket.on('new-private-message', (message) => {
        handleNewPrivateMessage(message);
        playNotificationSound();
    });

    socket.on('private-message-sent', (message) => {
        if (currentPrivateChat === message.receiverId) {
            displayPrivateMessage(message);
        }
    });

    // رسائل الدعم
    socket.on('support-message-sent', (message) => {
        showAlert(message, 'success');
    });

    socket.on('support-reply', (data) => {
        showAlert(`رد الزعيم: ${data.reply}`, 'success');
    });

    socket.on('new-support-message', (message) => {
        if (currentUser?.isSupremeLeader) {
            showAlert('رسالة دعم جديدة!', 'info');
        }
    });

    // القوائم الإدارية
    socket.on('muted-list', updateMutedList);
    socket.on('banned-list', updateBannedList);
    socket.on('support-messages-list', updateSupportMessagesList);

    // إعدادات النظام
    socket.on('system-setting-changed', (data) => {
        systemSettings[data.setting] = data.value;
        applySystemSettings();
    });

    socket.on('system-color-changed', (data) => {
        changeThemeColor(data.color);
    });

    socket.on('system-logo-changed', (data) => {
        updateSiteLogo(data.logo);
    });

    socket.on('system-title-changed', (data) => {
        updateSiteTitle(data.title);
    });

    socket.on('system-notification', (data) => {
        showAlert(data.message, 'info');
    });

    // أحداث عامة
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
        showAlert(`تم حظرك: ${data.reason}`, 'error');
        setTimeout(() => logout(), 3000);
    });

    socket.on('account-deleted', (message) => {
        showAlert(message, 'error');
        setTimeout(() => logout(), 2000);
    });

    // صور
    socket.on('image-uploaded', (data) => {
        showAlert('تم رفع الصورة بنجاح', 'success');
    });

    socket.on('new-image-message', (data) => {
        addImageMessage(data);
    });

    socket.on('image-deleted', (imageId) => {
        const imageElement = document.querySelector(`[data-image-id="${imageId}"]`);
        if (imageElement) {
            imageElement.remove();
        }
    });
}

// ═══════════════════ معالجة تسجيل الدخول ═══════════════════
function handleLoginSuccess(data) {
    currentUser = data.user;
    currentRoom = data.room.id;
    systemSettings = data.systemSettings;

    document.getElementById('current-user-name').textContent = currentUser.displayName;
    document.getElementById('current-user-avatar').textContent = currentUser.customAvatar || currentUser.avatar;
    updateUserBadges();

    applySystemSettings();

    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('chat-screen').classList.add('active');

    hideLoading();
    showAlert(`🎉 مرحباً ${currentUser.displayName}!`, 'success');

    clearMessages();
    data.room.messages.forEach(msg => addMessage(msg));

    socket.emit('get-rooms');
    socket.emit('get-users', { roomId: currentRoom });

    if (currentUser.isSupremeLeader) {
        document.getElementById('supreme-panel-btn').style.display = 'inline-block';
    }

    startHeartbeat();
    createAnimations();
}

// ═══════════════════ معالجة الانضمام للغرفة ═══════════════════
function handleRoomJoined(data) {
    currentRoom = data.room.id;
    document.getElementById('room-info').textContent = data.room.name;

    clearMessages();
    data.room.messages.forEach(msg => addMessage(msg));

    document.getElementById('message-input').disabled = false;
    document.querySelector('#message-form button').disabled = false;
    document.getElementById('message-input').focus();

    socket.emit('get-users', { roomId: currentRoom });
    socket.emit('get-rooms');
}

// ═══════════════════ تسجيل الدخول ═══════════════════
window.login = function() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!username || !password) {
        showAlert('الرجاء إدخال جميع البيانات', 'error');
        return;
    }

    showLoading('جاري تسجيل الدخول...');
    socket.emit('login', { username, password });
};

// ═══════════════════ التسجيل ═══════════════════
window.register = function() {
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value.trim();
    const displayName = document.getElementById('register-displayname').value.trim();
    const gender = document.getElementById('register-gender').value;
    const emoji = document.getElementById('register-emoji').value;

    if (!username || !password || !displayName) {
        showAlert('الرجاء ملء جميع الحقول', 'error');
        return;
    }

    if (username.length < 3 || username.length > 20) {
        showAlert('اسم المستخدم يجب أن يكون بين 3-20 حرف', 'error');
        return;
    }

    if (password.length < 6) {
        showAlert('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
        return;
    }

    showLoading('جاري إنشاء الحساب...');
    socket.emit('register', { username, password, displayName, gender, emoji });
};

// ═══════════════════ إرسال رسالة ═══════════════════
document.getElementById('message-form')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const textarea = document.getElementById('message-input');
    const text = textarea.value.trim();

    if (!text) return;

    if (text.length > 300) {
        showAlert('الرسالة طويلة جداً (الحد الأقصى 300 حرف)', 'error');
        return;
    }

    socket.emit('send-message', { text: text, roomId: currentRoom });
    textarea.value = '';
    textarea.style.height = 'auto';
});

// تكبير textarea تلقائياً
document.getElementById('message-input')?.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

// ═══════════════════ تسجيل الخروج ═══════════════════
window.logout = function() {
    if (confirm('هل تريد تسجيل الخروج؟')) {
        showLoading('جاري تسجيل الخروج...');
        if (socket) socket.disconnect();
        setTimeout(() => location.reload(), 1000);
    }
};

// ═══════════════════ إضافة رسالة ═══════════════════
function addMessage(message) {
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.isSupremeLeader ? 'supreme-message' : ''} ${message.glowing ? 'glowing-message' : ''}`;
    messageDiv.setAttribute('data-message-id', message.id);
    messageDiv.setAttribute('data-user-id', message.userId);

    let badges = '';
    if (message.isSupremeLeader) {
        badges += '<span class="badge supreme-badge">👑 الزعيم</span>';
    } else if (message.isSuperAdmin) {
        badges += '<span class="badge admin-badge">🔧 أدمن</span>';
    }
    if (message.isModerator) {
        badges += '<span class="badge moderator-badge">⭐ مشرف</span>';
    }
    if (message.isVerified) {
        badges += '<span class="badge verified-badge">✅</span>';
    }
    if (message.specialBadges) {
        message.specialBadges.forEach(badge => {
            badges += `<span class="badge">${badge}</span>`;
        });
    }

    messageDiv.innerHTML = `
        <div class="message-header">
            <div>
                <span class="user-avatar-small">${escapeHtml(message.avatar)}</span>
                <span class="message-user">${escapeHtml(message.username)}</span>
            </div>
            <div>${badges}</div>
        </div>
        <div class="message-text">${escapeHtml(message.text)}</div>
        <div class="message-footer">
            <span class="message-time">${message.timestamp}</span>
        </div>
    `;

    // إضافة حدث الضغط للإجراءات
    if (message.userId !== currentUser.id) {
        messageDiv.style.cursor = 'pointer';
        messageDiv.addEventListener('click', () => {
            showMessageActions(message);
        });
    }

    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

// ═══════════════════ إضافة رسالة صورة ═══════════════════
function addImageMessage(data) {
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.setAttribute('data-image-id', data.imageId);

    messageDiv.innerHTML = `
        <div class="message-header">
            <div>
                <span class="user-avatar-small">${escapeHtml(data.uploaderAvatar)}</span>
                <span class="message-user">${escapeHtml(data.uploaderName)}</span>
            </div>
        </div>
        <div class="message-image">
            <img src="${data.imageUrl}" alt="صورة" style="max-width: 100%; border-radius: 10px; margin-top: 0.5rem;">
        </div>
    `;

    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

// ═══════════════════ عرض إجراءات الرسالة ═══════════════════
function showMessageActions(message) {
    selectedUserId = message.userId;
    selectedUsername = message.username;
    selectedMessageId = message.id;

    const actions = [];

    if (currentUser.isSupremeLeader) {
        actions.push({ text: '👑 إضافة كمشرف', action: 'addModerator' });
        actions.push({ text: '🔇 كتم المستخدم', action: 'muteUser' });
        actions.push({ text: '🚫 حظر المستخدم', action: 'banUser' });
        actions.push({ text: '🗑️ حذف الرسالة', action: 'deleteMessage' });
        actions.push({ text: '⭐ إضافة شارة', action: 'addBadge' });
        actions.push({ text: '✨ رسائل مشعة', action: 'toggleGlowing' });
    } else if (message.isModerator || currentUser.isAdmin) {
        actions.push({ text: '🔇 كتم المستخدم', action: 'muteUser' });
        actions.push({ text: '🚫 حظر المستخدم', action: 'banUser' });
    }

    actions.push({ text: '💬 رسالة خاصة', action: 'sendPrivate' });
    actions.push({ text: '❌ إلغاء', action: 'cancel' });

    showActionsMenu(actions);
}

// ═══════════════════ قائمة الإجراءات ═══════════════════
function showActionsMenu(actions) {
    const menu = document.getElementById('message-actions-menu');
    const actionsList = document.getElementById('message-actions-list');
    
    actionsList.innerHTML = '';
    
    actions.forEach(action => {
        const btn = document.createElement('button');
        btn.className = action.action === 'cancel' ? 'action-menu-btn cancel' : 'action-menu-btn';
        btn.textContent = action.text;
        btn.onclick = () => {
            menu.style.display = 'none';
            if (action.action !== 'cancel') {
                executeAction(action.action);
            }
        };
        actionsList.appendChild(btn);
    });

    menu.style.display = 'block';

    // إغلاق عند الضغط خارج القائمة
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.style.display = 'none';
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 100);
}

// ═══════════════════ تنفيذ الإجراءات ═══════════════════
function executeAction(action) {
    switch(action) {
        case 'addModerator':
            addModerator();
            break;
        case 'muteUser':
            muteUser();
            break;
        case 'banUser':
            banUser();
            break;
        case 'deleteMessage':
            deleteMessage();
            break;
        case 'addBadge':
            addBadge();
            break;
        case 'toggleGlowing':
            toggleGlowing();
            break;
        case 'sendPrivate':
            openPrivateChat(selectedUserId, selectedUsername);
            break;
    }
}

window.addModerator = function() {
    if (!confirm(`إضافة ${selectedUsername} كمشرف في هذه الغرفة؟`)) return;
    socket.emit('add-moderator', {
        userId: selectedUserId,
        username: selectedUsername,
        roomId: currentRoom
    });
};

window.muteUser = function() {
    const duration = prompt(`مدة كتم ${selectedUsername} (بالدقائق، 0 للدائم):`, '10');
    if (duration === null) return;

    const reason = prompt('سبب الكتم:', 'مخالفة');
    if (!reason) return;

    socket.emit('mute-user', {
        userId: selectedUserId,
        username: selectedUsername,
        duration: parseInt(duration),
        reason: reason
    });
};

window.banUser = function() {
    if (!confirm(`هل أنت متأكد من حظر ${selectedUsername}؟`)) return;

    const reason = prompt('سبب الحظر:', 'مخالفة');
    if (!reason) return;

    socket.emit('ban-user', {
        userId: selectedUserId,
        username: selectedUsername,
        reason: reason
    });
};

window.deleteMessage = function() {
    if (!confirm('هل تريد حذف هذه الرسالة؟')) return;

    socket.emit('delete-message', {
        messageId: selectedMessageId,
        roomId: currentRoom
    });
};

window.addBadge = function() {
    const badge = prompt(`أدخل الشارة (إيموجي) لـ ${selectedUsername}:`, '⭐');
    if (!badge) return;

    socket.emit('add-special-badge', {
        userId: selectedUserId,
        badge: badge
    });
};

window.toggleGlowing = function() {
    const enabled = confirm(`تفعيل الرسائل المشعة لـ ${selectedUsername}؟`);
    
    socket.emit('toggle-glowing-messages', {
        userId: selectedUserId,
        enabled: enabled
    });
};

// ═══════════════════ إنشاء غرفة ═══════════════════
window.showCreateRoomModal = function() {
    document.getElementById('create-room-modal').classList.add('active');
};

window.createRoom = function() {
    const name = document.getElementById('room-name-input').value.trim();
    const description = document.getElementById('room-desc-input').value.trim();
    const password = document.getElementById('room-pass-input').value.trim();

    if (!name) {
        showAlert('الرجاء إدخال اسم الغرفة', 'error');
        return;
    }

    socket.emit('create-room', {
        name: name,
        description: description,
        password: password
    });

    document.getElementById('room-name-input').value = '';
    document.getElementById('room-desc-input').value = '';
    document.getElementById('room-pass-input').value = '';
};

// ═══════════════════ الانضمام لغرفة ═══════════════════
window.joinRoom = function(roomId) {
    socket.emit('join-room', { roomId: roomId });
};

// ═══════════════════ تبديل القوائم الجانبية ═══════════════════
window.toggleRoomsList = function() {
    const sidebar = document.getElementById('rooms-sidebar');
    const usersSidebar = document.getElementById('users-sidebar');
    
    sidebar.classList.toggle('active');
    if (usersSidebar.classList.contains('active')) {
        usersSidebar.classList.remove('active');
    }
};

window.toggleUsersList = function() {
    const sidebar = document.getElementById('users-sidebar');
    const roomsSidebar = document.getElementById('rooms-sidebar');
    
    sidebar.classList.toggle('active');
    if (roomsSidebar.classList.contains('active')) {
        roomsSidebar.classList.remove('active');
    }
};

// ═══════════════════ تحديث القوائم ═══════════════════
function updateRoomsList(rooms) {
    roomsList = rooms;
    const container = document.getElementById('rooms-list');
    if (!container) return;

    container.innerHTML = '';

    rooms.forEach(room => {
        const roomDiv = document.createElement('div');
        roomDiv.className = 'room-item';
        roomDiv.onclick = () => joinRoom(room.id);

        const lockIcon = room.hasPassword ? '🔒 ' : '';
        const officialIcon = room.isOfficial ? '⭐ ' : '';

        roomDiv.innerHTML = `
            <div class="room-item-name">${officialIcon}${lockIcon}${escapeHtml(room.name)}</div>
            <div class="room-item-desc">${escapeHtml(room.description)}</div>
            <div class="room-item-info">
                <span>👥 ${room.userCount}</span>
                <span>بواسطة ${escapeHtml(room.createdBy)}</span>
            </div>
        `;

        container.appendChild(roomDiv);
    });
}

function updateUsersList(users) {
    usersList = users;
    const container = document.getElementById('users-list');
    if (!container) return;

    document.getElementById('users-count').textContent = users.length;
    container.innerHTML = '';

    users.forEach(user => {
        if (user.id === currentUser.id) return;

        const userDiv = document.createElement('div');
        userDiv.className = 'user-item';

        let badges = '';
        if (user.isSupremeLeader) {
            badges += '<span class="badge supreme-badge">👑</span>';
        } else if (user.isSuperAdmin) {
            badges += '<span class="badge admin-badge">🔧</span>';
        }
        if (user.isModerator) {
            badges += '<span class="badge moderator-badge">⭐</span>';
        }
        if (user.isVerified) {
            badges += '<span class="badge verified-badge">✅</span>';
        }

        userDiv.innerHTML = `
            <div class="user-avatar-wrapper">
                <div class="user-avatar">${escapeHtml(user.customAvatar || user.avatar)}</div>
                ${user.isOnline ? '<span class="online-indicator"></span>' : ''}
            </div>
            <div class="user-info">
                <div class="user-name">${escapeHtml(user.displayName)} ${badges}</div>
            </div>
        `;

        container.appendChild(userDiv);
    });
}

// ═══════════════════ الرسائل الخاصة ═══════════════════
window.showPrivateMessages = function() {
    document.getElementById('private-messages-modal').classList.add('active');
    updatePrivateUsersList();
};

function updatePrivateUsersList() {
    const container = document.getElementById('private-users-list');
    if (!container) return;

    container.innerHTML = '<h4>اختر مستخدم للمراسلة:</h4>';

    usersList.forEach(user => {
        if (user.id === currentUser.id) return;

        const userBtn = document.createElement('button');
        userBtn.className = 'modern-btn small';
        userBtn.style.width = '100%';
        userBtn.style.marginBottom = '0.5rem';
        userBtn.textContent = `${user.customAvatar || user.avatar} ${user.displayName}`;
        userBtn.onclick = () => openPrivateChat(user.id, user.displayName);

        container.appendChild(userBtn);
    });
}

function openPrivateChat(userId, username) {
    currentPrivateChat = userId;
    const container = document.getElementById('private-messages');
    container.innerHTML = `<h4>محادثة مع: ${username}</h4>`;

    // عرض الرسائل المحفوظة
    const conversation = privateConversations.get(userId) || [];
    conversation.forEach(msg => displayPrivateMessage(msg));

    document.getElementById('private-message-input').focus();
}

function displayPrivateMessage(message) {
    const container = document.getElementById('private-messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = message.senderId === currentUser.id ? 'private-msg sent' : 'private-msg received';
    msgDiv.innerHTML = `
        <div><strong>${message.senderName}:</strong> ${escapeHtml(message.text)}</div>
        <small>${new Date(message.timestamp).toLocaleTimeString('ar-EG')}</small>
    `;
    container.appendChild(msgDiv);
}

window.sendPrivateMessage = function() {
    const input = document.getElementById('private-message-input');
    const text = input.value.trim();

    if (!text || !currentPrivateChat) return;

    socket.emit('send-private-message', {
        receiverId: currentPrivateChat,
        text: text
    });

    input.value = '';
};

function handleNewPrivateMessage(message) {
    if (!privateConversations.has(message.senderId)) {
        privateConversations.set(message.senderId, []);
    }
    privateConversations.get(message.senderId).push(message);

    if (currentPrivateChat === message.senderId) {
        displayPrivateMessage(message);
    } else {
        showAlert(`رسالة خاصة جديدة من ${message.senderName}`, 'info');
    }
}

// ═══════════════════ رسائل الدعم ═══════════════════
window.sendSupportMessage = function() {
    const text = document.getElementById('support-message').value.trim();
    if (!text) {
        showAlert('الرجاء كتابة رسالتك', 'error');
        return;
    }

    socket.emit('send-support-message', { text: text });
    document.getElementById('support-message').value = '';
};

// ═══════════════════ لوحة الزعيم ═══════════════════
window.showSupremePanel = function() {
    document.getElementById('supreme-panel-modal').classList.add('active');
    refreshMutedList();
};

window.switchSupremeTab = function(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.supreme-tab-content').forEach(content => content.classList.remove('active'));

    event.target.classList.add('active');
    document.getElementById(`supreme-${tabName}`).classList.add('active');

    if (tabName === 'muted') refreshMutedList();
    else if (tabName === 'banned') refreshBannedList();
    else if (tabName === 'support') refreshSupportMessages();
    else if (tabName === 'settings') loadSystemSettings();
};

window.refreshMutedList = function() {
    socket.emit('get-muted-list');
};

window.refreshBannedList = function() {
    socket.emit('get-banned-list');
};

window.refreshSupportMessages = function() {
    socket.emit('get-support-messages');
};

function updateMutedList(list) {
    const container = document.getElementById('muted-list');
    if (!container) return;

    container.innerHTML = '';

    if (list.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.5);">لا يوجد مستخدمين مكتومين</p>';
        return;
    }

    list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'supreme-item';

        const canRemove = !item.canOnlyBeRemovedBy || item.canOnlyBeRemovedBy === 'supreme';

        div.innerHTML = `
            <div class="supreme-item-header">
                <div>
                    <strong>${escapeHtml(item.username)}</strong>
                    <div style="color: rgba(255,255,255,0.7); font-size: 0.9rem;">
                        ${item.temporary ? 'مؤقت - متبقي: ' + item.expiresIn + ' دقيقة' : 'دائم'}
                    </div>
                    <div style="color: rgba(255,255,255,0.6); font-size: 0.85rem;">
                        السبب: ${escapeHtml(item.reason)}
                    </div>
                    <div style="color: rgba(255,255,255,0.6); font-size: 0.85rem;">
                        بواسطة: ${escapeHtml(item.mutedBy)}
                    </div>
                </div>
                <div class="supreme-item-actions">
                    ${canRemove ? `<button class="modern-btn small" onclick="unmute('${item.userId}', '${escapeHtml(item.username)}')">🔊 إلغاء الكتم</button>` : '<span style="color: #dc2626;">كتم من الزعيم</span>'}
                </div>
            </div>
        `;

        container.appendChild(div);
    });
}

function updateBannedList(list) {
    const container = document.getElementById('banned-list');
    if (!container) return;

    container.innerHTML = '';

    if (list.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.5);">لا يوجد مستخدمين محظورين</p>';
        return;
    }

    list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'supreme-item';

        div.innerHTML = `
            <div class="supreme-item-header">
                <div>
                    <strong>${escapeHtml(item.username)}</strong>
                    <div style="color: rgba(255,255,255,0.7); font-size: 0.9rem;">
                        السبب: ${escapeHtml(item.reason)}
                    </div>
                    <div style="color: rgba(255,255,255,0.6); font-size: 0.85rem;">
                        بواسطة: ${escapeHtml(item.bannedBy)}
                    </div>
                    <div style="color: rgba(255,255,255,0.6); font-size: 0.85rem;">
                        التاريخ: ${new Date(item.bannedAt).toLocaleString('ar-EG')}
                    </div>
                </div>
                <div class="supreme-item-actions">
                    <button class="modern-btn small" onclick="unban('${item.userId}', '${escapeHtml(item.username)}')">
                        ✅ إلغاء الحظر
                    </button>
                </div>
            </div>
        `;

        container.appendChild(div);
    });
}

function updateSupportMessagesList(list) {
    const container = document.getElementById('support-messages-list');
    if (!container) return;

    container.innerHTML = '';

    if (list.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.5);">لا توجد رسائل دعم</p>';
        return;
    }

    list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'supreme-item';

        div.innerHTML = `
            <div class="supreme-item-header">
                <div>
                    <strong>${escapeHtml(item.username)}</strong>
                    <div style="color: rgba(255,255,255,0.8); margin: 0.5rem 0;">
                        ${escapeHtml(item.text)}
                    </div>
                    <div style="color: rgba(255,255,255,0.6); font-size: 0.85rem;">
                        ${new Date(item.timestamp).toLocaleString('ar-EG')}
                    </div>
                </div>
                <div class="supreme-item-actions">
                    <button class="modern-btn small" onclick="acceptUnbanRequest('${item.id}')">
                        ✅ قبول وإلغاء الحظر
                    </button>
                    <button class="modern-btn small" onclick="deleteSupportMessage('${item.id}')">
                        🗑️ حذف
                    </button>
                </div>
            </div>
        `;

        container.appendChild(div);
    });
}

window.unmute = function(userId, username) {
    if (!confirm(`إلغاء كتم ${username}؟`)) return;
    socket.emit('unmute-user', { userId, username });
    setTimeout(() => refreshMutedList(), 500);
};

window.unban = function(userId, username) {
    if (!confirm(`إلغاء حظر ${username}؟`)) return;
    socket.emit('unban-user', { userId, username });
    setTimeout(() => refreshBannedList(), 500);
};

window.acceptUnbanRequest = function(messageId) {
    if (!confirm('قبول الطلب وإلغاء الحظر؟')) return;
    socket.emit('accept-unban-request', { messageId });
    setTimeout(() => refreshSupportMessages(), 500);
};

window.deleteSupportMessage = function(messageId) {
    if (!confirm('حذف هذه الرسالة؟')) return;
    socket.emit('delete-support-message', { messageId });
    setTimeout(() => refreshSupportMessages(), 500);
};

window.cleanAllSupportMessages = function() {
    if (!confirm('حذف جميع رسائل الدعم؟')) return;
    socket.emit('clean-support-messages', { deleteAll: true });
    setTimeout(() => refreshSupportMessages(), 500);
};

// ═══════════════════ إعدادات النظام ═══════════════════
function loadSystemSettings() {
    socket.emit('get-system-settings');
}

socket.on('system-settings', (settings) => {
    document.getElementById('setting-copy').checked = settings.allowCopy;
    document.getElementById('setting-screenshot').checked = settings.allowScreenshot;
    document.getElementById('setting-color').value = settings.siteColor;
    document.getElementById('setting-logo').value = settings.siteLogo;
    document.getElementById('setting-title').value = settings.siteTitle;
    document.getElementById('social-telegram').value = settings.socialLinks.telegram || '';
    document.getElementById('social-instagram').value = settings.socialLinks.instagram || '';
    document.getElementById('social-youtube').value = settings.socialLinks.youtube || '';
    document.getElementById('social-email').value = settings.socialLinks.email || '';
});

window.updateSystemSetting = function(setting, value) {
    socket.emit('change-system-settings', { setting, value });
};

window.updateLogo = function() {
    const logo = document.getElementById('setting-logo').value.trim();
    if (!logo) {
        showAlert('الرجاء إدخال رابط الشعار', 'error');
        return;
    }
    socket.emit('change-system-settings', { setting: 'siteLogo', value: logo });
};

window.updateTitle = function() {
    const title = document.getElementById('setting-title').value.trim();
    if (!title) {
        showAlert('الرجاء إدخال عنوان الموقع', 'error');
        return;
    }
    socket.emit('change-system-settings', { setting: 'siteTitle', value: title });
};

window.updateSocialLinks = function() {
    const links = {
        telegram: document.getElementById('social-telegram').value.trim(),
        instagram: document.getElementById('social-instagram').value.trim(),
        youtube: document.getElementById('social-youtube').value.trim(),
        email: document.getElementById('social-email').value.trim()
    };
    socket.emit('change-system-settings', { setting: 'socialLinks', value: links });
};

function applySystemSettings() {
    document.body.classList.toggle('allow-copy', systemSettings.allowCopy);
    document.body.classList.toggle('allow-screenshot', systemSettings.allowScreenshot);
    
    if (systemSettings.siteColor === 'black') {
        document.body.classList.add('black-theme');
    } else {
        document.body.classList.remove('black-theme');
    }

    updateSiteLogo(systemSettings.siteLogo);
    updateSiteTitle(systemSettings.siteTitle);
    updateSocialLinks(systemSettings.socialLinks);
}

function changeThemeColor(color) {
    if (color === 'black') {
        document.body.classList.add('black-theme');
    } else {
        document.body.classList.remove('black-theme');
    }
    
    // إعادة إنشاء الأضواء والحشرات بالألوان الجديدة
    createAnimations();
}

function updateSiteLogo(logo) {
    document.getElementById('main-logo').src = logo;
    document.getElementById('header-logo').src = logo;
    document.getElementById('site-favicon').href = logo;
}

function updateSiteTitle(title) {
    document.getElementById('site-title').textContent = title;
    document.getElementById('main-title').textContent = title;
    document.getElementById('header-title').textContent = title;
}

function updateSocialLinks(links) {
    const container = document.getElementById('social-buttons');
    if (!container) return;

    container.innerHTML = '';

    if (links.telegram) {
        const btn = document.createElement('a');
        btn.href = links.telegram;
        btn.target = '_blank';
        btn.className = 'social-btn';
        btn.textContent = '📱 Telegram';
        container.appendChild(btn);
    }

    if (links.instagram) {
        const btn = document.createElement('a');
        btn.href = links.instagram;
        btn.target = '_blank';
        btn.className = 'social-btn';
        btn.textContent = '📷 Instagram';
        container.appendChild(btn);
    }

    if (links.youtube) {
        const btn = document.createElement('a');
        btn.href = links.youtube;
        btn.target = '_blank';
        btn.className = 'social-btn';
        btn.textContent = '🎥 YouTube';
        container.appendChild(btn);
    }

    if (links.email) {
        const btn = document.createElement('a');
        btn.href = `mailto:${links.email}`;
        btn.className = 'social-btn';
        btn.textContent = '📧 Email';
        container.appendChild(btn);
    }
}

// ═══════════════════ رفع الصور ═══════════════════
window.showImageUpload = function() {
    document.getElementById('image-input').click();
};

window.handleImageUpload = function(input) {
    const file = input.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
        showAlert('حجم الصورة كبير جداً (الحد الأقصى 10MB)', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        socket.emit('upload-image', {
            imageData: e.target.result,
            size: file.size,
            roomId: currentRoom,
            isPrivate: false
        });
    };
    reader.readAsDataURL(file);

    input.value = '';
};

// ═══════════════════ النوافذ المنبثقة ═══════════════════
window.hideModal = function(modalId) {
    document.getElementById(modalId).classList.remove('active');
};

// إغلاق النوافذ عند الضغط على الخلفية
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.remove('active');
        }
    });
});

// ═══════════════════ دوال مساعدة ═══════════════════
function updateUserBadges() {
    const container = document.getElementById('user-badges');
    if (!container) return;

    let badges = '';
    
    if (currentUser.isSupremeLeader) {
        badges += '<span class="badge supreme-badge">👑 الزعيم</span>';
    } else if (currentUser.isSuperAdmin) {
        badges += '<span class="badge admin-badge">🔧 أدمن</span>';
    }
    
    if (currentUser.isVerified) {
        badges += '<span class="badge verified-badge">✅ موثق</span>';
    }

    if (currentUser.specialBadges) {
        currentUser.specialBadges.forEach(badge => {
            badges += `<span class="badge">${badge}</span>`;
        });
    }

    container.innerHTML = badges;
}

function clearMessages() {
    const container = document.getElementById('messages');
    if (container) {
        container.innerHTML = '';
    }
}

function scrollToBottom() {
    const container = document.getElementById('messages');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showAlert(message, type = 'info') {
    const colors = {
        error: { bg: '#dc2626', border: '#b91c1c' },
        success: { bg: '#10b981', border: '#059669' },
        warning: { bg: '#f59e0b', border: '#d97706' },
        info: { bg: '#3b82f6', border: '#2563eb' }
    };
    
    const color = colors[type] || colors.info;
    
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${color.bg};
        border: 2px solid ${color.border};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        z-index: 10000;
        font-weight: 600;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        max-width: 400px;
        animation: slideInRight 0.3s ease-out;
        backdrop-filter: blur(10px);
    `;
    alertDiv.textContent = message;
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
            if (alertDiv.parentNode) {
                document.body.removeChild(alertDiv);
            }
        }, 300);
    }, 5000);
}

function showNotification(message, type = 'info') {
    const notificationDiv = document.createElement('div');
    notificationDiv.className = 'notification glass-card';
    notificationDiv.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        z-index: 9999;
        animation: slideInRight 0.3s ease-out;
        max-width: 350px;
    `;
    notificationDiv.textContent = message;
    document.body.appendChild(notificationDiv);
    
    setTimeout(() => {
        notificationDiv.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
            if (notificationDiv.parentNode) {
                document.body.removeChild(notificationDiv);
            }
        }, 300);
    }, 4000);
}

function showLoading(message = 'جاري التحميل...') {
    let loadingDiv = document.getElementById('loading-overlay');
    
    if (!loadingDiv) {
        loadingDiv = document.createElement('div');
        loadingDiv.id = 'loading-overlay';
        loadingDiv.style.cssText = `
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
            font-size: 1.2rem;
            font-weight: 600;
        `;
        document.body.appendChild(loadingDiv);
    }
    
    loadingDiv.innerHTML = `
        <div style="text-align: center;">
            <div style="
                width: 60px;
                height: 60px;
                border: 5px solid rgba(255,255,255,0.3);
                border-top: 5px solid #dc2626;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 1.5rem;
            "></div>
            <div>${message}</div>
        </div>
    `;
}

function hideLoading() {
    const loadingDiv = document.getElementById('loading-overlay');
    if (loadingDiv && loadingDiv.parentNode) {
        document.body.removeChild(loadingDiv);
    }
}

function playNotificationSound() {
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYJG2S37OihUBAKSZ/h8rdnGwU7k9nyzXcsB');
        audio.volume = 0.2;
        audio.play().catch(() => {});
    } catch (e) {}
}

function startHeartbeat() {
    setInterval(() => {
        if (socket && socket.connected) {
            socket.emit('ping');
        }
    }, 30000);
}

window.checkCopyPermission = function() {
    return systemSettings.allowCopy === true;
};

// ═══════════════════ إنشاء الأنيميشن ═══════════════════
function createAnimations() {
    createStars();
    createBugs();
    createLights();
}

function createStars() {
    const starsContainer = document.getElementById('stars-bg');
    if (!starsContainer) return;
    
    starsContainer.innerHTML = '';
    
    for (let i = 0; i < 100; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.cssText = `
            width: ${Math.random() * 3 + 1}px;
            height: ${Math.random() * 3 + 1}px;
            top: ${Math.random() * 100}%;
            left: ${Math.random() * 100}%;
            animation-delay: ${Math.random() * 3}s;
            animation-duration: ${Math.random() * 2 + 2}s;
        `;
        starsContainer.appendChild(star);
    }
}

function createBugs() {
    const bugsContainer = document.getElementById('animated-bugs');
    if (!bugsContainer) return;
    
    bugsContainer.innerHTML = '';
    
    const isBlackTheme = document.body.classList.contains('black-theme');
    const bugEmojis = isBlackTheme ? ['🦋', '🐛', '🐞', '🦟'] : ['⚫', '⬛', '🕷️', '🦂'];
    
    for (let i = 0; i < 20; i++) {
        const bug = document.createElement('div');
        bug.className = 'bug';
        bug.textContent = bugEmojis[Math.floor(Math.random() * bugEmojis.length)];
        bug.style.cssText = `
            top: ${Math.random() * 100}%;
            left: ${Math.random() * 100}%;
            animation-duration: ${Math.random() * 15 + 15}s;
            animation-delay: ${Math.random() * 5}s;
        `;
        bugsContainer.appendChild(bug);
    }
}

function createLights() {
    const lightsContainer = document.getElementById('colorful-lights');
    if (!lightsContainer) return;
    
    lightsContainer.innerHTML = '';
    
    const isBlackTheme = document.body.classList.contains('black-theme');
    const colors = isBlackTheme ? [
        'rgba(220, 38, 38, 0.4)',
        'rgba(239, 68, 68, 0.3)',
        'rgba(185, 28, 28, 0.4)'
    ] : [
        'rgba(220, 38, 38, 0.4)',
        'rgba(239, 68, 68, 0.3)',
        'rgba(185, 28, 28, 0.4)',
        'rgba(248, 113, 113, 0.3)'
    ];
    
    for (let i = 0; i < 15; i++) {
        const light = document.createElement('div');
        light.className = 'colorful-light';
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        light.style.cssText = `
            width: ${Math.random() * 400 + 300}px;
            height: ${Math.random() * 400 + 300}px;
            background: radial-gradient(circle, ${randomColor} 0%, transparent 70%);
            top: ${Math.random() * 100}%;
            left: ${Math.random() * 100}%;
            animation-duration: ${Math.random() * 20 + 25}s;
            animation-delay: ${Math.random() * 10}s;
        `;
        lightsContainer.appendChild(light);
    }
}

// ═══════════════════ التهيئة ═══════════════════
document.addEventListener('DOMContentLoaded', function() {
    initializeSocket();
    createAnimations();
    
    // مستمعي أحداث لوحة المفاتيح
    document.getElementById('login-password')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') login();
    });
    
    document.getElementById('register-password')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') register();
    });
    
    // منع لصق كلمة المرور (أمان إضافي)
    document.getElementById('login-password')?.addEventListener('paste', function(e) {
        e.preventDefault();
        showAlert('لا يمكن لصق كلمة المرور للأمان', 'warning');
    });
});

// منع السكرينشوت عبر مفاتيح الاختصار
document.addEventListener('keyup', function(e) {
    if (!systemSettings.allowScreenshot) {
        if (e.key === 'PrintScreen') {
            navigator.clipboard.writeText('');
            showAlert('السكرينشوت غير مسموح في هذا الموقع', 'error');
        }
    }
});

document.addEventListener('keydown', function(e) {
    if (!systemSettings.allowScreenshot) {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 's' || e.key === 'S')) {
            e.preventDefault();
            showAlert('السكرينشوت غير مسموح في هذا الموقع', 'error');
        }
    }
});

// إضافة أنيميشن CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

console.log(`
╔═══════════════════════════════════════════════════════╗
║     🚀 نظام MOBO العالمي - جاهز للعمل © 2025        ║
║              جميع الحقوق محفوظة للزعيم               ║
╚═══════════════════════════════════════════════════════╝
`);// 🚀 نظام MOBO العالمي - النظام الأمامي الأقوى © 2025
let socket = null;
let currentUser = null;
let currentRoom = null;
let systemSettings = {};
let selectedUserId = null;');
