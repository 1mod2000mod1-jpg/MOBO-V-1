// 🚀 نظام MOBO العالمي © 2025 - السكريبت الكامل
console.log('🚀 تحميل نظام MOBO المتطور...');

let socket = null;
let currentUser = null;
let currentRoom = null;
let systemSettings = {};
let selectedUserId = null;
let selectedUsername = null;
let privateChats = new Map();
let currentPrivateChat = null;

// ═══════════════════════════════════════════════════════════════
// التهيئة والاتصال
// ═══════════════════════════════════════════════════════════════

function initializeSocket() {
    console.log('🔌 جاري الاتصال بالخادم...');
    
    try {
        socket = io({
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 10,
            timeout: 20000,
            upgrade: true,
            rememberUpgrade: true
        });

        console.log('✅ تم إنشاء الاتصال');
        setupSocketListeners();
        
    } catch (error) {
        console.error('❌ خطأ في الاتصال:', error);
        showAlert('فشل الاتصال بالخادم', 'error');
    }
}

function setupSocketListeners() {
    socket.on('connect', () => {
        console.log('✅ متصل بالخادم بنجاح');
        hideLoading();
    });

    socket.on('disconnect', (reason) => {
        console.log('⚠️ انقطع الاتصال:', reason);
        showAlert('انقطع الاتصال بالخادم', 'warning');
    });

    socket.on('reconnect', () => {
        console.log('🔄 إعادة الاتصال بنجاح');
        showAlert('تم إعادة الاتصال', 'success');
        if (currentUser) {
            socket.emit('get-rooms');
            if (currentRoom) {
                socket.emit('get-users', { roomId: currentRoom });
            }
        }
    });

    socket.on('login-success', (data) => {
        console.log('✅ تسجيل دخول ناجح');
        handleLoginSuccess(data);
    });

    socket.on('login-error', (message) => {
        console.log('❌ خطأ دخول:', message);
        hideLoading();
        showAlert(message, 'error');
    });

    socket.on('banned-user', (data) => {
        hideLoading();
        showAlert(`❌ تم حظرك: ${data.reason}`, 'error');
        document.getElementById('support-section').style.display = 'block';
    });

    socket.on('register-success', (data) => {
        console.log('✅ تسجيل ناجح');
        hideLoading();
        showAlert(data.message, 'success');
        document.getElementById('login-username').value = data.username;
        setTimeout(() => {
            document.getElementById('login-password').focus();
        }, 500);
    });

    socket.on('register-error', (message) => {
        console.log('❌ خطأ تسجيل:', message);
        hideLoading();
        showAlert(message, 'error');
    });

    socket.on('new-message', (message) => {
        addMessage(message);
        playSound();
        scrollToBottom();
    });

    socket.on('room-joined', (data) => {
        handleRoomJoined(data);
    });

    socket.on('room-created', (data) => {
        showAlert(data.message, 'success');
        socket.emit('join-room', { roomId: data.roomId });
        hideModal('create-room-modal');
    });

    socket.on('room-password-required', (data) => {
        const password = prompt(`🔒 أدخل كلمة سر الغرفة: ${data.roomName}`);
        if (password) {
            socket.emit('join-room', { roomId: data.roomId, password: password });
        }
    });

    socket.on('users-list', updateUsersList);
    socket.on('rooms-list', updateRoomsList);

    socket.on('user-joined-room', (data) => {
        showNotification(`${data.username} انضم إلى ${data.roomName}`, data.isSupreme ? 'supreme' : 'info');
    });

    socket.on('user-muted', (data) => {
        const message = `🔇 تم كتم ${data.username} لمدة ${data.duration}`;
        showAlert(message, 'warning');
    });

    socket.on('user-unmuted', (data) => {
        showAlert(`🔊 تم إلغاء كتم ${data.username}`, 'info');
    });

    socket.on('chat-cleaned', (data) => {
        clearMessages();
        showAlert(data.message, 'info');
    });

    socket.on('chat-auto-cleaned', (data) => {
        showNotification(data.message, 'info');
    });

    socket.on('room-silenced', (data) => {
        document.getElementById('message-input').disabled = !currentUser?.isSupremeLeader;
        showAlert(data.message, 'warning');
    });

    socket.on('room-unsilenced', (data) => {
        document.getElementById('message-input').disabled = false;
        showAlert(data.message, 'success');
    });

    socket.on('room-deleted', (data) => {
        showAlert(data.message, 'error');
        socket.emit('join-room', { roomId: 'global_official_supreme' });
    });

    socket.on('room-name-changed', (data) => {
        document.getElementById('room-info').textContent = data.newName;
        showAlert(`تم تغيير اسم الغرفة إلى: ${data.newName}`, 'info');
    });

    socket.on('message-deleted', (data) => {
        const messageEl = document.querySelector(`[data-message-id="${data.messageId}"]`);
        if (messageEl) {
            messageEl.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => messageEl.remove(), 300);
        }
    });

    socket.on('moderator-added', (data) => {
        showAlert(`⭐ تم إضافة ${data.username} كمشرف في ${data.roomName}`, 'success');
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
        showAlert(`🚫 ${data.reason}`, 'error');
        setTimeout(() => logout(true), 3000);
    });

    socket.on('site-color-changed', (data) => {
        applySiteColor(data.color);
        showAlert('🎨 تم تغيير لون الموقع', 'info');
    });

    socket.on('site-logo-changed', (data) => {
        updateSiteLogo(data.logo);
        showAlert('🖼️ تم تغيير شعار الموقع', 'info');
    });

    socket.on('site-title-changed', (data) => {
        updateSiteTitle(data.title);
        showAlert('📝 تم تغيير عنوان الموقع', 'info');
    });

    socket.on('social-links-updated', (data) => {
        updateSocialLinks(data);
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

    socket.on('pong', () => {
        // Heartbeat response
    });
}

// ═══════════════════════════════════════════════════════════════
// معالجة تسجيل الدخول
// ═══════════════════════════════════════════════════════════════

function handleLoginSuccess(data) {
    console.log('معالجة تسجيل الدخول...');
    
    currentUser = data.user;
    currentRoom = data.room.id;
    systemSettings = data.systemSettings;

    // تحديث واجهة المستخدم
    document.getElementById('current-user-name').textContent = currentUser.displayName;
    document.getElementById('current-user-avatar').textContent = currentUser.avatar;
    updateUserBadges();

    // الانتقال لشاشة الدردشة
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('chat-screen').classList.add('active');

    hideLoading();
    showAlert(`🎉 مرحباً ${currentUser.displayName}!`, 'success');

    // عرض الرسائل
    clearMessages();
    if (data.room.messages && data.room.messages.length > 0) {
        data.room.messages.forEach(msg => addMessage(msg));
    }

    // تفعيل حقل الرسائل
    const messageInput = document.getElementById('message-input');
    const sendButton = document.querySelector('#message-form button');
    
    if (data.room.isSilenced && !currentUser.isSupremeLeader) {
        messageInput.disabled = true;
        sendButton.disabled = true;
        messageInput.placeholder = '🔇 الغرفة في وضع الصمت';
    } else {
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.placeholder = 'اكتب رسالتك هنا... (500 حرف كحد أقصى)';
    }

    // طلب القوائم
    socket.emit('get-rooms');
    socket.emit('get-users', { roomId: currentRoom });

    // عرض لوحة الزعيم إذا كان المستخدم هو الزعيم
    if (currentUser.isSupremeLeader) {
        document.getElementById('supreme-panel-btn').style.display = 'inline-block';
    }

    // تطبيق إعدادات النظام
    applySiteColor(systemSettings.siteColor);
    updateSiteLogo(systemSettings.siteLogo);
    updateSiteTitle(systemSettings.siteTitle);
    updateSocialLinks(systemSettings.socialLinks);

    // بدء Heartbeat
    startHeartbeat();
    
    // إنشاء الأنيميشن
    createAnimations();
}

function handleRoomJoined(data) {
    currentRoom = data.room.id;
    document.getElementById('room-info').textContent = data.room.name;
    
    clearMessages();
    if (data.room.messages && data.room.messages.length > 0) {
        data.room.messages.forEach(msg => addMessage(msg));
    }
    
    const messageInput = document.getElementById('message-input');
    const sendButton = document.querySelector('#message-form button');
    
    if (data.room.isSilenced && !currentUser?.isSupremeLeader) {
        messageInput.disabled = true;
        sendButton.disabled = true;
        messageInput.placeholder = '🔇 الغرفة في وضع الصمت';
    } else {
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.placeholder = 'اكتب رسالتك هنا... (500 حرف كحد أقصى)';
    }
    
    socket.emit('get-users', { roomId: currentRoom });
    scrollToBottom();
}

// ═══════════════════════════════════════════════════════════════
// تسجيل الدخول والتسجيل
// ═══════════════════════════════════════════════════════════════

window.login = function() {
    console.log('🔑 محاولة تسجيل الدخول...');
    
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!username || !password) {
        showAlert('الرجاء إدخال جميع البيانات', 'error');
        return;
    }

    console.log('إرسال بيانات الدخول:', username);
    showLoading('جاري تسجيل الدخول...');
    
    socket.emit('login', { 
        username: username, 
        password: password 
    });
};

