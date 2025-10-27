// ═══════════════════════════════════════════════════════════════
// Cold Room Chat System V2 - Complete Client with Video Support
// ═══════════════════════════════════════════════════════════════
console.log('❄️ Cold Room V2 loading...');

let socket = null;
let currentUser = null;
let currentRoom = null;
let systemSettings = {};
let selectedUserId = null;
let selectedUsername = null;
let currentPrivateChatUser = null;
let selectedMuted = [];
let selectedBanned = [];
let confirmCallback = null;
let editingRoomId = null;
let ytPlayer = null;
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;

// ═══════════════════════════════════════════════════════════════
// SOCKET INITIALIZATION
// ═══════════════════════════════════════════════════════════════

function initializeSocket() {
    console.log('🔌 Connecting to server...');
    
    socket = io({
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: maxReconnectAttempts,
        timeout: 20000,
        forceNew: true
    });

    setupSocketListeners();
}

function setupSocketListeners() {
    socket.on('connect', () => {
        console.log('✅ Connected to server');
        reconnectAttempts = 0;
        hideLoading();
        
        // Re-authenticate if we were logged in
        if (currentUser && currentRoom) {
            console.log('🔄 Reconnecting to room...');
            socket.emit('join-room', { roomId: currentRoom });
        }
    });

    socket.on('disconnect', (reason) => {
        console.log('⚠️ Disconnected:', reason);
        if (reason === 'io server disconnect') {
            // Server disconnected us, try to reconnect
            socket.connect();
        }
    });

    socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error);
        reconnectAttempts++;
        
        if (reconnectAttempts >= maxReconnectAttempts) {
            showAlert('Connection lost. Please refresh the page.', 'error');
        }
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
        showAlert(`You are banned: ${data.reason}`, 'error');
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

    socket.on('message-edited', (data) => {
        const msgEl = document.querySelector(`[data-message-id="${data.messageId}"] .message-text`);
        if (msgEl) {
            msgEl.textContent = data.newText + ' (edited)';
        }
    });

    socket.on('new-private-message', (message) => {
        if (currentPrivateChatUser === message.from) {
            addPrivateMessage(message);
        }
        showNotification(`New message from ${message.fromName}`);
    });

    socket.on('private-message-sent', (message) => {
        addPrivateMessage(message);
    });

    socket.on('private-messages-list', (data) => {
        displayPrivateMessages(data.messages, data.withUserId);
    });

    socket.on('room-joined', (data) => {
        handleRoomJoined(data);
    });

    socket.on('room-created', (data) => {
        showAlert('Room created successfully', 'success');
        socket.emit('join-room', { roomId: data.roomId });
        hideModal('create-room-modal');
    });

    socket.on('room-updated', (data) => {
        if (socket.currentRoom === editingRoomId) {
            document.getElementById('room-info').textContent = data.name;
        }
        showNotification('Room updated');
    });

    socket.on('users-list', updateUsersList);
    socket.on('rooms-list', updateRoomsList);

    socket.on('user-joined', (data) => {
        showNotification(`${data.username} joined the room`);
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

    socket.on('party-mode-changed', (data) => {
        togglePartyEffects(data.enabled);
        showNotification(data.enabled ? '🎉 Party Mode ON!' : 'Party Mode OFF');
    });

    socket.on('youtube-started', (data) => {
        showYouTubePlayer(data.videoId);
        showNotification(`${data.startedBy} started a video`);
    });

    socket.on('youtube-stopped', () => {
        hideYouTubePlayer();
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
        showAlert(`You have been banned: ${data.reason}`, 'error');
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

// ═══════════════════════════════════════════════════════════════
// LOGIN & REGISTER
// ═══════════════════════════════════════════════════════════════

function handleLoginSuccess(data) {
    currentUser = data.user;
    currentRoom = data.room.id;
    systemSettings = data.systemSettings;

    document.getElementById('current-user-name').textContent = currentUser.displayName;
    document.getElementById('current-user-avatar').textContent = currentUser.avatar;
    updateUserBadges();

    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('chat-screen').classList.add('active');

    stopLoginMusic();
    playChatMusic();

    hideLoading();
    showAlert(`Welcome ${currentUser.displayName}! ❄️`, 'success');

    clearMessages();
    data.room.messages.forEach(msg => addMessage(msg));

    document.getElementById('message-input').disabled = false;
    document.querySelector('#message-form button').disabled = false;

    socket.emit('get-rooms');
    socket.emit('get-users', { roomId: currentRoom });

    if (currentUser.isOwner) {
        document.getElementById('owner-panel-btn').style.display = 'inline-block';
        document.getElementById('owner-tools').style.display = 'flex';
    }

    if (data.room.partyMode) {
        togglePartyEffects(true);
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
    
    if (data.room.partyMode) {
        togglePartyEffects(true);
    } else {
        togglePartyEffects(false);
    }
    
    socket.emit('get-users', { roomId: currentRoom });
    scrollToBottom();
}

window.login = function() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!username || !password) {
        showAlert('Please enter username and password', 'error');
        return;
    }

    showLoading('Logging in...');
    socket.emit('login', { username, password });
};

window.register = function() {
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value.trim();
    const displayName = document.getElementById('register-displayname').value.trim();
    const gender = document.getElementById('register-gender').value;

    if (!username || !password || !displayName || !gender) {
        showAlert('Please fill all fields', 'error');
        return;
    }

    if (username.length < 3 || username.length > 20) {
        showAlert('Username: 3-20 characters', 'error');
        return;
    }

    if (password.length < 6) {
        showAlert('Password: 6+ characters', 'error');
        return;
    }

    showLoading('Creating account...');
    socket.emit('register', { username, password, displayName, gender });
};

window.sendSupportMessage = function() {
    const message = document.getElementById('support-message').value.trim();
    
    if (!message) {
        showAlert('Please write your message', 'error');
        return;
    }

    socket.emit('send-support-message', {
        from: document.getElementById('login-username').value || 'Anonymous',
        message: message
    });

    document.getElementById('support-message').value = '';
};

window.logout = function(forced = false) {
    if (forced || confirm('Are you sure you want to logout?')) {
        showLoading('Logging out...');
        if (socket) socket.disconnect();
        setTimeout(() => location.reload(), 1000);
    }
};

// ═══════════════════════════════════════════════════════════════
// SEND MESSAGES
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

    if (!socket || !socket.connected) {
        showAlert('Connection lost. Reconnecting...', 'error');
        socket.connect();
        return;
    }

    socket.emit('send-message', { text: text, roomId: currentRoom });
    textarea.value = '';
}

function editMessage(messageId, currentText) {
    const newText = prompt('Edit your message:', currentText);
    if (newText && newText.trim() !== currentText) {
        socket.emit('edit-message', {
            messageId: messageId,
            newText: newText.trim()
        });
    }
}

// ═══════════════════════════════════════════════════════════════
// IMAGE & VIDEO UPLOAD (Owner Only)
// ═══════════════════════════════════════════════════════════════

window.showImageUpload = function() {
    document.getElementById('image-upload-modal').classList.add('active');
};

window.sendImageMessage = function() {
    const imageUrl = document.getElementById('image-url-input').value.trim();
    
    if (!imageUrl) {
        showAlert('Please enter image URL', 'error');
        return;
    }

    socket.emit('send-image', { imageUrl: imageUrl });
    document.getElementById('image-url-input').value = '';
    hideModal('image-upload-modal');
};

window.showVideoUpload = function() {
    document.getElementById('video-upload-modal').classList.add('active');
};

window.sendVideoMessage = function() {
    const videoUrl = document.getElementById('video-url-input').value.trim();
    
    if (!videoUrl) {
        showAlert('Please enter video URL (MP4)', 'error');
        return;
    }

    // Validate MP4 URL
    if (!videoUrl.toLowerCase().endsWith('.mp4')) {
        showAlert('Please enter a valid MP4 video URL', 'error');
        return;
    }

    socket.emit('send-video', { videoUrl: videoUrl });
    document.getElementById('video-url-input').value = '';
    hideModal('video-upload-modal');
};

// ═══════════════════════════════════════════════════════════════
// DISPLAY MESSAGES
// ═══════════════════════════════════════════════════════════════

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

    if (message.isVideo) {
        messageDiv.innerHTML = `
            <div class="message-header">
                <div>
                    <span class="message-user">${escapeHtml(message.avatar)} ${escapeHtml(message.username)}</span>
                    ${badges}
                </div>
            </div>
            <div class="message-video">
                <video controls style="max-width: 500px; max-height: 400px; border-radius: 10px;">
                    <source src="${escapeHtml(message.videoUrl)}" type="video/mp4">
                    Your browser does not support video playback.
                </video>
            </div>
            <div class="message-footer">
                <span class="message-time">${message.timestamp}</span>
            </div>
        `;
    } else if (message.isImage) {
        messageDiv.innerHTML = `
            <div class="message-header">
                <div>
                    <span class="message-user">${escapeHtml(message.avatar)} ${escapeHtml(message.username)}</span>
                    ${badges}
                </div>
            </div>
            <div class="message-image">
                <img src="${escapeHtml(message.imageUrl)}" alt="Image" style="max-width: 400px; border-radius: 10px;">
            </div>
            <div class="message-footer">
                <span class="message-time">${message.timestamp}</span>
            </div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="message-header">
                <div>
                    <span class="message-user">${escapeHtml(message.avatar)} ${escapeHtml(message.username)}</span>
                    ${badges}
                </div>
            </div>
            <div class="message-text">${escapeHtml(message.text)}${message.edited ? ' <small>(edited)</small>' : ''}</div>
            <div class="message-footer">
                <span class="message-time">${message.timestamp}</span>
            </div>
        `;
    }

    if (message.userId !== currentUser?.id || currentUser?.isOwner) {
        messageDiv.style.cursor = 'pointer';
        messageDiv.addEventListener('click', (e) => {
            if (!e.target.closest('.badge') && !e.target.closest('video') && !e.target.closest('img')) {
                selectedUserId = message.userId;
                selectedUsername = message.username;
                showMessageActions(message);
            }
        });
    }

    container.appendChild(messageDiv);
    scrollToBottom();
}

function showMessageActions(message) {
    const actions = [];

    // Own message actions
    if (message.userId === currentUser?.id && !message.isImage && !message.isVideo) {
        actions.push({ 
            text: '✏️ Edit My Message', 
            action: () => editMessage(message.id, message.text)
        });
    }

    // Owner actions
    if (currentUser?.isOwner) {
        if (message.userId !== currentUser.id) {
            actions.push({ text: '👑 Add Moderator', action: () => addModerator() });
            actions.push({ text: '⭐ Remove Moderator', action: () => removeModerator() });
            actions.push({ text: '🔇 Mute User', action: () => showMuteDialog() });
            actions.push({ text: '🚫 Ban User', action: () => banUser() });
            actions.push({ text: '🗑️ Delete Account', action: () => deleteAccount() });
        }
        actions.push({ text: '❌ Delete Message', action: () => deleteMessage(message.id) });
    } 
    // Moderator actions
    else if (currentUser?.isModerator && message.userId !== currentUser.id) {
        actions.push({ text: '🔇 Mute User', action: () => showMuteDialog() });
    }

    // Everyone can send private messages
    if (message.userId !== currentUser?.id) {
        actions.push({ text: '💬 Private Message', action: () => openPrivateChat(selectedUserId) });
    }

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

    menu.style.display = 'flex';

    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target) && !e.target.closest('.message')) {
                menu.style.display = 'none';
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 100);
}

