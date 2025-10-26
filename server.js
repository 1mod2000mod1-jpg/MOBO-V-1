const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000
});

const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// قواعد البيانات (تحفظ في ملفات)
const DATA_FILE = 'cold_room_data.json';

let data = {
  users: {},
  rooms: {},
  mutedUsers: {},
  bannedUsers: {},
  bannedIPs: {},
  privateMessages: {},
  supportMessages: {},
  systemSettings: {
    siteLogo: 'https://i.ibb.co/ZYW3VTp/cold-room-logo.png',
    siteTitle: 'Cold Room',
    backgroundColor: 'blue',
    loginMusic: '',
    chatMusic: '',
    loginMusicVolume: 0.5,
    chatMusicVolume: 0.5,
    partyMode: {}
  }
};

// تحميل البيانات
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const fileData = fs.readFileSync(DATA_FILE, 'utf8');
      const loaded = JSON.parse(fileData);
      data = { ...data, ...loaded };
      console.log('✅ Data loaded from file');
    }
  } catch (error) {
    console.log('⚠️ No saved data found, using defaults');
  }
}

// حفظ البيانات
function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Error saving data:', error);
  }
}

loadData();

const users = new Map(Object.entries(data.users || {}));
const rooms = new Map(Object.entries(data.rooms || {}));
const mutedUsers = new Map(Object.entries(data.mutedUsers || {}));
const bannedUsers = new Map(Object.entries(data.bannedUsers || {}));
const bannedIPs = new Map(Object.entries(data.bannedIPs || {}));
const privateMessages = new Map(Object.entries(data.privateMessages || {}));
const supportMessages = new Map(Object.entries(data.supportMessages || {}));
const onlineUsers = new Map();
let systemSettings = data.systemSettings;

// حفظ دوري
setInterval(() => {
  data.users = Object.fromEntries(users);
  data.rooms = Object.fromEntries(rooms);
  data.mutedUsers = Object.fromEntries(mutedUsers);
  data.bannedUsers = Object.fromEntries(bannedUsers);
  data.bannedIPs = Object.fromEntries(bannedIPs);
  data.privateMessages = Object.fromEntries(privateMessages);
  data.supportMessages = Object.fromEntries(supportMessages);
  data.systemSettings = systemSettings;
  saveData();
}, 30000); // كل 30 ثانية

// إنشاء المالك
function createOwner() {
  const ownerId = 'owner_cold_001';
  if (!users.has(ownerId)) {
    const owner = {
      id: ownerId,
      username: 'COLDKING',
      displayName: 'Cold Room King',
      password: bcrypt.hashSync('ColdKing@2025', 10),
      isOwner: true,
      avatar: '👑',
      gender: 'male',
      specialBadges: ['👑'],
      joinDate: new Date().toISOString(),
      canSendImages: true
    };
    users.set(ownerId, owner);
    privateMessages.set(ownerId, {});
    console.log('✅ Owner created');
  }
}

// الغرفة العالمية
function createGlobalRoom() {
  const globalId = 'global_cold';
  if (!rooms.has(globalId)) {
    const globalRoom = {
      id: globalId,
      name: '❄️ Cold Room - Global',
      description: 'Main room',
      createdBy: 'Cold Room King',
      creatorId: 'owner_cold_001',
      users: [],
      messages: [],
      isOfficial: true,
      moderators: [],
      isSilenced: false,
      createdAt: new Date().toISOString()
    };
    rooms.set(globalId, globalRoom);
    console.log('✅ Global room created');
  }
}

createOwner();
createGlobalRoom();

// تنظيف
setInterval(() => {
  const now = Date.now();
  for (const [userId, lastSeen] of onlineUsers.entries()) {
    if (now - lastSeen > 300000) onlineUsers.delete(userId);
  }
  
  for (const [userId, muteData] of mutedUsers.entries()) {
    if (muteData.temporary && muteData.expires && now > muteData.expires) {
      if (!muteData.byOwner) {
        mutedUsers.delete(userId);
      }
    }
  }
}, 60000);