window.register = function() {
    console.log('📝 محاولة التسجيل...');
    
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

    console.log('إرسال بيانات التسجيل:', username);
    showLoading('جاري إنشاء الحساب...');
    
    socket.emit('register', { 
        username, 
        password, 
        displayName, 
        gender, 
        emoji 
    });
};

window.sendSupportMessage = function() {
    const message = document.getElementById('support-message').value.trim();
    
    if (!message) {
        showAlert('اكتب رسالتك أولاً', 'error');
        return;
    }

    socket.emit('send-support-message', {
        from: document.getElementById('login-username').value || 'مجهول',
        message: message
    });

    document.getElementById('support-message').value = '';
};

window.logout = function(forced = false) {
    if (forced || confirm('هل تريد تسجيل الخروج؟')) {
        showLoading('جاري تسجيل الخروج...');
        if (socket) socket.disconnect();
        setTimeout(() => location.reload(), 1000);
    }
};

// ═══════════════════════════════════════════════════════════════
// إرسال الرسائل
// ═══════════════════════════════════════════════════════════════

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
        // إرسال بالضغط على Enter (دون Shift)
        messageInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // تحديث عدد الأحرف
        messageInput.addEventListener('input', function() {
            const length = this.value.length;
            const max = 500;
            if (length > max) {
                this.value = this.value.substring(0, max);
            }
        });
    }
});