// ═══════════════════════════════════════════════════════════════
// USER ACTIONS
// ═══════════════════════════════════════════════════════════════

window.showMuteDialog = function() {
    const duration = prompt(`Mute ${selectedUsername} for how many minutes?\n\nEnter 0 for permanent mute:`, '10');
    if (duration === null) return;
    
    const durationNum = parseInt(duration);
    const isPermanent = durationNum === 0;
    
    const reason = prompt('Reason for mute:', 'Violation of chat rules');
    if (!reason) return;

    socket.emit('mute-user', {
        userId: selectedUserId,
        username: selectedUsername,
        duration: durationNum,
        reason: reason,
        roomId: currentRoom
    });
};

window.banUser = function() {
    showConfirm(
        `Ban ${selectedUsername} permanently?\n\nThis will:\n• Ban their IP address\n• Kick them immediately\n• Prevent them from returning\n\nAre you sure?`,
        (confirmed) => {
            if (confirmed) {
                const reason = prompt('Reason for ban:', 'Serious rule violation');
                if (reason) {
                    socket.emit('ban-user', {
                        userId: selectedUserId,
                        username: selectedUsername,
                        reason: reason
                    });
                }
            }
        }
    );
};

window.deleteAccount = function() {
    showConfirm(
        `⚠️ DELETE ACCOUNT: ${selectedUsername}?\n\nThis action will:\n• Delete ALL their messages\n• Remove them from all rooms\n• Permanently delete their account\n\n⚠️ THIS CANNOT BE UNDONE!\n\nAre you absolutely sure?`,
        (confirmed) => {
            if (confirmed) {
                socket.emit('delete-account', {
                    userId: selectedUserId
                });
            }
        }
    );
};

