const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3000;

console.log(`
╔═══════════════════════════════════════════════════════╗
║          🚀 موقع MOBO العالمي المتطور                ║
║            © 2025 جميع الحقوق محفوظة                 ║
╚═══════════════════════════════════════════════════════╝
`);

app.use(express.static(path.join(__dirname)));
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// قواعد البيانات
const users = new Map();
const userProfiles = new Map();
const rooms = new Map();
const mutedUsers = new Map();
const bannedUsers = new Map();
const bannedIPs = new Map();
const onlineUsers = new Map();
const privateMessages = new Map();
const supportMessages = new Map();
const uploadedImages = new Map();

// إعدادات النظام
let systemSettings = {
  allowCopy: false,
  allowScreenshot: false,
  siteColor: 'red',
  siteLogo: 'https://i.top4top.io/p_3583q2vy21.jpg',
  siteTitle: 'موقع MOBO العالمي',
  maxImageSize: 10 * 1024 * 1024,
  currentImageSize: 0,
  adminPassword: 'Mobo@2025',
  socialLinks: {
    telegram: '',
    instagram: '',
    youtube: '',
    email: 'support@mobo.com'
  }
};

// إنشاء حساب المدير
const createSuperAdmin = () => {
  const adminId = 'admin_mobo';
  
  const adminUser = {
    id: adminId,
    username: 'MOBO',
    displayName: '👑 الزعيم MOBO',
    password: bcrypt.hashSync(systemSettings.adminPassword, 10),
    isAdmin: true,
    isSuperAdmin: true,
    isSupremeLeader: true,
    isVerified: true,
    isProtected: true,
    joinDate: new Date(),
    lastActive: new Date(),
    cannotBeMuted: true,
    cannotBeBanned: true,
    avatar: '👑',
    customAvatar: null,
    specialBadges: ['👑', '⭐', '💎']
  };

  users.set(adminId, adminUser);
  userProfiles.set(adminId, {
    userId: adminId,
    gender: 'male',
    avatar: '👑',
    status: '🔱 المطور والمالك الأعلى 🔱',
    country: 'global',
    joinDate: new Date()
  });

  console.log(`✅ المدير جاهز: MOBO / ${systemSettings.adminPassword}`);
  return adminUser;
};

// إنشاء الغرفة العالمية
const createGlobalRoom = () => {
  const globalRoom = {
    id: 'global_official',
    name: '🌍 الغرفة العالمية الرسمية',
    description: 'الغرفة الرئيسية للجميع',
    createdBy: 'MOBO',
    creatorId: 'admin_mobo',
    createdAt: new Date(),
    users: new Set(),
    messages: [],
    isActive: true,
    isGlobal: true,
    isOfficial: true,
    cannotBeDeleted: true,
    hasPassword: false,
    password: null,
    moderators: new Set(),
    isSilenced: false
  };

  rooms.set(globalRoom.id, globalRoom);
  console.log('✅ الغرفة العالمية جاهزة');
  return globalRoom;
};

createSuperAdmin();
createGlobalRoom();

// تنظيف تلقائي
setInterval(() => {
  const now = Date.now();
  
  for (const [userId, lastSeen] of onlineUsers.entries()) {
    if (now - lastSeen > 300000) {
      onlineUsers.delete(userId);
    }
  }
  
  for (const [imageId, imageData] of uploadedImages.entries()) {
    if (imageData.deleteAt && now > imageData.deleteAt) {
      systemSettings.currentImageSize -= imageData.size;
      uploadedImages.delete(imageId);
    }
  }
  
  for (const [userId, muteData] of mutedUsers.entries()) {
    if (muteData.temporary && muteData.expires && now > muteData.expires) {
      mutedUsers.delete(userId);
    }
  }
}, 60000);