function sendMessage() {
    const textarea = document.getElementById('message-input');
    const text = textarea.value.trim();

    if (!text) return;

    if (text.length > 500) {
        showAlert('الرسالة طويلة جداً (الحد الأقصى 500 حرف)', 'error');
        return;
    }

    socket.emit('send-message', { text: text, roomId: currentRoom });
    textarea.value = '';
    textarea.style.height = 'auto';
}

// ═══════════════════════════════════════════════════════════════
// عرض الرسائل
// ═══════════════════════════════════════════════════════════════

function addMessage(message) {
    const container = document.getElementById('messages');
    if (!container) return;

    // إزالة رسالة الترحيب إذا كانت موجودة
    const welcomeMsg = container.querySelector('.welcome-message');
    if (welcomeMsg) welcomeMsg.remove();

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.isSupremeLeader ? 'supreme-message' : ''} ${message.glowing ? 'glowing-message' : ''}`;
    messageDiv.setAttribute('data-message-id', message.id);
    messageDiv.setAttribute('data-user-id', message.userId);

    let badges = '';
    if (message.isSupremeLeader) {
        badges += '<span class="badge supreme-badge">👑 الزعيم</span>';
    } else if (message.isSuperAdmin) {
        badges += '<span class="badge admin-badge">🔧 مدير</span>';
    } else if (message.isAdmin) {
        badges += '<span class="badge admin-badge">👮 إداري</span>';
    }
    if (message.isModerator) {
        badges += '<span class="badge moderator-badge">⭐ مشرف</span>';
    }
    if (message.isVerified) {
        badges += '<span class="badge verified-badge">✅ موثق</span>';
    }
    if (message.specialBadges && message.specialBadges.length > 0) {
        message.specialBadges.forEach(badge => {
            badges += `<span class="badge special-badge">${escapeHtml(badge)}</span>`;
        });
    }

    messageDiv.innerHTML = `
        <div class="message-header">
            <div class="message-user-info">
                <span class="user-avatar-small">${escapeHtml(message.avatar)}</span>
                <span class="message-user">${escapeHtml(message.username)}</span>
            </div>
            <div class="message-badges">${badges}</div>
        </div>
        <div class="message-text">${escapeHtml(message.text)}</div>
        <div class="message-footer">
            <span class="message-time">${message.timestamp}</span>
        </div>
    `;

    // إضافة خاصية النقر على الرسالة للإجراءات
    if (message.userId !== currentUser?.id) {
        messageDiv.style.cursor = 'pointer';
        messageDiv.addEventListener('click', (e) => {
            if (!e.target.closest('.badge')) {
                selectedUserId = message.userId;
                selectedUsername = message.username;
                showMessageActions(message);
            }
        });
    }

    container.appendChild(messageDiv);
    scrollToBottom();
}

function clearMessages() {
    const container = document.getElementById('messages');
    if (container) {
        container.innerHTML = `
            <div class="welcome-message glass-card">
                <img src="${systemSettings.siteLogo || 'https://i.top4top.io/p_3583q2vy21.jpg'}" 
                     alt="مرحباً" class="welcome-logo" loading="lazy">
                <h3>مرحباً بك في ${systemSettings.siteTitle || 'موقع MOBO العالمي'}! 👋</h3>
                <p>© 2025 MOBO - أقوى منصة دردشة عربية</p>
                <p style="margin-top: 1rem;">ابدأ بالدردشة مع المستخدمين</p>
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

// ═══════════════════════════════════════════════════════════════
// قائمة الإجراءات
// ═══════════════════════════════════════════════════════════════

