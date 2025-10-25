const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000
});

const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));
app.use(express.json());

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// قواعد البيانات
const users = new Map();
const rooms = new Map();
const mutedUsers = new Map();
const bannedUsers = new Map();
const bannedIPs = new Map();
const onlineUsers = new Map();
const privateMessages = new Map();
const supportMessages = new Map();

// إعدادات النظام
let systemSettings = {
  siteLogo: 'https://i.ibb.co/ZYW3VTp/cold-room-logo.png',
  siteTitle: 'Cold Room',
  backgroundMusic: '',
  adminPassword: 'ColdKing@2025'
};

// إنشاء حساب المالك
function createOwner() {
  const ownerId = 'owner_cold_001';
  const owner = {
    id: ownerId,
    username: 'COLDKING',
    displayName: 'Cold Room King',
    password: bcrypt.hashSync(systemSettings.adminPassword, 10),
    isOwner: true,
    avatar: '👑',
    specialBadges: ['👑'],
    joinDate: new Date()
  };
  users.set(ownerId, owner);
  privateMessages.set(ownerId, new Map());
  console.log('✅ Owner created: COLDKING / ColdKing@2025');
  return owner;
}

// الغرفة العالمية
function createGlobalRoom() {
  const globalRoom = {
    id: 'global_cold',
    name: '❄️ Cold Room - Global',
    description: 'Official Cold Room',
    createdBy: 'Cold Room King',
    creatorId: 'owner_cold_001',
    users: new Set(),
    messages: [],
    isOfficial: true,
    moderators: new Set(),
    isSilenced: false
  };
  rooms.set(globalRoom.id, globalRoom);
  console.log('✅ Global room created');
  return globalRoom;
}

createOwner();
createGlobalRoom();

// تنظيف تلقائي
setInterval(() => {
  const now = Date.now();
  for (const [userId, lastSeen] of onlineUsers.entries()) {
    if (now - lastSeen > 300000) onlineUsers.delete(userId);
  }
  for (const [userId, muteData] of mutedUsers.entries()) {
    if (muteData.temporary && muteData.expires && now > muteData.expires) {
      mutedUsers.delete(userId);
    }
  }
}, 60000);

