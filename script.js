// 🚀 نظام MOBO العالمي © 2025
console.log('🚀 تحميل النظام...');

let socket = null;
let currentUser = null;
let currentRoom = null;
let systemSettings = {};
let selectedUserId = null;
let selectedUsername = null;

// بدء الاتصال فوراً
function initializeSocket() {
    console.log('🔌 جاري الاتصال بالخادم...');
    
    try {
        socket = io({
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 10,
            timeout: 20000
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
        console.log('✅ متصل بالخادم');
        hideLoading();
    });

    socket.on('disconnect', (reason) => {
        console.log('⚠️ انقطع الاتصال:', reason);
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
        showAlert(`تم حظرك: ${data.reason}`, 'error');
        document.getElementById('support-section').style.display = 'block';
    });

    socket.on('register-success', (data) => {
        console.log('✅ تسجيل ناجح');
        hideLoading();
        showAlert(data.message, 'success');
        document.getElementById('login-username').value = data.username;
    });

    socket.on('register-error', (message) => {
        console.log('❌ خطأ تسجيل:', message);
        hideLoading();
        showAlert(message, 'error');
    });

    socket.on('new-message', (message) => {
        addMessage(message);
        playSound();
    });

    socket.on('room-joined', (data) => {
        currentRoom = data.room.id;
        document.getElementById('room-info').textContent = data.room.name;
        clearMessages();
        data.room.messages.forEach(msg => addMessage(msg));
        document.getElementById('message-input').disabled = false;
        document.querySelector('#message-form button').disabled = false;
        socket.emit('get-users', { roomId: currentRoom });
    });

    socket.on('room-created', (data) => {
        showAlert(data.message, 'success');
        socket.emit('join-room', { roomId: data.roomId });
        hideModal('create-room-modal');
    });

    socket.on('room-password-required', (data) => {
        const password = prompt(`كلمة سر الغرفة: ${data.roomName}`);
        if (password) {
            socket.emit('join-room', { roomId: data.roomId, password: password });
        }
    });

    socket.on('users-list', updateUsersList);
    socket.on('rooms-list', updateRoomsList);

    socket.on('user-joined-room', (data) => {
        showNotification(`${data.username} انضم إلى ${data.roomName}`);
    });

    socket.on('user-muted', (data) => {
        showAlert(`تم كتم ${data.username}`, 'warning');
    });

    socket.on('chat-cleaned', (data) => {
        showAlert(data.message, 'info');
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
        showAlert(`تم حظرك: ${data.reason}`, 'error');
        setTimeout(() => logout(), 3000);
    });
}

function handleLoginSuccess(data) {
    console.log('معالجة تسجيل الدخول...');
    
    currentUser = data.user;
    currentRoom = data.room.id;
    systemSettings = data.systemSettings;

    document.getElementById('current-user-name').textContent = currentUser.displayName;
    document.getElementById('current-user-avatar').textContent = currentUser.customAvatar || currentUser.avatar;
    updateUserBadges();

    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('chat-screen').classList.add('active');

    hideLoading();
    showAlert(`🎉 مرحباً ${currentUser.displayName}!`, 'success');

    clearMessages();
    data.room.messages.forEach(msg => addMessage(msg));

    document.getElementById('message-input').disabled = false;
    document.querySelector('#message-form button').disabled = false;

    socket.emit('get-rooms');
    socket.emit('get-users', { roomId: currentRoom });

    if (currentUser.isSupremeLeader) {
        document.getElementById('supreme-panel-btn').style.display = 'inline-block';
    }

    startHeartbeat();
    createAnimations();
}

// تسجيل الدخول
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

// التسجيل
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

// إرسال رسالة
document.getElementById('message-form')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const textarea = document.getElementById('message-input');
    const text = textarea.value.trim();

    if (!text) return;

    if (text.length > 300) {
        showAlert('الرسالة طويلة جداً', 'error');
        return;
    }

    socket.emit('send-message', { text: text, roomId: currentRoom });
    textarea.value = '';
});

window.logout = function() {
    if (confirm('هل تريد تسجيل الخروج؟')) {
        showLoading('جاري تسجيل الخروج...');
        if (socket) socket.disconnect();
        setTimeout(() => location.reload(), 1000);
    }
};