function showMessageActions(message) {
    const actions = [];

    // إجراءات الزعيم
    if (currentUser?.isSupremeLeader) {
        actions.push({ text: '👑 إضافة كمشرف', action: () => addModerator(), color: '#fbbf24' });
        actions.push({ text: '🔇 كتم', action: () => muteUser(), color: '#f59e0b' });
        actions.push({ text: '🚫 حظر', action: () => banUser(), color: '#dc2626' });
        actions.push({ text: '🗑️ حذف الرسالة', action: () => deleteMessage(message.id), color: '#991b1b' });
    } 
    // إجراءات المشرفين
    else if (currentUser?.isAdmin || currentUser?.isModerator) {
        actions.push({ text: '🔇 كتم', action: () => muteUser(), color: '#f59e0b' });
        actions.push({ text: '🚫 حظر', action: () => banUser(), color: '#dc2626' });
    }

    // إجراءات عامة
    actions.push({ text: '💬 رسالة خاصة', action: () => openPrivateChat(selectedUserId), color: '#3b82f6' });
    actions.push({ text: '❌ إلغاء', action: () => {}, color: '#6b7280' });

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
        btn.style.borderRight = `4px solid ${action.color}`;
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

// ═══════════════════════════════════════════════════════════════
// إجراءات المستخدمين
// ═══════════════════════════════════════════════════════════════

window.muteUser = function() {
    const duration = prompt(`⏱️ مدة كتم ${selectedUsername} (بالدقائق، 0 للدائم):`, '10');
    if (duration === null) return;
    
    const reason = prompt('💭 السبب:', 'مخالفة القوانين');
    if (!reason) return;

    socket.emit('mute-user', {
        userId: selectedUserId,
        username: selectedUsername,
        duration: parseInt(duration) || 0,
        reason: reason
    });
};

window.banUser = function() {
    if (!confirm(`⚠️ هل أنت متأكد من حظر ${selectedUsername} نهائياً؟`)) return;
    
    const reason = prompt('💭 السبب:', 'مخالفة جسيمة');
    if (!reason) return;

    socket.emit('ban-user', {
        userId: selectedUserId,
        username: selectedUsername,
        reason: reason
    });
};

window.addModerator = function() {
    if (!confirm(`⭐ إضافة ${selectedUsername} كمشرف؟`)) return;
    
    const permissions = {
        canMute: confirm('هل يمكنه كتم المستخدمين؟'),
        canKick: confirm('هل يمكنه طرد المستخدمين؟'),
        canChangeRoomName: confirm('هل يمكنه تغيير اسم الغرفة؟'),
        canChangePassword: confirm('هل يمكنه تغيير كلمة سر الغرفة؟')
    };
    
    socket.emit('add-moderator', {
        userId: selectedUserId,
        username: selectedUsername,
        roomId: currentRoom,
        permissions: permissions
    });
};

function deleteMessage(messageId) {
    if (!confirm('هل تريد حذف هذه الرسالة؟')) return;
    
    socket.emit('delete-message', {
        messageId: messageId,
        roomId: currentRoom
    });
}

function openPrivateChat(userId) {
    // TODO: تنفيذ الرسائل الخاصة
    showAlert('ميزة الرسائل الخاصة قريباً', 'info');
}

// ═══════════════════════════════════════════════════════════════
// إدارة الغرف
// ═══════════════════════════════════════════════════════════════

window.showCreateRoomModal = function() {
    document.getElementById('create-room-modal').classList.add('active');
    document.getElementById('room-name-input').focus();
};

window.createRoom = function() {
    const name = document.getElementById('room-name-input').value.trim();
    const description = document.getElementById('room-desc-input').value.trim();
    const password = document.getElementById('room-pass-input').value.trim();

    if (!name) {
        showAlert('أدخل اسم الغرفة', 'error');
        return;
    }

    socket.emit('create-room', { name, description, password });
    
    document.getElementById('room-name-input').value = '';
    document.getElementById('room-desc-input').value = '';
    document.getElementById('room-pass-input').value = '';
};

window.joinRoom = function(roomId) {
    showLoading('جاري الانضمام...');
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

    if (rooms.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 2rem; opacity: 0.6;">لا توجد غرف متاحة</div>';
        return;
    }

    rooms.forEach(room => {
        const div = document.createElement('div');
        div.className = 'room-item';
        div.onclick = () => joinRoom(room.id);

        const lock = room.hasPassword ? '🔒 ' : '';
        const official = room.isOfficial ? '⭐ ' : '';
        const global = room.isGlobal ? '🌍 ' : '';
        const silence = room.isSilenced ? '🔇 ' : '';

        div.innerHTML = `
            <div class="room-item-name">${global}${official}${lock}${silence}${escapeHtml(room.name)}</div>
            <div class="room-item-desc">${escapeHtml(room.description)}</div>
            <div class="room-item-info">
                <span>👥 ${room.userCount}</span>
                <span>${escapeHtml(room.createdBy)}</span>
            </div>
        `;

        container.appendChild(div);
    });
}

function updateUsersList(users) {
    const container = document.getElementById('users-list');
    if (!container) return;

    document.getElementById('users-count').textContent = users.length;
    container.innerHTML = '';

    if (users.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 2rem; opacity: 0.6;">لا يوجد مستخدمين</div>';
        return;
    }

    users.forEach(user => {
        if (user.id === currentUser?.id) return;

        const div = document.createElement('div');
        div.className = 'user-item';

        let badges = '';
        if (user.isSupremeLeader) badges += '<span class="badge supreme-badge">👑</span>';
        else if (user.isSuperAdmin) badges += '<span class="badge admin-badge">🔧</span>';
        else if (user.isAdmin) badges += '<span class="badge admin-badge">👮</span>';
        if (user.isModerator) badges += '<span class="badge moderator-badge">⭐</span>';
        if (user.isVerified) badges += '<span class="badge verified-badge">✅</span>';

        div.innerHTML = `
            <div class="user-avatar-wrapper">
                <div class="user-avatar ${user.glowingMessages ? 'glowing-avatar' : ''}">${escapeHtml(user.avatar)}</div>
                ${user.isOnline ? '<span class="online-indicator"></span>' : ''}
            </div>
            <div class="user-info">
                <div class="user-name">${escapeHtml(user.displayName)} ${badges}</div>
            </div>
        `;

        container.appendChild(div);
    });
}

function updateUserBadges() {
    const container = document.getElementById('user-badges');
    if (!container) return;

    let badges = '';
    
    if (currentUser.isSupremeLeader) {
        badges += '<span class="badge supreme-badge">👑 الزعيم</span>';
    } else if (currentUser.isSuperAdmin) {
        badges += '<span class="badge admin-badge">🔧 مدير</span>';
    } else if (currentUser.isAdmin) {
        badges += '<span class="badge admin-badge">👮 إداري</span>';
    }
    
    if (currentUser.isVerified) {
        badges += '<span class="badge verified-badge">✅ موثق</span>';
    }

    if (currentUser.specialBadges && currentUser.specialBadges.length > 0) {
        currentUser.specialBadges.forEach(badge => {
            badges += `<span class="badge special-badge">${escapeHtml(badge)}</span>`;
        });
    }

    container.innerHTML = badges;
}

// ═══════════════════════════════════════════════════════════════
// لوحة الزعيم الأعلى
// ═══════════════════════════════════════════════════════════════

window.showSupremePanel = function() {
    document.getElementById('supreme-panel-modal').classList.add('active');
    switchSupremeTab('muted');
};

window.switchSupremeTab = function(tabName) {
    // إخفاء جميع التبويبات
    document.querySelectorAll('.supreme-tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // إظهار التبويب المحدد
    document.getElementById(`supreme-${tabName}`).classList.add('active');
    event.target.classList.add('active');

    // تحميل البيانات
    if (tabName === 'muted') {
        socket.emit('get-muted-list');
    } else if (tabName === 'banned') {
        socket.emit('get-banned-list');
    } else if (tabName === 'support') {
        socket.emit('get-support-messages');
    } else if (tabName === 'rooms') {
        loadRoomsManagement();
    } else if (tabName === 'settings') {
        loadSystemSettings();
    }
};

function displayMutedList(list) {
    const container = document.getElementById('muted-list');
    if (!container) return;

    container.innerHTML = '';

    if (list.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 2rem;">لا يوجد مستخدمين مكتومين</div>';
        return;
    }

    list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'supreme-item';

        const timeLeft = item.temporary && item.expires ? 
            Math.ceil((item.expires - Date.now()) / 60000) : 'دائم';

        div.innerHTML = `
            <div class="supreme-item-header">
                <div>
                    <strong>${escapeHtml(item.username)}</strong>
                    <br><small>بواسطة: ${escapeHtml(item.mutedBy)}</small>
                </div>
                <div class="supreme-item-actions">
                    ${item.canRemove ? `<button class="modern-btn small" onclick="unmute('${item.userId}')">إلغاء الكتم</button>` : ''}
                </div>
            </div>
            <div>
                <small>السبب: ${escapeHtml(item.reason)}</small>
                <br><small>المدة: ${timeLeft}</small>
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
        container.innerHTML = '<div style="text-align: center; padding: 2rem;">لا يوجد مستخدمين محظورين</div>';
        return;
    }

    list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'supreme-item';

        div.innerHTML = `
            <div class="supreme-item-header">
                <div>
                    <strong>${escapeHtml(item.username)}</strong>
                    <br><small>بواسطة: ${escapeHtml(item.bannedBy)}</small>
                </div>
                <div class="supreme-item-actions">
                    <button class="modern-btn small" onclick="unban('${item.userId}')">إلغاء الحظر</button>
                </div>
            </div>
            <div>
                <small>السبب: ${escapeHtml(item.reason)}</small>
                <br><small>التاريخ: ${new Date(item.bannedAt).toLocaleString('ar-EG')}</small>
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
        container.innerHTML = '<div style="text-align: center; padding: 2rem;">لا توجد رسائل دعم</div>';
        return;
    }

    messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = 'supreme-item';

        div.innerHTML = `
            <div class="supreme-item-header">
                <div>
                    <strong>${escapeHtml(msg.from)}</strong>
                    ${msg.isBanned ? '<span class="badge" style="background: #dc2626;">محظور</span>' : ''}
                    <br><small>${new Date(msg.sentAt).toLocaleString('ar-EG')}</small>
                </div>
                <div class="supreme-item-actions">
                    ${msg.canUnban ? `<button class="modern-btn small" onclick="unbanFromSupport('${msg.id}')">السماح بإعادة التسجيل</button>` : ''}
                    <button class="modern-btn small" onclick="deleteSupportMessage('${msg.id}')">حذف</button>
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
    if (confirm('إلغاء كتم هذا المستخدم؟')) {
        socket.emit('unmute-user', { userId: userId });
        setTimeout(() => socket.emit('get-muted-list'), 500);
    }
};

window.unban = function(userId) {
    if (confirm('⚠️ إلغاء حظر هذا المستخدم؟ سيتمكن من الدخول مجدداً')) {
        socket.emit('unban-user', { userId: userId });
        setTimeout(() => socket.emit('get-banned-list'), 500);
    }
};

window.deleteSupportMessage = function(messageId) {
    if (confirm('حذف هذه الرسالة؟')) {
        socket.emit('delete-support-message', { messageId: messageId });
        setTimeout(() => socket.emit('get-support-messages'), 500);
    }
};

window.cleanAllSupportMessages = function() {
    if (confirm('⚠️ حذف جميع رسائل الدعم؟')) {
        // TODO: تنفيذ حذف جماعي
        showAlert('ميزة الحذف الجماعي قريباً', 'info');
    }
};

function loadRoomsManagement() {
    const container = document.getElementById('rooms-management-list');
    if (!container) return;

    socket.emit('get-rooms');
}

function loadSystemSettings() {
    document.getElementById('setting-copy').checked = systemSettings.allowCopy || false;
    document.getElementById('setting-screenshot').checked = systemSettings.allowScreenshot || false;
    document.getElementById('setting-color').value = systemSettings.siteColor || 'red';
    document.getElementById('setting-logo').value = systemSettings.siteLogo || '';
    document.getElementById('setting-title').value = systemSettings.siteTitle || '';
    document.getElementById('social-telegram').value = systemSettings.socialLinks?.telegram || '';
    document.getElementById('social-instagram').value = systemSettings.socialLinks?.instagram || '';
    document.getElementById('social-youtube').value = systemSettings.socialLinks?.youtube || '';
    document.getElementById('social-email').value = systemSettings.socialLinks?.email || '';
}

window.updateSystemSetting = function(setting, value) {
    socket.emit('update-system-settings', {
        setting: setting,
        value: value
    });

    if (setting === 'allowCopy') {
        if (value) {
            document.body.classList.add('allow-copy');
        } else {
            document.body.classList.remove('allow-copy');
        }
    } else if (setting === 'allowScreenshot') {
        if (value) {
            document.body.classList.add('allow-screenshot');
        } else {
            document.body.classList.remove('allow-screenshot');
        }
    }
};

window.updateLogo = function() {
    const logo = document.getElementById('setting-logo').value.trim();
    if (!logo) {
        showAlert('أدخل رابط الشعار', 'error');
        return;
    }
    socket.emit('update-system-settings', {
        setting: 'siteLogo',
        value: logo
    });
};

window.updateTitle = function() {
    const title = document.getElementById('setting-title').value.trim();
    if (!title) {
        showAlert('أدخل عنوان الموقع', 'error');
        return;
    }
    socket.emit('update-system-settings', {
        setting: 'siteTitle',
        value: title
    });
};

window.updateSocialLinks = function() {
    const links = {
        telegram: document.getElementById('social-telegram').value.trim(),
        instagram: document.getElementById('social-instagram').value.trim(),
        youtube: document.getElementById('social-youtube').value.trim(),
        email: document.getElementById('social-email').value.trim()
    };

    socket.emit('update-social-links', links);
};

// ═══════════════════════════════════════════════════════════════
// تطبيق الإعدادات
// ═══════════════════════════════════════════════════════════════

function applySiteColor(color) {
    if (color === 'black') {
        document.body.classList.add('black-theme');
    } else {
        document.body.classList.remove('black-theme');
    }
}

function updateSiteLogo(logo) {
    document.querySelectorAll('#main-logo, #header-logo, #site-favicon').forEach(el => {
        if (el.tagName === 'IMG') {
            el.src = logo;
        } else if (el.tagName === 'LINK') {
            el.href = logo;
        }
    });
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
        container.innerHTML += `<a href="${escapeHtml(links.telegram)}" target="_blank" class="social-btn">📱 Telegram</a>`;
    }
    if (links.instagram) {
        container.innerHTML += `<a href="${escapeHtml(links.instagram)}" target="_blank" class="social-btn">📷 Instagram</a>`;
    }
    if (links.youtube) {
        container.innerHTML += `<a href="${escapeHtml(links.youtube)}" target="_blank" class="social-btn">📺 YouTube</a>`;
    }
    if (links.email) {
        container.innerHTML += `<a href="mailto:${escapeHtml(links.email)}" class="social-btn">📧 Email</a>`;
    }
}

// ═══════════════════════════════════════════════════════════════
// النوافذ المنبثقة
// ═══════════════════════════════════════════════════════════════

window.hideModal = function(modalId) {
    document.getElementById(modalId).classList.remove('active');
};

window.showPrivateMessages = function() {
    showAlert('ميزة الرسائل الخاصة قريباً', 'info');
};

// ═══════════════════════════════════════════════════════════════
// الدوال المساعدة
// ═══════════════════════════════════════════════════════════════

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
        info: '#3b82f6'
    };
    
    const alertDiv = document.createElement('div');
    alertDiv.className = 'custom-alert';
    alertDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type] || colors.info};
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
    const colors = {
        supreme: 'linear-gradient(135deg, #dc2626, #991b1b)',
        info: 'rgba(59, 130, 246, 0.9)',
        warning: 'rgba(245, 158, 11, 0.9)'
    };

    const div = document.createElement('div');
    div.className = 'notification-popup';
    div.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: ${colors[type] || colors.info};
        backdrop-filter: blur(10px);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        z-index: 9999;
        animation: slideInRight 0.3s ease-out;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        max-width: 350px;
    `;
    div.textContent = message;
    document.body.appendChild(div);
    
    setTimeout(() => {
        div.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
            if (div.parentNode) document.body.removeChild(div);
        }, 300);
    }, 4000);
}