// Socket.IO
io.on('connection', (socket) => {
  console.log('🔗 Connection:', socket.id);
  socket.userIP = socket.handshake.address;

  // تسجيل الدخول
  socket.on('login', async (data) => {
    try {
      const { username, password } = data;
      if (!username || !password) {
        return socket.emit('login-error', 'Please enter all fields');
      }

      if (bannedIPs.has(socket.userIP)) {
        return socket.emit('banned-user', { reason: 'Your IP is banned' });
      }

      let userFound = null;
      let userId = null;

      for (const [id, user] of users.entries()) {
        if (user.username.toLowerCase() === username.toLowerCase()) {
          if (bcrypt.compareSync(password, user.password)) {
            userFound = user;
            userId = id;
            break;
          }
        }
      }

      if (!userFound) {
        return socket.emit('login-error', 'Invalid username or password');
      }

      if (bannedUsers.has(userId)) {
        const banInfo = bannedUsers.get(userId);
        return socket.emit('banned-user', { reason: banInfo.reason });
      }

      socket.userId = userId;
      socket.userData = userFound;
      userFound.lastActive = new Date();
      onlineUsers.set(userId, Date.now());

      const globalRoom = rooms.get('global_cold');
      globalRoom.users.add(userId);
      socket.join('global_cold');
      socket.currentRoom = 'global_cold';

      socket.emit('login-success', {
        user: {
          id: userId,
          username: userFound.username,
          displayName: userFound.displayName,
          avatar: userFound.avatar,
          isOwner: userFound.isOwner || false,
          specialBadges: userFound.specialBadges || []
        },
        room: {
          id: globalRoom.id,
          name: globalRoom.name,
          messages: globalRoom.messages.slice(-50)
        },
        systemSettings: systemSettings
      });

      io.to('global_cold').emit('user-joined', {
        username: userFound.displayName,
        avatar: userFound.avatar
      });

      updateRoomsList();
      updateUsersList('global_cold');

    } catch (error) {
      console.error('Login error:', error);
      socket.emit('login-error', 'Login failed');
    }
  });

  // التسجيل
  socket.on('register', async (data) => {
    try {
      const { username, password, displayName } = data;

      if (!username || !password || !displayName) {
        return socket.emit('register-error', 'Please fill all fields');
      }

      if (username.length < 3 || username.length > 20) {
        return socket.emit('register-error', 'Username must be 3-20 characters');
      }

      if (password.length < 6) {
        return socket.emit('register-error', 'Password must be 6+ characters');
      }

      for (const user of users.values()) {
        if (user.username.toLowerCase() === username.toLowerCase()) {
          return socket.emit('register-error', 'Username already exists');
        }
      }

      const userId = 'user_' + uuidv4();
      const hashedPassword = bcrypt.hashSync(password, 10);

      const newUser = {
        id: userId,
        username: username,
        displayName: displayName,
        password: hashedPassword,
        isOwner: false,
        joinDate: new Date(),
        avatar: '👤',
        specialBadges: []
      };

      users.set(userId, newUser);
      privateMessages.set(userId, new Map());

      socket.emit('register-success', {
        message: 'Account created successfully!',
        username: username
      });

    } catch (error) {
      console.error('Register error:', error);
      socket.emit('register-error', 'Registration failed');
    }
  });

  // إرسال رسالة
  socket.on('send-message', async (data) => {
    try {
      const user = users.get(socket.userId);
      if (!user || !socket.currentRoom) return;

      const room = rooms.get(socket.currentRoom);
      if (!room) return;

      if (room.isSilenced && !user.isOwner) {
        return socket.emit('message-error', 'Room is silenced');
      }

      const muteInfo = mutedUsers.get(socket.userId);
      if (muteInfo && (!muteInfo.temporary || muteInfo.expires > Date.now())) {
        return socket.emit('message-error', 'You are muted');
      }

      const message = {
        id: 'msg_' + uuidv4(),
        userId: socket.userId,
        username: user.displayName,
        avatar: user.avatar,
        text: data.text.trim().substring(0, 500),
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        isOwner: user.isOwner || false,
        isModerator: room.moderators.has(socket.userId),
        specialBadges: user.specialBadges || [],
        roomId: socket.currentRoom
      };

      room.messages.push(message);
      if (room.messages.length > 100) {
        room.messages = room.messages.slice(-100);
      }

      io.to(socket.currentRoom).emit('new-message', message);
      onlineUsers.set(socket.userId, Date.now());

    } catch (error) {
      console.error('Message error:', error);
    }
  });

  // إرسال رسالة خاصة
  socket.on('send-private-message', async (data) => {
    try {
      const sender = users.get(socket.userId);
      const receiver = users.get(data.toUserId);
      
      if (!sender || !receiver) return;

      const message = {
        id: 'pm_' + uuidv4(),
        from: socket.userId,
        to: data.toUserId,
        fromName: sender.displayName,
        text: data.text.trim().substring(0, 500),
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        date: new Date()
      };

      // حفظ الرسالة عند الطرفين
      if (!privateMessages.has(socket.userId)) {
        privateMessages.set(socket.userId, new Map());
      }
      if (!privateMessages.get(socket.userId).has(data.toUserId)) {
        privateMessages.get(socket.userId).set(data.toUserId, []);
      }
      privateMessages.get(socket.userId).get(data.toUserId).push(message);

      if (!privateMessages.has(data.toUserId)) {
        privateMessages.set(data.toUserId, new Map());
      }
      if (!privateMessages.get(data.toUserId).has(socket.userId)) {
        privateMessages.get(data.toUserId).set(socket.userId, []);
      }
      privateMessages.get(data.toUserId).get(socket.userId).push(message);

      // إرسال للمستلم إذا كان متصل
      const receiverSocket = Array.from(io.sockets.sockets.values())
        .find(s => s.userId === data.toUserId);
      
      if (receiverSocket) {
        receiverSocket.emit('new-private-message', message);
      }

      socket.emit('private-message-sent', message);

    } catch (error) {
      console.error('Private message error:', error);
    }
  });

  // جلب الرسائل الخاصة
  socket.on('get-private-messages', async (data) => {
    try {
      const messages = privateMessages.get(socket.userId)?.get(data.withUserId) || [];
      socket.emit('private-messages-list', {
        withUserId: data.withUserId,
        messages: messages.slice(-30)
      });
    } catch (error) {
      console.error('Get PM error:', error);
    }
  });

  // تغيير الاسم
  socket.on('change-display-name', async (data) => {
    try {
      const user = users.get(socket.userId);
      if (!user) return;

      const newName = data.newName.trim().substring(0, 30);
      if (!newName) {
        return socket.emit('error', 'Invalid name');
      }

      user.displayName = newName;
      socket.emit('action-success', 'Name changed successfully');
      
      // تحديث للجميع في الغرفة
      updateUsersList(socket.currentRoom);

    } catch (error) {
      console.error('Change name error:', error);
    }
  });

  // إنشاء غرفة
  socket.on('create-room', async (data) => {
    try {
      const user = users.get(socket.userId);
      if (!user) return;

      const roomId = 'room_' + uuidv4();
      const newRoom = {
        id: roomId,
        name: data.name.substring(0, 50),
        description: data.description?.substring(0, 200) || '',
        createdBy: user.displayName,
        creatorId: socket.userId,
        users: new Set([socket.userId]),
        messages: [],
        isOfficial: false,
        hasPassword: !!data.password,
        password: data.password ? bcrypt.hashSync(data.password, 10) : null,
        moderators: new Set(),
        isSilenced: false
      };

      rooms.set(roomId, newRoom);
      socket.emit('room-created', { roomId: roomId, roomName: newRoom.name });
      updateRoomsList();

    } catch (error) {
      console.error('Create room error:', error);
    }
  });

  // الانضمام لغرفة
  socket.on('join-room', async (data) => {
    try {
      const user = users.get(socket.userId);
      if (!user) return;

      const room = rooms.get(data.roomId);
      if (!room) return socket.emit('error', 'Room not found');

      if (room.hasPassword && !user.isOwner) {
        if (!data.password || !bcrypt.compareSync(data.password, room.password)) {
          return socket.emit('error', 'Wrong password');
        }
      }

      if (socket.currentRoom && socket.currentRoom !== 'global_cold') {
        const prevRoom = rooms.get(socket.currentRoom);
        if (prevRoom) {
          prevRoom.users.delete(socket.userId);
          socket.leave(socket.currentRoom);
        }
      }

      room.users.add(socket.userId);
      socket.join(data.roomId);
      socket.currentRoom = data.roomId;

      socket.emit('room-joined', {
        room: {
          id: room.id,
          name: room.name,
          description: room.description,
          messages: room.messages.slice(-50),
          isCreator: room.creatorId === socket.userId,
          isModerator: room.moderators.has(socket.userId)
        }
      });

      io.to(data.roomId).emit('user-joined', {
        username: user.displayName,
        avatar: user.avatar
      });

      updateUsersList(data.roomId);

    } catch (error) {
      console.error('Join room error:', error);
    }
  });

  // كتم
  socket.on('mute-user', async (data) => {
    try {
      const admin = users.get(socket.userId);
      const targetUser = users.get(data.userId);
      
      if (!admin || !targetUser) return;
      if (targetUser.isOwner) return socket.emit('error', 'Cannot mute owner');

      const room = rooms.get(socket.currentRoom);
      const canMute = admin.isOwner || room?.moderators.has(socket.userId);

      if (!canMute) return socket.emit('error', 'No permission');

      const duration = parseInt(data.duration) || 10;
      mutedUsers.set(data.userId, {
        expires: duration > 0 ? Date.now() + (duration * 60000) : null,
        reason: data.reason || 'Rule violation',
        mutedBy: admin.displayName,
        temporary: duration > 0
      });

      socket.emit('action-success', `Muted ${targetUser.displayName}`);

    } catch (error) {
      console.error('Mute error:', error);
    }
  });

  // حظر
  socket.on('ban-user', async (data) => {
    try {
      const admin = users.get(socket.userId);
      const targetUser = users.get(data.userId);
      
      if (!admin || !targetUser) return;
      if (!admin.isOwner) return socket.emit('error', 'Only owner can ban');
      if (targetUser.isOwner) return socket.emit('error', 'Cannot ban owner');

      bannedUsers.set(data.userId, {
        reason: data.reason || 'Banned',
        bannedBy: admin.displayName,
        bannedAt: new Date()
      });

      // حظر IP
      bannedIPs.set(socket.userIP, {
        userId: data.userId,
        bannedAt: new Date()
      });

      const targetSocket = Array.from(io.sockets.sockets.values())
        .find(s => s.userId === data.userId);
      
      if (targetSocket) {
        targetSocket.emit('banned', { reason: data.reason });
        targetSocket.disconnect(true);
      }

      socket.emit('action-success', `Banned ${targetUser.displayName}`);

    } catch (error) {
      console.error('Ban error:', error);
    }
  });

  // حذف حساب
  socket.on('delete-account', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isOwner) {
        return socket.emit('error', 'Only owner can delete accounts');
      }

      const targetUser = users.get(data.userId);
      if (!targetUser) return;
      if (targetUser.isOwner) return socket.emit('error', 'Cannot delete owner');

      // حذف المستخدم
      users.delete(data.userId);
      privateMessages.delete(data.userId);
      mutedUsers.delete(data.userId);
      bannedUsers.delete(data.userId);

      // طرده من جميع الغرف
      rooms.forEach(room => room.users.delete(data.userId));

      // قطع اتصاله
      const targetSocket = Array.from(io.sockets.sockets.values())
        .find(s => s.userId === data.userId);
      
      if (targetSocket) {
        targetSocket.emit('account-deleted', { message: 'Your account has been deleted' });
        targetSocket.disconnect(true);
      }

      socket.emit('action-success', `Deleted account: ${targetUser.displayName}`);
      updateUsersList(socket.currentRoom);

    } catch (error) {
      console.error('Delete account error:', error);
    }
  });

  // إلغاء الكتم
  socket.on('unmute-user', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin) return;

      const canUnmute = admin.isOwner || rooms.get(socket.currentRoom)?.moderators.has(socket.userId);
      if (!canUnmute) return socket.emit('error', 'No permission');

      mutedUsers.delete(data.userId);
      socket.emit('action-success', 'User unmuted');

    } catch (error) {
      console.error('Unmute error:', error);
    }
  });

  // إلغاء الحظر
  socket.on('unban-user', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isOwner) {
        return socket.emit('error', 'Only owner can unban');
      }

      const banInfo = bannedUsers.get(data.userId);
      if (banInfo && banInfo.userIP) {
        bannedIPs.delete(banInfo.userIP);
      }

      bannedUsers.delete(data.userId);
      socket.emit('action-success', 'User unbanned');

    } catch (error) {
      console.error('Unban error:', error);
    }
  });

  // إضافة مشرف
  socket.on('add-moderator', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isOwner) {
        return socket.emit('error', 'Only owner can add moderators');
      }

      const room = rooms.get(data.roomId || socket.currentRoom);
      if (!room) return;

      room.moderators.add(data.userId);
      socket.emit('action-success', 'Moderator added');
      updateUsersList(room.id);

    } catch (error) {
      console.error('Add mod error:', error);
    }
  });

  // حذف رسالة
  socket.on('delete-message', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isOwner) {
        return socket.emit('error', 'Only owner can delete messages');
      }

      const room = rooms.get(data.roomId);
      if (!room) return;

      const index = room.messages.findIndex(m => m.id === data.messageId);
      if (index !== -1) {
        room.messages.splice(index, 1);
        io.to(data.roomId).emit('message-deleted', { messageId: data.messageId });
      }

    } catch (error) {
      console.error('Delete message error:', error);
    }
  });

  // تنظيف الشات
  socket.on('clean-chat', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isOwner) {
        return socket.emit('error', 'Only owner can clean chat');
      }

      const room = rooms.get(data.roomId);
      if (!room) return;

      room.messages = [];
      io.to(data.roomId).emit('chat-cleaned', { message: 'Chat cleaned' });

    } catch (error) {
      console.error('Clean chat error:', error);
    }
  });

  // صمت الغرفة
  socket.on('silence-room', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isOwner) {
        return socket.emit('error', 'Only owner can silence rooms');
      }

      const room = rooms.get(data.roomId);
      if (!room) return;

      room.isSilenced = true;
      io.to(data.roomId).emit('room-silenced', { message: 'Room silenced' });

    } catch (error) {
      console.error('Silence error:', error);
    }
  });

  // إلغاء صمت الغرفة
  socket.on('unsilence-room', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isOwner) {
        return socket.emit('error', 'Only owner');
      }

      const room = rooms.get(data.roomId);
      if (!room) return;

      room.isSilenced = false;
      io.to(data.roomId).emit('room-unsilenced', { message: 'Room unsilenced' });

    } catch (error) {
      console.error('Unsilence error:', error);
    }
  });

  // حذف غرفة
  socket.on('delete-room', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isOwner) {
        return socket.emit('error', 'Only owner can delete rooms');
      }

      const room = rooms.get(data.roomId);
      if (!room || room.isOfficial) {
        return socket.emit('error', 'Cannot delete this room');
      }

      io.to(data.roomId).emit('room-deleted', { message: 'Room deleted' });
      rooms.delete(data.roomId);
      updateRoomsList();

    } catch (error) {
      console.error('Delete room error:', error);
    }
  });

  // تحديث الإعدادات
  socket.on('update-settings', async (data) => {
    try {
      const user = users.get(socket.userId);
      if (!user || !user.isOwner) {
        return socket.emit('error', 'Only owner can update settings');
      }

      if (data.siteLogo) systemSettings.siteLogo = data.siteLogo;
      if (data.siteTitle) systemSettings.siteTitle = data.siteTitle;
      if (data.backgroundMusic !== undefined) systemSettings.backgroundMusic = data.backgroundMusic;

      io.emit('settings-updated', systemSettings);
      socket.emit('action-success', 'Settings updated');

    } catch (error) {
      console.error('Update settings error:', error);
    }
  });

  // رسالة دعم
  socket.on('send-support-message', async (data) => {
    try {
      const messageId = 'support_' + uuidv4();
      supportMessages.set(messageId, {
        id: messageId,
        from: data.from || 'Anonymous',
        message: data.message.trim().substring(0, 500),
        sentAt: new Date(),
        fromIP: socket.userIP
      });

      socket.emit('support-message-sent', { message: 'Message sent to owner' });

    } catch (error) {
      console.error('Support message error:', error);
    }
  });

  // جلب رسائل الدعم
  socket.on('get-support-messages', async () => {
    try {
      const user = users.get(socket.userId);
      if (!user || !user.isOwner) return;

      const messages = Array.from(supportMessages.values());
      socket.emit('support-messages-list', messages);

    } catch (error) {
      console.error('Get support error:', error);
    }
  });

  // حذف رسالة دعم
  socket.on('delete-support-message', async (data) => {
    try {
      const user = users.get(socket.userId);
      if (!user || !user.isOwner) return;

      supportMessages.delete(data.messageId);
      socket.emit('action-success', 'Message deleted');

    } catch (error) {
      console.error('Delete support error:', error);
    }
  });

  socket.on('get-rooms', () => updateRoomsList(socket));
  socket.on('get-users', (data) => updateUsersList(data.roomId, socket));
  
  socket.on('get-muted-list', () => {
    const user = users.get(socket.userId);
    if (!user || !user.isOwner) return;

    const list = Array.from(mutedUsers.entries()).map(([userId, info]) => {
      const targetUser = users.get(userId);
      return {
        userId: userId,
        username: targetUser?.displayName || 'Unknown',
        ...info
      };
    });

    socket.emit('muted-list', list);
  });

  socket.on('get-banned-list', () => {
    const user = users.get(socket.userId);
    if (!user || !user.isOwner) return;

    const list = Array.from(bannedUsers.entries()).map(([userId, info]) => {
      const targetUser = users.get(userId);
      return {
        userId: userId,
        username: targetUser?.displayName || 'Unknown',
        ...info
      };
    });

    socket.emit('banned-list', list);
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      rooms.forEach(room => {
        if (!room.isOfficial) room.users.delete(socket.userId);
      });
    }
    console.log('🔌 Disconnect:', socket.id);
  });

  socket.on('ping', () => {
    if (socket.userId) {
      onlineUsers.set(socket.userId, Date.now());
    }
  });
});