// Socket.IO
io.on('connection', (socket) => {
  console.log('🔗 اتصال جديد:', socket.id);
  socket.userIP = socket.handshake.address;

  // تسجيل الدخول
  socket.on('login', async (data) => {
    try {
      console.log('📥 محاولة تسجيل دخول:', data.username);
      
      const { username, password } = data;
      
      if (!username || !password) {
        console.log('❌ بيانات ناقصة');
        return socket.emit('login-error', 'الرجاء إدخال جميع البيانات');
      }

      if (bannedIPs.has(socket.userIP)) {
        console.log('❌ IP محظور');
        return socket.emit('login-error', 'تم حظر عنوان IP الخاص بك');
      }

      let userFound = null;
      let userId = null;

      for (const [id, user] of users.entries()) {
        if (user.username === username) {
          if (bcrypt.compareSync(password, user.password)) {
            userFound = user;
            userId = id;
            break;
          }
        }
      }

      if (!userFound) {
        console.log('❌ بيانات خاطئة');
        return socket.emit('login-error', 'اسم المستخدم أو كلمة المرور غير صحيحة');
      }

      if (bannedUsers.has(userId)) {
        const banInfo = bannedUsers.get(userId);
        console.log('❌ مستخدم محظور');
        return socket.emit('banned-user', {
          reason: banInfo.reason,
          bannedBy: banInfo.bannedBy,
          canAppeal: true
        });
      }

      socket.userId = userId;
      socket.userData = userFound;
      userFound.lastActive = new Date();
      onlineUsers.set(userId, Date.now());

      const globalRoom = rooms.get('global_official');
      globalRoom.users.add(userId);
      socket.join('global_official');
      socket.currentRoom = 'global_official';

      console.log('✅ دخول ناجح:', username);

      socket.emit('login-success', {
        user: {
          id: userId,
          username: userFound.username,
          displayName: userFound.displayName || userFound.username,
          avatar: userFound.avatar,
          customAvatar: userFound.customAvatar,
          isAdmin: userFound.isAdmin,
          isSuperAdmin: userFound.isSuperAdmin,
          isSupremeLeader: userFound.isSupremeLeader,
          isVerified: userFound.isVerified,
          specialBadges: userFound.specialBadges || []
        },
        permissions: {
          canDeleteAnyMessage: userFound.isSupremeLeader,
          canAddModerators: userFound.isSupremeLeader,
          canChangeSystemSettings: userFound.isSupremeLeader
        },
        room: {
          id: globalRoom.id,
          name: globalRoom.name,
          description: globalRoom.description,
          messages: globalRoom.messages.slice(-50)
        },
        systemSettings: systemSettings
      });

      io.to('global_official').emit('user-joined-room', {
        username: userFound.displayName || userFound.username,
        avatar: userFound.avatar,
        roomName: globalRoom.name
      });

      updateRoomsList();
      updateUsersList('global_official');

    } catch (error) {
      console.error('❌ خطأ في تسجيل الدخول:', error);
      socket.emit('login-error', 'حدث خطأ في تسجيل الدخول');
    }
  });

  // التسجيل
  socket.on('register', async (data) => {
    try {
      console.log('📥 محاولة تسجيل:', data.username);
      
      const { username, password, displayName, gender, emoji } = data;

      if (!username || !password || !displayName) {
        return socket.emit('register-error', 'الرجاء ملء جميع الحقول');
      }

      if (username.length < 3 || username.length > 20) {
        return socket.emit('register-error', 'اسم المستخدم يجب أن يكون بين 3-20 حرف');
      }

      if (password.length < 6) {
        return socket.emit('register-error', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      }

      for (const user of users.values()) {
        if (user.username.toLowerCase() === username.toLowerCase()) {
          return socket.emit('register-error', 'اسم المستخدم موجود مسبقاً');
        }
      }

      const userId = uuidv4();
      const hashedPassword = bcrypt.hashSync(password, 10);

      const newUser = {
        id: userId,
        username: username,
        displayName: displayName,
        password: hashedPassword,
        isAdmin: false,
        isSuperAdmin: false,
        isVerified: false,
        joinDate: new Date(),
        lastActive: new Date(),
        avatar: emoji || (gender === 'female' ? '👩' : '👨'),
        customAvatar: null,
        nameChangeCount: 0,
        maxNameChanges: 0,
        specialBadges: []
      };

      users.set(userId, newUser);
      userProfiles.set(userId, {
        userId: userId,
        gender: gender || 'male',
        avatar: emoji || (gender === 'female' ? '👩' : '👨'),
        status: 'عضو جديد',
        country: 'global',
        joinDate: new Date()
      });
      privateMessages.set(userId, new Map());

      console.log('✅ تسجيل ناجح:', username);

      socket.emit('register-success', {
        message: 'تم إنشاء حسابك بنجاح!',
        username: username
      });

    } catch (error) {
      console.error('❌ خطأ في التسجيل:', error);
      socket.emit('register-error', 'حدث خطأ في إنشاء الحساب');
    }
  });

  // إرسال رسالة
  socket.on('send-message', async (data) => {
    try {
      const user = users.get(socket.userId);
      if (!user || !socket.currentRoom) return;

      const room = rooms.get(socket.currentRoom);
      if (!room) return;

      if (room.isSilenced && !user.isSupremeLeader) {
        return socket.emit('message-error', 'الغرفة في وضع الصمت');
      }

      const muteInfo = mutedUsers.get(socket.userId);
      if (muteInfo) {
        if (!muteInfo.temporary || (muteInfo.expires && muteInfo.expires > Date.now())) {
          const remaining = muteInfo.temporary ? 
            Math.ceil((muteInfo.expires - Date.now()) / 60000) : 'دائم';
          return socket.emit('message-error', 
            `أنت مكتوم ${muteInfo.temporary ? 'لمدة ' + remaining + ' دقيقة' : 'بشكل دائم'}`);
        }
      }

      const message = {
        id: uuidv4(),
        userId: socket.userId,
        username: user.displayName || user.username,
        avatar: user.customAvatar || user.avatar,
        text: data.text.trim().substring(0, 300),
        timestamp: new Date().toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        fullTimestamp: new Date(),
        isSupremeLeader: user.isSupremeLeader,
        isSuperAdmin: user.isSuperAdmin,
        isAdmin: user.isAdmin,
        isModerator: room.moderators.has(socket.userId),
        isVerified: user.isVerified,
        specialBadges: user.specialBadges || [],
        roomId: socket.currentRoom,
        glowing: user.glowingMessages || false
      };

      room.messages.push(message);
      
      if (room.messages.length > 100) {
        room.messages = room.messages.slice(-100);
        io.to(socket.currentRoom).emit('chat-cleaned', {
          message: '🧹 تم تنظيف الرسائل القديمة'
        });
      }

      io.to(socket.currentRoom).emit('new-message', message);
      onlineUsers.set(socket.userId, Date.now());

    } catch (error) {
      console.error('خطأ في إرسال الرسالة:', error);
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
        createdBy: user.displayName || user.username,
        creatorId: socket.userId,
        createdAt: new Date(),
        users: new Set([socket.userId]),
        messages: [],
        isActive: true,
        isGlobal: false,
        isOfficial: false,
        hasPassword: !!data.password,
        password: data.password ? bcrypt.hashSync(data.password, 10) : null,
        moderators: new Set(),
        isSilenced: false
      };

      rooms.set(roomId, newRoom);
      
      socket.emit('room-created', {
        roomId: roomId,
        roomName: newRoom.name,
        message: 'تم إنشاء الغرفة بنجاح!'
      });

      updateRoomsList();
      console.log('✅ غرفة جديدة:', newRoom.name);
    } catch (error) {
      console.error('خطأ في إنشاء غرفة:', error);
    }
  });

  // الانضمام لغرفة
  socket.on('join-room', async (data) => {
    try {
      const user = users.get(socket.userId);
      if (!user) return;

      const room = rooms.get(data.roomId);
      if (!room) {
        return socket.emit('error', 'الغرفة غير موجودة');
      }

      if (room.hasPassword && !user.isSupremeLeader) {
        if (!data.password) {
          return socket.emit('room-password-required', {
            roomId: room.id,
            roomName: room.name
          });
        }
        if (!bcrypt.compareSync(data.password, room.password)) {
          return socket.emit('error', 'كلمة المرور غير صحيحة');
        }
      }

      if (socket.currentRoom && socket.currentRoom !== 'global_official') {
        const prevRoom = rooms.get(socket.currentRoom);
        if (prevRoom && !prevRoom.isOfficial) {
          prevRoom.users.delete(socket.userId);
          socket.leave(socket.currentRoom);
          updateUsersList(socket.currentRoom);
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
          userCount: room.users.size,
          isModerator: room.moderators.has(socket.userId),
          isCreator: room.creatorId === socket.userId,
          canLeave: !room.cannotLeave,
          password: user.isSupremeLeader ? data.password : null
        }
      });

      io.to(data.roomId).emit('user-joined-room', {
        username: user.displayName || user.username,
        avatar: user.customAvatar || user.avatar,
        roomName: room.name
      });

      updateUsersList(data.roomId);
      updateRoomsList();
    } catch (error) {
      console.error('خطأ في الانضمام:', error);
    }
  });

  // كتم
  socket.on('mute-user', async (data) => {
    try {
      const admin = users.get(socket.userId);
      const targetUser = users.get(data.userId);
      
      if (!admin || !targetUser) return;
      
      if (targetUser.cannotBeMuted || targetUser.isSupremeLeader) {
        return socket.emit('error', 'لا يمكن كتم هذا المستخدم');
      }

      const room = rooms.get(socket.currentRoom);
      const isModerator = room?.moderators.has(socket.userId);
      const isAdmin = admin.isSupremeLeader;

      if (!isModerator && !isAdmin) {
        return socket.emit('error', 'ليس لديك صلاحية');
      }

      const duration = data.duration || 10;
      mutedUsers.set(data.userId, {
        expires: duration > 0 ? Date.now() + (duration * 60000) : null,
        reason: data.reason || 'مخالفة',
        mutedBy: admin.isSupremeLeader ? 'الزعيم' : admin.displayName,
        mutedById: socket.userId,
        temporary: duration > 0,
        roomId: socket.currentRoom,
        canOnlyBeRemovedBy: admin.isSupremeLeader ? 'supreme' : null
      });

      io.to(socket.currentRoom).emit('user-muted', {
        username: targetUser.displayName,
        duration: duration > 0 ? duration : 'دائم',
        mutedBy: mutedUsers.get(data.userId).mutedBy
      });

      socket.emit('action-success', `تم كتم ${targetUser.displayName}`);
    } catch (error) {
      console.error('خطأ في الكتم:', error);
    }
  });

  // حظر
  socket.on('ban-user', async (data) => {
    try {
      const admin = users.get(socket.userId);
      const targetUser = users.get(data.userId);
      
      if (!admin || !targetUser) return;
      
      if (targetUser.cannotBeBanned || targetUser.isSupremeLeader) {
        return socket.emit('error', 'لا يمكن حظر هذا المستخدم');
      }

      const room = rooms.get(socket.currentRoom);
      const isModerator = room?.moderators.has(socket.userId);
      const isAdmin = admin.isSupremeLeader;

      if (!isModerator && !isAdmin) {
        return socket.emit('error', 'ليس لديك صلاحية');
      }

      bannedUsers.set(data.userId, {
        reason: data.reason || 'مخالفة',
        bannedBy: admin.isSupremeLeader ? 'الزعيم' : admin.displayName,
        bannedById: socket.userId,
        bannedAt: new Date(),
        canOnlyBeRemovedBy: admin.isSupremeLeader ? 'supreme' : null
      });

      bannedIPs.set(socket.userIP, {
        userId: data.userId,
        bannedAt: new Date()
      });

      const targetSocket = Array.from(io.sockets.sockets.values())
        .find(s => s.userId === data.userId);
      
      if (targetSocket) {
        targetSocket.emit('banned', {
          reason: data.reason,
          bannedBy: bannedUsers.get(data.userId).bannedBy
        });
        targetSocket.disconnect();
      }

      socket.emit('action-success', `تم حظر ${targetUser.displayName}`);
    } catch (error) {
      console.error('خطأ في الحظر:', error);
    }
  });

  socket.on('get-rooms', () => updateRoomsList(socket));
  socket.on('get-users', (data) => updateUsersList(data.roomId, socket));
  
  socket.on('disconnect', () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      
      rooms.forEach(room => {
        if (!room.isOfficial && room.users.has(socket.userId)) {
          room.users.delete(socket.userId);
        }
      });
    }
    console.log('🔌 قطع اتصال:', socket.id);
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
      displayName: user.displayName || user.username,
      avatar: user.customAvatar || user.avatar,
      isOnline: onlineUsers.has(userId),
      isSupremeLeader: user.isSupremeLeader,
      isSuperAdmin: user.isSuperAdmin,
      isAdmin: user.isAdmin,
      isModerator: room.moderators.has(userId),
      isVerified: user.isVerified,
      specialBadges: user.specialBadges || []
    };
  }).filter(Boolean);

  if (socket) {
    socket.emit('users-list', userList);
  } else {
    io.to(roomId).emit('users-list', userList);
  }
}

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║          ✅ الخادم يعمل بنجاح                        ║
║  🔗 البورت: ${PORT}                                  ║
║  🌐 http://localhost:${PORT}                         ║
║  👑 نظام MOBO جاهز                                   ║
╚═══════════════════════════════════════════════════════╝
  `);
});