window.addModerator = function() {
    if (!confirm(`Add ${selectedUsername} as a moderator?\n\nModerators can mute users.`)) return;
    
    socket.emit('add-moderator', {
        userId: selectedUserId,
        username: selectedUsername,
        roomId: currentRoom
    });
};

window.removeModerator = function() {
    if (!confirm(`Remove ${selectedUsername} from moderators?`)) return;
    
    socket.emit('remove-moderator', {
        userId: selectedUserId,
        username: selectedUsername,
        roomId: currentRoom
    });
};

function deleteMessage(messageId) {
    socket.emit('delete-message', {
        messageId: messageId,
        roomId: currentRoom
    });
}

function openPrivateChat(userId) {
    currentPrivateChatUser = userId;
    socket.emit('get-private-messages', { withUserId: userId });
    document.getElementById('private-messages-modal').classList.add('active');
    
    const user = Array.from(document.querySelectorAll('.user-item'))
        .find(el => el.dataset.userId === userId);
    
    if (user) {
        document.getElementById('private-header').textContent = `Chat with ${user.dataset.userName}`;
    }
}

// Continue in Part 2...
// ═══════════════════════════════════════════════════════════════
// Cold Room V2 - Script Part 2 (Rooms, Settings, Effects)
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// PRIVATE MESSAGES
// ═══════════════════════════════════════════════════════════════