function updateRoomsList(socket = null) {
  const roomList = Array.from(rooms.values()).map(room => ({
    id: room.id,
    name: room.name,
    description: room.description,
    userCount: room.users.size,
    hasPassword: room.hasPassword,
    isOfficial: room.isOfficial,
    createdBy: room.createdBy
  }));

  if (socket) {
    socket.emit('rooms-list', roomList);
  } else {
    io.emit('rooms-list', roomList);
  }
}

function updateUsersList(roomId, socket = null) {
  const room = rooms.get(roomId);
  if (!room) return;

  const userList = Array.from(room.users).map(userId => {
    const user = users.get(userId);
    if (!user) return null;

    return {
      id: userId,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      isOnline: onlineUsers.has(userId),
      isOwner: user.isOwner || false,
      isModerator: room.moderators.has(userId),
      specialBadges: user.specialBadges || []
    };
  }).filter(Boolean).filter(u => onlineUsers.has(u.id));

  if (socket) {
    socket.emit('users-list', userList);
  } else {
    io.to(roomId).emit('users-list', userList);
  }
}

process.on('uncaughtException', (error) => {
  console.error('❌ Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Rejection:', error);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════╗
║        ❄️  Cold Room Server Started       ║
║  Port: ${PORT}                             ║
║  Status: ✅ Ready                          ║
╚════════════════════════════════════════════╝
  `);
});