// Socket.IO
io.on('connection', (socket) => {
  console.log('🔗 Connection:', socket.id);
  socket.userIP = socket.handshake.address;

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
        return socket.emit('login-error', 'Invalid credentials');
      }

      if (bannedUsers.has(userId)) {
        const banInfo = bannedUsers.get(userId);
        return socket.emit('banned-user', { reason: banInfo.reason });
      }

      socket.userId = userId;
      socket.userData = userFound;
      userFound.lastActive = new Date().toISOString();
      onlineUsers.set(userId, Date.now());

      const globalRoom = rooms.get('global_cold');
      if (!globalRoom.users.includes(userId)) {
        globalRoom.users.push(userId);
      }
      socket.join('global_cold');
      socket.currentRoom = 'global_cold';

      socket.emit('login-success', {
        user: {
          id: userId,
          username: userFound.username,
          displayName: userFound.displayName,
          avatar: userFound.avatar,
          gender: userFound.gender,
          isOwner: userFound.isOwner || false,
          canSendImages: userFound.canSendImages || false,
          specialBadges: userFound.specialBadges || []
        },
        room: {
          id: globalRoom.id,
          name: globalRoom.name,
          messages: globalRoom.messages.slice(-100),
          partyMode: systemSettings.partyMode[globalRoom.id] || false
        },
        systemSettings: {
          ...systemSettings,
          currentColor: systemSettings.backgroundColor
        }
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

  socket.on('register', async (data) => {
    try {
      const { username, password, displayName, gender } = data;

      if (!username || !password || !displayName || !gender) {
        return socket.emit('register-error', 'Please fill all fields');
      }

      if (username.length < 3 || username.length > 20) {
        return socket.emit('register-error', 'Username: 3-20 characters');
      }

      if (password.length < 6) {
        return socket.emit('register-error', 'Password: 6+ characters');
      }

      for (const user of users.values()) {
        if (user.username.toLowerCase() === username.toLowerCase()) {
          return socket.emit('register-error', 'Username exists');
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
        joinDate: new Date().toISOString(),
        avatar: gender === 'prince' ? '🤴' : gender === 'princess' ? '👸' : '👤',
        gender: gender,
        specialBadges: [],
        canSendImages: false
      };

      users.set(userId, newUser);
      privateMessages.set(userId, {});

      socket.emit('register-success', {
        message: 'Account created!',
        username: username
      });

      saveData();

    } catch (error) {
      console.error('Register error:', error);
      socket.emit('register-error', 'Registration failed');
    }
  });

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
      if (muteInfo) {
        const canUnmute = !muteInfo.byOwner && muteInfo.temporary && muteInfo.expires <= Date.now();
        if (!canUnmute) {
          return socket.emit('message-error', 'You are muted');
        } else {
          mutedUsers.delete(socket.userId);
        }
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
        date: new Date().toISOString(),
        isOwner: user.isOwner || false,
        isModerator: room.moderators.includes(socket.userId),
        specialBadges: user.specialBadges || [],
        roomId: socket.currentRoom,
        edited: false,
        isImage: false
      };

      room.messages.push(message);
      
      if (room.messages.length > 100) {
        room.messages = room.messages.slice(-100);
      }

      io.to(socket.currentRoom).emit('new-message', message);
      onlineUsers.set(socket.userId, Date.now());
      saveData();

    } catch (error) {
      console.error('Message error:', error);
    }
  });

  socket.on('send-image', async (data) => {
    try {
      const user = users.get(socket.userId);
      if (!user || !user.canSendImages) {
        return socket.emit('error', 'No permission to send images');
      }

      const room = rooms.get(socket.currentRoom);
      if (!room) return;

      const message = {
        id: 'msg_' + uuidv4(),
        userId: socket.userId,
        username: user.displayName,
        avatar: user.avatar,
        imageUrl: data.imageUrl,
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        date: new Date().toISOString(),
        isOwner: true,
        specialBadges: user.specialBadges || [],
        roomId: socket.currentRoom,
        isImage: true
      };

      room.messages.push(message);
      
      if (room.messages.length > 100) {
        room.messages = room.messages.slice(-100);
      }

      io.to(socket.currentRoom).emit('new-message', message);
      saveData();

    } catch (error) {
      console.error('Image send error:', error);
    }
  });

  socket.on('edit-message', async (data) => {
    try {
      const user = users.get(socket.userId);
      if (!user) return;

      const room = rooms.get(socket.currentRoom);
      if (!room) return;

      const messageIndex = room.messages.findIndex(m => m.id === data.messageId && m.userId === socket.userId);
      if (messageIndex !== -1) {
        room.messages[messageIndex].text = data.newText.trim().substring(0, 500);
        room.messages[messageIndex].edited = true;
        
        io.to(socket.currentRoom).emit('message-edited', {
          messageId: data.messageId,
          newText: room.messages[messageIndex].text
        });
        
        saveData();
      }

    } catch (error) {
      console.error('Edit message error:', error);
    }
  });

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
        date: new Date().toISOString(),
        edited: false
      };

      if (!privateMessages.has(socket.userId)) {
        privateMessages.set(socket.userId, {});
      }
      if (!privateMessages.get(socket.userId)[data.toUserId]) {
        privateMessages.get(socket.userId)[data.toUserId] = [];
      }
      privateMessages.get(socket.userId)[data.toUserId].push(message);

      if (!privateMessages.has(data.toUserId)) {
        privateMessages.set(data.toUserId, {});
      }
      if (!privateMessages.get(data.toUserId)[socket.userId]) {
        privateMessages.get(data.toUserId)[socket.userId] = [];
      }
      privateMessages.get(data.toUserId)[socket.userId].push(message);

      const receiverSocket = Array.from(io.sockets.sockets.values())
        .find(s => s.userId === data.toUserId);
      
      if (receiverSocket) {
        receiverSocket.emit('new-private-message', message);
      }

      socket.emit('private-message-sent', message);
      saveData();

    } catch (error) {
      console.error('Private message error:', error);
    }
  });

  socket.on('get-private-messages', async (data) => {
    try {
      const messages = privateMessages.get(socket.userId)?.[data.withUserId] || [];
      socket.emit('private-messages-list', {
        withUserId: data.withUserId,
        messages: messages.slice(-30)
      });
    } catch (error) {
      console.error('Get PM error:', error);
    }
  });

  socket.on('change-display-name', async (data) => {
    try {
      const user = users.get(socket.userId);
      if (!user) return;

      const newName = data.newName.trim().substring(0, 30);
      if (!newName) {
        return socket.emit('error', 'Invalid name');
      }

      user.displayName = newName;
      socket.emit('action-success', 'Name changed');
      updateUsersList(socket.currentRoom);
      saveData();

    } catch (error) {
      console.error('Change name error:', error);
    }
  });

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
        users: [socket.userId],
        messages: [],
        isOfficial: false,
        hasPassword: !!data.password,
        password: data.password ? bcrypt.hashSync(data.password, 10) : null,
        moderators: [],
        isSilenced: false,
        createdAt: new Date().toISOString()
      };

      rooms.set(roomId, newRoom);
      socket.emit('room-created', { roomId: roomId, roomName: newRoom.name });
      updateRoomsList();
      saveData();

    } catch (error) {
      console.error('Create room error:', error);
    }
  });

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
          const index = prevRoom.users.indexOf(socket.userId);
          if (index > -1) prevRoom.users.splice(index, 1);
          socket.leave(socket.currentRoom);
        }
      }

      if (!room.users.includes(socket.userId)) {
        room.users.push(socket.userId);
      }
      socket.join(data.roomId);
      socket.currentRoom = data.roomId;

      socket.emit('room-joined', {
        room: {
          id: room.id,
          name: room.name,
          description: room.description,
          messages: room.messages.slice(-100),
          isCreator: room.creatorId === socket.userId,
          isModerator: room.moderators.includes(socket.userId),
          partyMode: systemSettings.partyMode[room.id] || false
        }
      });

      io.to(data.roomId).emit('user-joined', {
        username: user.displayName,
        avatar: user.avatar
      });

      updateUsersList(data.roomId);
      saveData();

    } catch (error) {
      console.error('Join room error:', error);
    }
  });

  socket.on('mute-user', async (data) => {
    try {
      const admin = users.get(socket.userId);
      const targetUser = users.get(data.userId);
      
      if (!admin || !targetUser) return;
      if (targetUser.isOwner) return socket.emit('error', 'Cannot mute owner');

      const room = rooms.get(data.roomId || socket.currentRoom);
      const canMute = admin.isOwner || room?.moderators.includes(socket.userId);

      if (!canMute) return socket.emit('error', 'No permission');

      const duration = parseInt(data.duration) || 0;
      const isPermanent = duration === 0;
      
      mutedUsers.set(data.userId, {
        expires: isPermanent ? null : Date.now() + (duration * 60000),
        reason: data.reason || 'Rule violation',
        mutedBy: admin.displayName,
        mutedById: socket.userId,
        temporary: !isPermanent,
        byOwner: admin.isOwner,
        roomId: data.roomId || socket.currentRoom
      });

      socket.emit('action-success', `Muted ${targetUser.displayName}`);
      saveData();

    } catch (error) {
      console.error('Mute error:', error);
    }
  });

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
        bannedAt: new Date().toISOString(),
        userIP: socket.userIP
      });

      bannedIPs.set(socket.userIP, {
        userId: data.userId,
        bannedAt: new Date().toISOString()
      });

      const targetSocket = Array.from(io.sockets.sockets.values())
        .find(s => s.userId === data.userId);
      
      if (targetSocket) {
        targetSocket.emit('banned', { reason: data.reason });
        targetSocket.disconnect(true);
      }

      socket.emit('action-success', `Banned ${targetUser.displayName}`);
      saveData();

    } catch (error) {
      console.error('Ban error:', error);
    }
  });

  socket.on('delete-account', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isOwner) {
        return socket.emit('error', 'Only owner');
      }

      const targetUser = users.get(data.userId);
      if (!targetUser || targetUser.isOwner) return;

      // حذف جميع رسائله
      rooms.forEach(room => {
        room.messages = room.messages.filter(m => m.userId !== data.userId);
        const index = room.users.indexOf(data.userId);
        if (index > -1) room.users.splice(index, 1);
      });

      users.delete(data.userId);
      privateMessages.delete(data.userId);
      mutedUsers.delete(data.userId);
      bannedUsers.delete(data.userId);

      const targetSocket = Array.from(io.sockets.sockets.values())
        .find(s => s.userId === data.userId);
      
      if (targetSocket) {
        targetSocket.emit('account-deleted', { message: 'Account deleted' });
        targetSocket.disconnect(true);
      }

      socket.emit('action-success', `Deleted: ${targetUser.displayName}`);
      updateUsersList(socket.currentRoom);
      saveData();

    } catch (error) {
      console.error('Delete account error:', error);
    }
  });

  socket.on('unmute-user', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin) return;

      const muteInfo = mutedUsers.get(data.userId);
      if (!muteInfo) return;

      if (muteInfo.byOwner && !admin.isOwner) {
        return socket.emit('error', 'Only owner can unmute');
      }

      const room = rooms.get(socket.currentRoom);
      const canUnmute = admin.isOwner || room?.moderators.includes(socket.userId);

      if (!canUnmute) return socket.emit('error', 'No permission');

      mutedUsers.delete(data.userId);
      socket.emit('action-success', 'User unmuted');
      saveData();

    } catch (error) {
      console.error('Unmute error:', error);
    }
  });

  socket.on('unmute-multiple', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isOwner) return;

      data.userIds.forEach(userId => {
        mutedUsers.delete(userId);
      });

      socket.emit('action-success', `Unmuted ${data.userIds.length} users`);
      saveData();

    } catch (error) {
      console.error('Unmute multiple error:', error);
    }
  });

  socket.on('unban-user', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isOwner) return;

      const banInfo = bannedUsers.get(data.userId);
      if (banInfo && banInfo.userIP) {
        bannedIPs.delete(banInfo.userIP);
      }

      bannedUsers.delete(data.userId);
      socket.emit('action-success', 'User unbanned');
      saveData();

    } catch (error) {
      console.error('Unban error:', error);
    }
  });

  socket.on('unban-multiple', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isOwner) return;

      data.userIds.forEach(userId => {
        const banInfo = bannedUsers.get(userId);
        if (banInfo && banInfo.userIP) {
          bannedIPs.delete(banInfo.userIP);
        }
        bannedUsers.delete(userId);
      });

      socket.emit('action-success', `Unbanned ${data.userIds.length} users`);
      saveData();

    } catch (error) {
      console.error('Unban multiple error:', error);
    }
  });

  socket.on('add-moderator', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isOwner) return;

      const room = rooms.get(data.roomId || socket.currentRoom);
      if (!room) return;

      if (!room.moderators.includes(data.userId)) {
        room.moderators.push(data.userId);
      }

      socket.emit('action-success', 'Moderator added');
      updateUsersList(room.id);
      saveData();

    } catch (error) {
      console.error('Add mod error:', error);
    }
  });

  socket.on('remove-moderator', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isOwner) return;

      const room = rooms.get(data.roomId || socket.currentRoom);
      if (!room) return;

      const index = room.moderators.indexOf(data.userId);
      if (index > -1) {
        room.moderators.splice(index, 1);
      }

      socket.emit('action-success', 'Moderator removed');
      updateUsersList(room.id);
      saveData();

    } catch (error) {
      console.error('Remove mod error:', error);
    }
  });

  socket.on('delete-message', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isOwner) return;

      const room = rooms.get(data.roomId);
      if (!room) return;

      const index = room.messages.findIndex(m => m.id === data.messageId);
      if (index !== -1) {
        room.messages.splice(index, 1);
        io.to(data.roomId).emit('message-deleted', { messageId: data.messageId });
        saveData();
      }

    } catch (error) {
      console.error('Delete message error:', error);
    }
  });

  socket.on('clean-chat', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isOwner) return;

      const room = rooms.get(data.roomId);
      if (!room) return;

      room.messages = [];
      io.to(data.roomId).emit('chat-cleaned', { message: 'Chat cleaned' });
      saveData();

    } catch (error) {
      console.error('Clean chat error:', error);
    }
  });

  socket.on('clean-all-rooms', async () => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isOwner) return;

      rooms.forEach(room => {
        room.messages = [];
        io.to(room.id).emit('chat-cleaned', { message: 'Chat cleaned by owner' });
      });

      socket.emit('action-success', 'All rooms cleaned');
      saveData();

    } catch (error) {
      console.error('Clean all error:', error);
    }
  });

  socket.on('silence-room', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isOwner) return;

      const room = rooms.get(data.roomId);
      if (!room) return;

      room.isSilenced = false;
      io.to(data.roomId).emit('room-unsilenced', { message: 'Room unsilenced' });
      saveData();

    } catch (error) {
      console.error('Unsilence error:', error);
    }
  });

  socket.on('delete-room', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isOwner) return;

      const room = rooms.get(data.roomId);
      if (!room || room.isOfficial) return;

      io.to(data.roomId).emit('room-deleted', { message: 'Room deleted' });
      rooms.delete(data.roomId);
      updateRoomsList();
      saveData();

    } catch (error) {
      console.error('Delete room error:', error);
    }
  });

  socket.on('update-room', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isOwner) return;

      const room = rooms.get(data.roomId);
      if (!room) return;

      if (data.name) room.name = data.name.substring(0, 50);
      if (data.description !== undefined) room.description = data.description.substring(0, 200);
      if (data.password !== undefined) {
        room.hasPassword = !!data.password;
        room.password = data.password ? bcrypt.hashSync(data.password, 10) : null;
      }

      socket.emit('action-success', 'Room updated');
      updateRoomsList();
      io.to(data.roomId).emit('room-updated', {
        name: room.name,
        description: room.description
      });
      saveData();

    } catch (error) {
      console.error('Update room error:', error);
    }
  });

  socket.on('toggle-party-mode', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isOwner) return;

      if (!systemSettings.partyMode) {
        systemSettings.partyMode = {};
      }

      systemSettings.partyMode[data.roomId] = data.enabled;
      
      io.to(data.roomId).emit('party-mode-changed', { enabled: data.enabled });
      socket.emit('action-success', data.enabled ? 'Party mode ON' : 'Party mode OFF');
      saveData();

    } catch (error) {
      console.error('Party mode error:', error);
    }
  });

  socket.on('start-youtube-watch', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isOwner) return;

      if (socket.currentRoom !== 'global_cold') {
        return socket.emit('error', 'Only in global room');
      }

      io.to('global_cold').emit('youtube-started', {
        videoId: data.videoId,
        startedBy: admin.displayName
      });

    } catch (error) {
      console.error('YouTube error:', error);
    }
  });

  socket.on('stop-youtube-watch', async () => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isOwner) return;

      io.to('global_cold').emit('youtube-stopped');

    } catch (error) {
      console.error('Stop YouTube error:', error);
    }
  });

  socket.on('update-settings', async (data) => {
    try {
      const user = users.get(socket.userId);
      if (!user || !user.isOwner) return;

      if (data.siteLogo) systemSettings.siteLogo = data.siteLogo;
      if (data.siteTitle) systemSettings.siteTitle = data.siteTitle;
      if (data.backgroundColor) systemSettings.backgroundColor = data.backgroundColor;
      if (data.loginMusic !== undefined) systemSettings.loginMusic = data.loginMusic;
      if (data.chatMusic !== undefined) systemSettings.chatMusic = data.chatMusic;
      if (data.loginMusicVolume !== undefined) systemSettings.loginMusicVolume = data.loginMusicVolume;
      if (data.chatMusicVolume !== undefined) systemSettings.chatMusicVolume = data.chatMusicVolume;

      io.emit('settings-updated', systemSettings);
      socket.emit('action-success', 'Settings updated');
      saveData();

    } catch (error) {
      console.error('Update settings error:', error);
    }
  });

  socket.on('send-support-message', async (data) => {
    try {
      const messageId = 'support_' + uuidv4();
      supportMessages.set(messageId, {
        id: messageId,
        from: data.from || 'Anonymous',
        message: data.message.trim().substring(0, 500),
        sentAt: new Date().toISOString(),
        fromIP: socket.userIP
      });

      socket.emit('support-message-sent', { message: 'Message sent' });
      saveData();

    } catch (error) {
      console.error('Support message error:', error);
    }
  });

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

  socket.on('delete-support-message', async (data) => {
    try {
      const user = users.get(socket.userId);
      if (!user || !user.isOwner) return;

      supportMessages.delete(data.messageId);
      socket.emit('action-success', 'Message deleted');
      saveData();

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
        if (!room.isOfficial) {
          const index = room.users.indexOf(socket.userId);
          if (index > -1) room.users.splice(index, 1);
        }
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
  const roomList = Array.from(rooms.values())
    .map(room => ({
      id: room.id,
      name: room.name,
      description: room.description,
      userCount: room.users.length,
      hasPassword: room.hasPassword,
      isOfficial: room.isOfficial,
      createdBy: room.createdBy
    }))
    .sort((a, b) => {
      if (a.isOfficial) return -1;
      if (b.isOfficial) return 1;
      return b.userCount - a.userCount;
    });

  if (socket) {
    socket.emit('rooms-list', roomList);
  } else {
    io.emit('rooms-list', roomList);
  }
}

function updateUsersList(roomId, socket = null) {
  const room = rooms.get(roomId);
  if (!room) return;

  const userList = room.users.map(userId => {
    const user = users.get(userId);
    if (!user) return null;

    return {
      id: userId,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      isOnline: onlineUsers.has(userId),
      isOwner: user.isOwner || false,
      isModerator: room.moderators.includes(userId),
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
  saveData();
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Rejection:', error);
  saveData();
});

process.on('SIGINT', () => {
  console.log('💾 Saving data before exit...');
  saveData();
  process.exit(0);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════╗
║        ❄️  Cold Room Server V2            ║
║  Port: ${PORT}                             ║
║  Status: ✅ Ready                          ║
║  Data: 💾 Persistent                       ║
╚════════════════════════════════════════════╝
  `);
});
ilenced = true;
      io.to(data.roomId).emit('room-silenced', { message: 'Room silenced' });
      saveData();

    } catch (error) {
      console.error('Silence error:', error);
    }
  });

  socket.on('unsilence-room', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isOwner) return;

      const room = rooms.get(data.roomId);
      if (!room) return;

      room.isS