window.showPrivateMessages = function() {
    document.getElementById('private-messages-modal').classList.add('active');
    loadPrivateUsersList();
};

function loadPrivateUsersList() {
    const container = document.getElementById('private-users-list');
    socket.emit('get-users', { roomId: currentRoom });
    
    socket.once('users-list', (users) => {
        container.innerHTML = '';
        users.forEach(user => {
            if (user.id === currentUser?.id) return;
            
            const div = document.createElement('div');
            div.className = 'private-user-item';
            div.dataset.userId = user.id;
            div.dataset.userName = user.displayName;
            div.innerHTML = `
                <span>${user.avatar}</span>
                <span>${escapeHtml(user.displayName)}</span>
            `;
            div.onclick = () => openPrivateChat(user.id);
            container.appendChild(div);
        });
    });
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

function displayPrivateMessages(messages, withUserId) {
    const container = document.getElementById('private-messages');
    if (!container) return;

    container.innerHTML = '';

    messages.forEach(msg => {
        const div = document.createElement('div');
        const isFromMe = msg.from === currentUser?.id;
        div.className = `message ${isFromMe ? 'my-message' : ''}`;
        div.innerHTML = `
            <div class="message-header">
                <span class="message-user">${escapeHtml(msg.fromName)}</span>
            </div>
            <div class="message-text">${escapeHtml(msg.text)}${msg.edited ? ' <small>(edited)</small>' : ''}</div>
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

    const isFromMe = message.from === currentUser?.id;
    const div = document.createElement('div');
    div.className = `message ${isFromMe ? 'my-message' : ''}`;
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

// ═══════════════════════════════════════════════════════════════
// ROOM MANAGEMENT
// ═══════════════════════════════════════════════════════════════

window.showCreateRoomModal = function() {
    document.getElementById('create-room-modal').classList.add('active');
};

window.createRoom = function() {
    const name = document.getElementById('room-name-input').value.trim();
    const description = document.getElementById('room-desc-input').value.trim();
    const password = document.getElementById('room-pass-input').value.trim();

    if (!name) {
        showAlert('Please enter room name', 'error');
        return;
    }

    socket.emit('create-room', { name, description, password });
    
    document.getElementById('room-name-input').value = '';
    document.getElementById('room-desc-input').value = '';
    document.getElementById('room-pass-input').value = '';
};

window.joinRoom = function(roomId) {
    const room = Array.from(document.querySelectorAll('.room-item'))
        .find(el => el.dataset.roomId === roomId);
    
    if (room && room.dataset.hasPassword === 'true') {
        const password = prompt('Enter room password:');
        if (password) {
            socket.emit('join-room', { roomId: roomId, password: password });
        }
    } else {
        socket.emit('join-room', { roomId: roomId });
    }
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
        div.dataset.roomId = room.id;
        div.dataset.hasPassword = room.hasPassword;
        
        const lock = room.hasPassword ? '🔒 ' : '';
        const official = room.isOfficial ? '⭐ ' : '';

        div.innerHTML = `
            <div class="room-item-name">${official}${lock}${escapeHtml(room.name)}</div>
            <div class="room-item-desc">${escapeHtml(room.description)