function showLoading(message = 'جاري التحميل...') {
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
            font-size: 1.2rem;
            font-weight: 600;
        `;
        document.body.appendChild(div);
    }
    
    div.innerHTML = `
        <div style="text-align: center;">
            <div class="spinner"></div>
            <div style="margin-top: 1.5rem;">${message}</div>
        </div>
    `;
}

function hideLoading() {
    const div = document.getElementById('loading-overlay');
    if (div && div.parentNode) {
        div.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            if (div.parentNode) {
                document.body.removeChild(div);
            }
        }, 300);
    }
}

function playSound() {
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

function checkCopyPermission() {
    return systemSettings.allowCopy || false;
}

// ═══════════════════════════════════════════════════════════════
// الأنيميشن والتأثيرات
// ═══════════════════════════════════════════════════════════════

function createAnimations() {
    createStars();
    createBugs();
    createLights();
    createDancingMan();
}

function createStars() {
    const container = document.getElementById('stars-bg');
    if (!container) return;
    
    container.innerHTML = '';
    
    for (let i = 0; i < 100; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.cssText = `
            width: ${Math.random() * 3 + 1}px;
            height: ${Math.random() * 3 + 1}px;
            top: ${Math.random() * 100}%;
            left: ${Math.random() * 100}%;
            animation-delay: ${Math.random() * 3}s;
        `;
        container.appendChild(star);
    }
}

function createBugs() {
    const container = document.getElementById('animated-bugs');
    if (!container) return;
    
    container.innerHTML = '';
    
    const bugEmojis = ['⚫', '⬛', '🕷️', '🦂', '🐜', '🦟'];
    
    for (let i = 0; i < 25; i++) {
        const bug = document.createElement('div');
        bug.className = 'bug';
        bug.textContent = bugEmojis[Math.floor(Math.random() * bugEmojis.length)];
        bug.style.cssText = `
            top: ${Math.random() * 100}%;
            left: ${Math.random() * 100}%;
            animation-duration: ${Math.random() * 15 + 15}s;
            animation-delay: ${Math.random() * 5}s;
            font-size: ${Math.random() * 0.5 + 0.8}rem;
        `;
        container.appendChild(bug);
    }
}

function createLights() {
    const container = document.getElementById('colorful-lights');
    if (!container) return;
    
    container.innerHTML = '';
    
    const colors = [
        'rgba(220, 38, 38, 0.4)',
        'rgba(239, 68, 68, 0.3)',
        'rgba(185, 28, 28, 0.4)',
        'rgba(248, 113, 113, 0.3)'
    ];
    
    for (let i = 0; i < 20; i++) {
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
        container.appendChild(light);
    }
}

function createDancingMan() {
    const loginScreen = document.getElementById('login-screen');
    if (!loginScreen) return;

    const man = document.createElement('div');
    man.className = 'dancing-man';
    man.innerHTML = `
        <div class="man-body">
            <div class="man-head"></div>
            <div class="man-torso"></div>
            <div class="man-arm man-arm-left"></div>
            <div class="man-arm man-arm-right"></div>
            <div class="man-leg man-leg-left"></div>
            <div class="man-leg man-leg-right"></div>
        </div>
    `;
    
    loginScreen.appendChild(man);
}

// ═══════════════════════════════════════════════════════════════
// CSS الإضافي للأنيميشن
// ═══════════════════════════════════════════════════════════════

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
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    .spinner {
        width: 60px;
        height: 60px;
        border: 5px solid rgba(255,255,255,0.3);
        border-top: 5px solid #dc2626;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    .glowing-avatar {
        animation: avatarGlow 2s ease-in-out infinite alternate;
    }

    @keyframes avatarGlow {
        from { box-shadow: 0 0 10px rgba(220, 38, 38, 0.5); }
        to { box-shadow: 0 0 25px rgba(220, 38, 38, 0.9); }
    }

    /* رجل الأنيميشن الراقص */
    .dancing-man {
        position: fixed;
        bottom: 10%;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1;
        opacity: 0.6;
        pointer-events: none;
    }

    .man-body {
        position: relative;
        width: 80px;
        height: 150px;
        animation: dance 1s ease-in-out infinite;
    }

    .man-head {
        width: 30px;
        height: 30px;
        background: white;
        border-radius: 50%;
        position: absolute;
        top: 0;
        left: 50%;
        transform: translateX(-50%);
        animation: headBop 0.5s ease-in-out infinite;
    }

    .man-torso {
        width: 20px;
        height: 50px;
        background: white;
        position: absolute;
        top: 35px;
        left: 50%;
        transform: translateX(-50%);
        border-radius: 5px;
    }

    .man-arm {
        width: 15px;
        height: 40px;
        background: white;
        position: absolute;
        top: 40px;
        border-radius: 5px;
    }

    .man-arm-left {
        left: 10px;
        transform-origin: top center;
        animation: armSwing 0.5s ease-in-out infinite;
    }

    .man-arm-right {
        right: 10px;
        transform-origin: top center;
        animation: armSwing 0.5s ease-in-out infinite reverse;
    }

    .man-leg {
        width: 15px;
        height: 50px;
        background: white;
        position: absolute;
        top: 85px;
        border-radius: 5px;
    }

    .man-leg-left {
        left: 20px;
        transform-origin: top center;
        animation: legKick 0.5s ease-in-out infinite;
    }

    .man-leg-right {
        right: 20px;
        transform-origin: top center;
        animation: legKick 0.5s ease-in-out infinite reverse;
    }

    @keyframes dance {
        0%, 100% { transform: translateY(0) rotate(-2deg); }
        50% { transform: translateY(-10px) rotate(2deg); }
    }

    @keyframes headBop {
        0%, 100% { transform: translateX(-50%) translateY(0); }
        50% { transform: translateX(-50%) translateY(-5px); }
    }

    @keyframes armSwing {
        0%, 100% { transform: rotate(-30deg); }
        50% { transform: rotate(30deg); }
    }

    @keyframes legKick {
        0%, 100% { transform: rotate(-15deg); }
        50% { transform: rotate(15deg); }
    }
`;
document.head.appendChild(style);

// ═══════════════════════════════════════════════════════════════
// التهيئة عند التحميل
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 الصفحة جاهزة - تهيئة النظام...');
    
    initializeSocket();
    createAnimations();
    
    // Enter للدخول
    const loginPassword = document.getElementById('login-password');
    if (loginPassword) {
        loginPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') login();
        });
    }
    
    const registerPassword = document.getElementById('register-password');
    if (registerPassword) {
        registerPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') register();
        });
    }

    // تطبيق حماية النسخ والسكرينشوت
    document.body.addEventListener('contextmenu', (e) => {
        if (!systemSettings.allowCopy) {
            e.preventDefault();
            showAlert('⚠️ تم تعطيل القائمة اليمنى', 'warning');
        }
    });

    // منع اختصارات لوحة المفاتيح
    document.addEventListener('keydown', (e) => {
        if (!systemSettings.allowScreenshot) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                e.preventDefault();
                showAlert('⚠️ الطباعة معطلة', 'warning');
            }
            if (e.key === 'PrintScreen') {
                showAlert('⚠️ السكرينشوت معطل', 'warning');
            }
        }
    });

    console.log('✅ نظام MOBO جاهز للعمل!');
    console.log('📊 الإصدار: 7.0.0 المتطور');
    console.log('👑 © 2025 MOBO - جميع الحقوق محفوظة للزعيم');
});

// منع إغلاق الصفحة أثناء الدردشة
window.addEventListener('beforeunload', function(e) {
    if (currentUser && currentRoom) {
        e.preventDefault();
        e.returnValue = '';
        return 'هل تريد مغادرة الدردشة؟';
    }
});

console.log('✅ السكريبت محمل بنجاح - جاهز للعمل!');