// إضافة رسالة
function addMessage(message) {
    const container = document.getElementById('messages');
    if (!container) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.isSupremeLeader ? 'supreme-message' : ''}`;
    messageDiv.setAttribute('data-message-id', message.id);

    let badges = '';
    if (message.isSupremeLeader) {
        badges += '<span class="badge supreme-badge">👑 الزعيم</span>';
    } else if (message.isSuperAdmin) {
        badges += '<span class="badge admin-badge">🔧</span>';
    }
    if (message.isModerator) {
        badges += '<span class="badge moderator-badge">⭐</span>';
    }
    if (message.isVerified) {
        badges += '<span class="badge verified-badge">✅</span>';
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

    if (currentUser?.isSupremeLeader) {
        actions.push({ text: '👑 إضافة كمشرف', action: () => addModerator() });
        actions.push({ text: '🔇 كتم', action: () => muteUser() });
        actions.push({ text: '🚫 حظر', action: () => banUser() });
    } else if (currentUser?.isAdmin) {
        actions.push({ text: '🔇 كتم', action: () => muteUser() });
        actions.push({ text: '🚫 حظر', action: () => banUser() });
    }

    actions.push({ text: '💬 رسالة خاصة', action: () => alert('قريباً') });
    actions.push({ text: '❌ إلغاء', action: () => {} });

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

window.muteUser = function() {
    const duration = prompt(`مدة كتم ${selectedUsername} (دقائق، 0 للدائم):`, '10');
    if (duration === null) return;
    
    const reason = prompt('السبب:', 'مخالفة');
    if (!reason) return;

    socket.emit('mute-user', {
        userId: selectedUserId,
        username: selectedUsername,
        duration: parseInt(duration),
        reason: reason
    });
};

window.banUser = function() {
    if (!confirm(`حظر ${selectedUsername}؟`)) return;
    
    const reason = prompt('السبب:', 'مخالفة');
    if (!reason) return;

    socket.emit('ban-user', {
        userId: selectedUserId,
        username: selectedUsername,
        reason: reason
    });
};

window.addModerator = function() {
    if (!confirm(`إضافة ${selectedUsername} كمشرف؟`)) return;
    
    socket.emit('add-moderator', {
        userId: selectedUserId,
        username: selectedUsername,
        roomId: currentRoom
    });
};

window.showCreateRoomModal = function() {
    document.getElementById('create-room-modal').classList.add('active');
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
    socket.emit('join-room', { roomId: roomId });
};

window.toggleRoomsList = function() {
    const sidebar = document.getElementById('rooms-sidebar');
    sidebar.classList.toggle('active');
};

window.toggleUsersList = function() {
    const sidebar = document.getElementById('users-sidebar');
    sidebar.classList.toggle('active');
};

function updateRoomsList(rooms) {
    const container = document.getElementById('rooms-list');
    if (!container) return;

    container.innerHTML = '';

    rooms.forEach(room => {
        const div = document.createElement('div');
        div.className = 'room-item';
        div.onclick = () => joinRoom(room.id);

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

        container.appendChild(div);
    });
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
        if (user.isSupremeLeader) badges += '<span class="badge supreme-badge">👑</span>';
        else if (user.isSuperAdmin) badges += '<span class="badge admin-badge">🔧</span>';
        if (user.isModerator) badges += '<span class="badge moderator-badge">⭐</span>';
        if (user.isVerified) badges += '<span class="badge verified-badge">✅</span>';

        div.innerHTML = `
            <div class="user-avatar-wrapper">
                <div class="user-avatar">${escapeHtml(user.avatar)}</div>
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
        badges += '<span class="badge admin-badge">🔧</span>';
    }
    
    if (currentUser.isVerified) {
        badges += '<span class="badge verified-badge">✅</span>';
    }

    container.innerHTML = badges;
}

window.hideModal = function(modalId) {
    document.getElementById(modalId).classList.remove('active');
};

function clearMessages() {
    const container = document.getElementById('messages');
    if (container) container.innerHTML = '';
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
        error: '#dc2626',
        success: '#10b981',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    
    const alertDiv = document.createElement('div');
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

function showNotification(message) {
    const div = document.createElement('div');
    div.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: rgba(255,255,255,0.1);
        backdrop-filter: blur(10px);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        z-index: 9999;
        animation: slideInRight 0.3s ease-out;
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
    const div = document.getElementById('loading-overlay');
    if (div && div.parentNode) {
        document.body.removeChild(div);
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

function createAnimations() {
    createStars();
    createBugs();
    createLights();
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
    
    const bugEmojis = ['⚫', '⬛', '🕷️', '🦂'];
    
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
        'rgba(185, 28, 28, 0.4)'
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
        container.appendChild(light);
    }
}

// CSS للأنيميشن
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
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// التهيئة عند التحميل
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 الصفحة جاهزة');
    initializeSocket();
    createAnimations();
    
    document.getElementById('login-password')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') login();
    });
    
    document.getElementById('register-password')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') register();
    });
});

console.log('✅ السكريبت جاهز');
