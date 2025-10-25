const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 10e6 // 10MB
});

const PORT = process.env.PORT || 3000;

// 🔒 حماية حقوق الطبع والنشر
console.log(`
╔═══════════════════════════════════════════════════════╗
║        🚀 موقع MOBO العالمي - النظام المتكامل       ║
║              © 2025 جميع الحقوق محفوظة               ║
║           المطور والمالك: MOBO - الزعيم              ║
║      يمنع النسخ أو التوزيع أو السرقة بتاتاً         ║
║         انتهاك الحقوق سيتم ملاحقته قانونياً         ║
╚═══════════════════════════════════════════════════════╝
`);

app.use(express.static(path.join(__dirname)));
app.use(express.json({ limit: '10mb' }));

// إنشاء مجلد الصور
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ═══════════════════ قواعد البيانات ═══════════════════
const users = new Map();
const userProfiles = new Map();
const rooms = new Map();
const mutedUsers = new Map();
const bannedUsers = new Map();
const bannedIPs = new Map();
const onlineUsers = new Map();
const roomModerators = new Map();
const userPermissions = new Map();
const privateMessages = new Map();
const supportMessages = new Map();
const uploadedImages = new Map();
const userSessions = new Map();
const accountRequests = new Map();
const secretRooms = new Map();
const userEmojis = new Map();
const userBadges = new Map();
const roomPasswords = new Map();
const messageQueue = new Map();

// إعدادات النظام
let systemSettings = {
  allowCopy: false,
  allowScreenshot: false,
  siteColor: 'red', // red or black
  siteLogo: 'https://i.top4top.io/p_3583q2vy21.jpg',
  siteTitle: 'موقع MOBO العالمي',
  maxImageSize: 10 * 1024 * 1024, // 10MB
  currentImageSize: 0,
  adminPassword: 'Mobo@2025@SuperSecure#2025',
  socialLinks: {
    telegram: '',
    instagram: '',
    youtube: '',
    email: 'support@mobo.com'
  }
};

// 👑 إنشاء حساب المدير الأعلى (الزعيم)
const createSuperAdmin = () => {
  const adminId = 'supreme_leader_mobo_' + Date.now();
  
  const adminUser = {
    id: adminId,
    username: 'MOBO',
    displayName: '👑 الزعيم MOBO',
    password: bcrypt.hashSync(systemSettings.adminPassword, 12),
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
    nameChangeCount: Infinity,
    specialBadges: ['👑', '⭐', '💎', '🔥']
  };

  const adminProfile = {
    userId: adminId,
    gender: 'male',
    avatar: '👑',
    status: '🔱 المطور والمالك الأعلى للموقع 🔱',
    country: 'global',
    joinDate: new Date()
  };

  users.set(adminId, adminUser);
  userProfiles.set(adminId, adminProfile);
  userPermissions.set(adminId, {
    canDeleteAnyMessage: true,
    canDeleteAnyRoom: true,
    canAddModerators: true,
    canRemoveModerators: true,
    canMuteAnyone: true,
    canBanAnyone: true,
    canUnmuteAnyone: true,
    canUnbanAnyone: true,
    canAccessSecretRooms: true,
    canSeeAllRoomPasswords: true,
    canChangeSystemSettings: true,
    canManageUsers: true,
    unlimitedImageUpload: true
  });

  console.log(`
  ╔════════════════════════════════════════════╗
  ║       🔐 بيانات دخول الزعيم MOBO          ║
  ╠════════════════════════════════════════════╣
  ║  اسم المستخدم: MOBO                      ║
  ║  كلمة المرور: ${systemSettings.adminPassword.substring(0, 20)}...  ║
  ║  الصلاحيات: كاملة وغير محدودة            ║
  ╚════════════════════════════════════════════╝
  `);

  return adminUser;
};

// 🌍 إنشاء الغرفة العالمية الافتراضية
const createGlobalRoom = () => {
  const globalRoom = {
    id: 'global_official',
    name: '🌍 الغرفة العالمية الرسمية - MOBO',
    description: 'الغرفة الرئيسية العالمية للجميع - لا يمكن حذفها أو الخروج منها',
    createdBy: 'MOBO',
    creatorId: 'supreme_leader',
    createdAt: new Date(),
    users: new Set(),
    messages: [],
    isActive: true,
    isGlobal: true,
    isOfficial: true,
    cannotBeDeleted: true,
    cannotLeave: true,
    hasPassword: false,
    password: null,
    moderators: new Set(),
    mutedUsers: new Set(),
    isSilenced: false
  };

  rooms.set(globalRoom.id, globalRoom);
  return globalRoom;
};

createSuperAdmin();
createGlobalRoom();

// ═══════════════════ تنظيف تلقائي ═══════════════════
setInterval(() => {
  const now = Date.now();
  
  // تنظيف المستخدمين غير النشطين
  for (const [userId, lastSeen] of onlineUsers.entries()) {
    if (now - lastSeen > 300000) {
      onlineUsers.delete(userId);
      rooms.forEach(room => {
        if (!room.isOfficial) {
          room.users.delete(userId);
        }
      });
    }
  }
  
  // تنظيف الصور القديمة
  for (const [imageId, imageData] of uploadedImages.entries()) {
    if (imageData.deleteAt && now > imageData.deleteAt) {
      systemSettings.currentImageSize -= imageData.size;
      uploadedImages.delete(imageId);
      
      if (fs.existsSync(imageData.path)) {
        fs.unlinkSync(imageData.path);
      }
    }
  }
  
  // تنظيف الكتم المؤقت المنتهي
  for (const [userId, muteData] of mutedUsers.entries()) {
    if (muteData.temporary && muteData.expires && now > muteData.expires) {
      mutedUsers.delete(userId);
    }
  }
}, 60000);

// تنظيف الرسائل كل 100 رسالة
function cleanOldMessages(room) {
  if (room.messages.length > 100) {
    room.messages = room.messages.slice(-100);
    io.to(room.id).emit('chat-cleaned', {
      message: '🧹 تم تنظيف الرسائل القديمة بواسطة النظام'
    });
  }
}

// ═══════════════════ Socket.IO ═══════════════════
io.on('connection', (socket) => {
  console.log('🔗 اتصال جديد:', socket.id);
  socket.userIP = socket.handshake.address;

  // ════════════ تسجيل الدخول ════════════
  socket.on('login', async (data) => {
    try {
      const { username, password } = data;
      
      if (!username || !password) {
        return socket.emit('login-error', 'الرجاء إدخال جميع البيانات');
      }

      // التحقق من الحظر بالـ IP
      if (bannedIPs.has(socket.userIP)) {
        return socket.emit('login-error', 'تم حظر عنوان IP الخاص بك من الموقع');
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
        return socket.emit('login-error', 'اسم المستخدم أو كلمة المرور غير صحيحة');
      }

      // التحقق من الحظر
      if (bannedUsers.has(userId)) {
        const banInfo = bannedUsers.get(userId);
        return socket.emit('banned-user', {
          reason: banInfo.reason,
          bannedBy: banInfo.bannedBy,
          canAppeal: true
        });
      }

      // تسجيل الدخول
      socket.userId = userId;
      socket.userData = userFound;
      socket.userIP = socket.handshake.address;
      
      userFound.lastActive = new Date();
      onlineUsers.set(userId, Date.now());
      userSessions.set(userId, socket.id);

      // الانضمام للغرفة العالمية
      const globalRoom = rooms.get('global_official');
      globalRoom.users.add(userId);
      socket.join('global_official');
      socket.currentRoom = 'global_official';

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
        permissions: userPermissions.get(userId) || {},
        room: {
          id: globalRoom.id,
          name: globalRoom.name,
          description: globalRoom.description,
          messages: globalRoom.messages.slice(-50)
        },
        systemSettings: {
          allowCopy: systemSettings.allowCopy,
          allowScreenshot: systemSettings.allowScreenshot,
          siteColor: systemSettings.siteColor,
          siteLogo: systemSettings.siteLogo,
          siteTitle: systemSettings.siteTitle,
          socialLinks: systemSettings.socialLinks
        }
      });

      // إرسال إشعار انضمام
      io.to('global_official').emit('user-joined-room', {
        username: userFound.displayName || userFound.username,
        avatar: userFound.avatar,
        roomName: globalRoom.name
      });

      updateRoomsList();
      updateUsersList('global_official');

      console.log(`✅ دخول: ${userFound.username}`);
    } catch (error) {
      console.error('خطأ في تسجيل الدخول:', error);
      socket.emit('login-error', 'حدث خطأ في تسجيل الدخول');
    }
  });

  // ════════════ إنشاء حساب ════════════
  socket.on('register', async (data) => {
    try {
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

      // التحقق من التكرار
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

      const userProfile = {
        userId: userId,
        gender: gender || 'male',
        avatar: emoji || (gender === 'female' ? '👩' : '👨'),
        status: 'عضو جديد',
        country: 'global',
        joinDate: new Date()
      };

      users.set(userId, newUser);
      userProfiles.set(userId, userProfile);
      privateMessages.set(userId, new Map());

      socket.emit('register-success', {
        message: 'تم إنشاء حسابك بنجاح!',
        username: username
      });

      console.log(`✅ حساب جديد: ${username}`);
    } catch (error) {
      console.error('خطأ في التسجيل:', error);
      socket.emit('register-error', 'حدث خطأ في إنشاء الحساب');
    }
  });

  // ════════════ إرسال رسالة ════════════
  socket.on('send-message', async (data) => {
    try {
      const user = users.get(socket.userId);
      if (!user || !socket.currentRoom) return;

      const room = rooms.get(socket.currentRoom);
      if (!room) return;

      // التحقق من الصمت
      if (room.isSilenced && !user.isSupremeLeader) {
        return socket.emit('message-error', 'الغرفة في وضع الصمت');
      }

      // التحقق من الكتم
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
      cleanOldMessages(room);

      io.to(socket.currentRoom).emit('new-message', message);
      onlineUsers.set(socket.userId, Date.now());
    } catch (error) {
      console.error('خطأ في إرسال الرسالة:', error);
    }
  });

  // ════════════ إنشاء غرفة ════════════
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
        cannotBeDeleted: false,
        cannotLeave: false,
        hasPassword: !!data.password,
        password: data.password ? bcrypt.hashSync(data.password, 10) : null,
        moderators: new Set(),
        mutedUsers: new Set(),
        isSilenced: false
      };

      rooms.set(roomId, newRoom);
      
      socket.emit('room-created', {
        roomId: roomId,
        roomName: newRoom.name,
        message: 'تم إنشاء الغرفة بنجاح!'
      });

      updateRoomsList();
      console.log(`✅ غرفة جديدة: ${newRoom.name}`);
    } catch (error) {
      console.error('خطأ في إنشاء غرفة:', error);
    }
  });

  // ════════════ الانضمام لغرفة ════════════
  socket.on('join-room', async (data) => {
    try {
      const user = users.get(socket.userId);
      if (!user) return;

      const room = rooms.get(data.roomId);
      if (!room) {
        return socket.emit('error', 'الغرفة غير موجودة');
      }

      // التحقق من كلمة المرور
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

      // مغادرة الغرفة السابقة
      if (socket.currentRoom && socket.currentRoom !== 'global_official') {
        const prevRoom = rooms.get(socket.currentRoom);
        if (prevRoom && !prevRoom.isOfficial) {
          prevRoom.users.delete(socket.userId);
          socket.leave(socket.currentRoom);
          updateUsersList(socket.currentRoom);
        }
      }

      // الانضمام
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

      // إشعار انضمام
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

  // ════════════ كتم مستخدم ════════════
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

      const muteData = {
        userId: data.userId,
        mutedBy: admin.isSupremeLeader ? 'الزعيم' : admin.displayName,
        mutedById: socket.userId,
        reason: data.reason || 'مخالفة',
        temporary: data.duration > 0,
        expires: data.duration > 0 ? Date.now() + (data.duration * 60000) : null,
        roomId: socket.currentRoom,
        canOnlyBeRemovedBy: admin.isSupremeLeader ? 'supreme' : null
      };

      mutedUsers.set(data.userId, muteData);

      io.to(socket.currentRoom).emit('user-muted', {
        username: targetUser.displayName,
        duration: data.duration || 'دائم',
        mutedBy: muteData.mutedBy
      });

      socket.emit('action-success', `تم كتم ${targetUser.displayName}`);
      updateMutedList();
    } catch (error) {
      console.error('خطأ في الكتم:', error);
    }
  });

  // ════════════ حظر مستخدم ════════════
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

      const banData = {
        userId: data.userId,
        bannedBy: admin.isSupremeLeader ? 'الزعيم' : admin.displayName,
        bannedById: socket.userId,
        reason: data.reason || 'مخالفة',
        bannedAt: new Date(),
        canOnlyBeRemovedBy: admin.isSupremeLeader ? 'supreme' : null
      };

      bannedUsers.set(data.userId, banData);
      bannedIPs.set(socket.userIP, banData);

      // فصل المستخدم
      const targetSocket = Array.from(io.sockets.sockets.values())
        .find(s => s.userId === data.userId);
      
      if (targetSocket) {
        targetSocket.emit('banned', {
          reason: banData.reason,
          bannedBy: banData.bannedBy
        });
        targetSocket.disconnect();
      }

      socket.emit('action-success', `تم حظر ${targetUser.displayName}`);
      updateBannedList();
    } catch (error) {
      console.error('خطأ في الحظر:', error);
    }
  });

  // ════════════ إلغاء كتم ════════════
  socket.on('unmute-user', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin) return;

      const muteInfo = mutedUsers.get(data.userId);
      if (!muteInfo) {
        return socket.emit('error', 'المستخدم غير مكتوم');
      }

      if (muteInfo.canOnlyBeRemovedBy === 'supreme' && !admin.isSupremeLeader) {
        return socket.emit('error', 'فقط الزعيم يمكنه إلغاء هذا الكتم');
      }

      mutedUsers.delete(data.userId);
      socket.emit('action-success', 'تم إلغاء الكتم');
      updateMutedList();
    } catch (error) {
      console.error('خطأ في إلغاء الكتم:', error);
    }
  });

  // ════════════ إلغاء حظر ════════════
  socket.on('unban-user', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isSupremeLeader) {
        return socket.emit('error', 'فقط الزعيم يمكنه إلغاء الحظر');
      }

      const banInfo = bannedUsers.get(data.userId);
      if (!banInfo) {
        return socket.emit('error', 'المستخدم غير محظور');
      }

      bannedUsers.delete(data.userId);
      
      // إزالة حظر IP
      for (const [ip, info] of bannedIPs.entries()) {
        if (info.userId === data.userId) {
          bannedIPs.delete(ip);
        }
      }

      socket.emit('action-success', 'تم إلغاء الحظر');
      updateBannedList();
    } catch (error) {
      console.error('خطأ في إلغاء الحظر:', error);
    }
  });

  // ════════════ حذف رسالة (الزعيم فقط) ════════════
  socket.on('delete-message', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isSupremeLeader) {
        return socket.emit('error', 'فقط الزعيم يمكنه حذف الرسائل');
      }

      const room = rooms.get(data.roomId);
      if (room) {
        room.messages = room.messages.filter(msg => msg.id !== data.messageId);
        io.to(data.roomId).emit('message-deleted', data.messageId);
      }
    } catch (error) {
      console.error('خطأ في حذف الرسالة:', error);
    }
  });

  // ════════════ إضافة مشرف ════════════
  socket.on('add-moderator', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isSupremeLeader) {
        return socket.emit('error', 'فقط الزعيم يمكنه إضافة مشرفين');
      }

      const room = rooms.get(data.roomId);
      if (!room) return;

      room.moderators.add(data.userId);
      
      // تحديث صلاحيات المستخدم
      let perms = userPermissions.get(data.userId) || {};
      perms.canMuteInRoom = perms.canMuteInRoom || new Set();
      perms.canMuteInRoom.add(data.roomId);
      userPermissions.set(data.userId, perms);

      io.to(data.roomId).emit('moderator-added', {
        username: data.username,
        roomName: room.name
      });

      socket.emit('action-success', `تم إضافة ${data.username} كمشرف`);
    } catch (error) {
      console.error('خطأ في إضافة مشرف:', error);
    }
  });

  // ════════════ إزالة مشرف ════════════
  socket.on('remove-moderator', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isSupremeLeader) {
        return socket.emit('error', 'فقط الزعيم يمكنه إزالة مشرفين');
      }

      const room = rooms.get(data.roomId);
      if (!room) return;

      room.moderators.delete(data.userId);
      
      let perms = userPermissions.get(data.userId);
      if (perms && perms.canMuteInRoom) {
        perms.canMuteInRoom.delete(data.roomId);
      }

      socket.emit('action-success', `تم إزالة ${data.username} من الإشراف`);
    } catch (error) {
      console.error('خطأ في إزالة مشرف:', error);
    }
  });

  // ════════════ وضع صمت للغرفة ════════════
  socket.on('silence-room', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isSupremeLeader) {
        return socket.emit('error', 'فقط الزعيم يمكنه تفعيل الصمت');
      }

      const room = rooms.get(data.roomId);
      if (!room) return;

      room.isSilenced = true;
      
      io.to(data.roomId).emit('room-silenced', {
        roomName: room.name,
        message: '🔇 تم تفعيل وضع الصمت في الغرفة'
      });

      socket.emit('action-success', 'تم تفعيل وضع الصمت');
    } catch (error) {
      console.error('خطأ في الصمت:', error);
    }
  });

  // ════════════ إلغاء صمت الغرفة ════════════
  socket.on('unsilence-room', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isSupremeLeader) {
        return socket.emit('error', 'فقط الزعيم يمكنه إلغاء الصمت');
      }

      const room = rooms.get(data.roomId);
      if (!room) return;

      room.isSilenced = false;
      
      io.to(data.roomId).emit('room-unsilenced', {
        roomName: room.name,
        message: '🔊 تم إلغاء وضع الصمت في الغرفة'
      });

      socket.emit('action-success', 'تم إلغاء وضع الصمت');
    } catch (error) {
      console.error('خطأ في إلغاء الصمت:', error);
    }
  });

  // ════════════ حذف غرفة ════════════
  socket.on('delete-room', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isSupremeLeader) {
        return socket.emit('error', 'فقط الزعيم يمكنه حذف الغرف');
      }

      const room = rooms.get(data.roomId);
      if (!room) return;

      if (room.cannotBeDeleted) {
        return socket.emit('error', 'لا يمكن حذف هذه الغرفة');
      }

      // إخطار المستخدمين
      io.to(data.roomId).emit('room-deleted', {
        roomName: room.name,
        message: 'تم حذف هذه الغرفة'
      });

      // نقل المستخدمين للغرفة العالمية
      room.users.forEach(userId => {
        const userSocket = Array.from(io.sockets.sockets.values())
          .find(s => s.userId === userId);
        if (userSocket) {
          userSocket.leave(data.roomId);
          userSocket.join('global_official');
          userSocket.currentRoom = 'global_official';
        }
      });

      rooms.delete(data.roomId);
      socket.emit('action-success', 'تم حذف الغرفة');
      updateRoomsList();
    } catch (error) {
      console.error('خطأ في حذف الغرفة:', error);
    }
  });

  // ════════════ تنظيف شات الغرفة ════════════
  socket.on('clean-room-chat', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isSupremeLeader) {
        return socket.emit('error', 'فقط الزعيم يمكنه تنظيف الشات');
      }

      const room = rooms.get(data.roomId);
      if (!room) return;

      room.messages = [];
      
      io.to(data.roomId).emit('room-chat-cleaned', {
        roomName: room.name,
        message: '🧹 تم تنظيف جميع الرسائل من الغرفة'
      });

      socket.emit('action-success', 'تم تنظيف الشات');
    } catch (error) {
      console.error('خطأ في التنظيف:', error);
    }
  });

  // ════════════ رسالة دعم فني ════════════
  socket.on('send-support-message', async (data) => {
    try {
      const bannedUser = bannedUsers.has(socket.userId);
      
      if (!bannedUser) {
        return socket.emit('error', 'رسائل الدعم متاحة فقط للمستخدمين المحظورين');
      }

      const messageId = uuidv4();
      const message = {
        id: messageId,
        userId: socket.userId,
        username: data.username || 'مستخدم محظور',
        text: data.text.substring(0, 500),
        timestamp: new Date(),
        isRead: false,
        replied: false
      };

      supportMessages.set(messageId, message);
      
      // إرسال للمدير
      const adminSocket = Array.from(io.sockets.sockets.values())
        .find(s => s.userData?.isSupremeLeader);
      
      if (adminSocket) {
        adminSocket.emit('new-support-message', message);
      }

      socket.emit('support-message-sent', 'تم إرسال رسالتك للمدير');
    } catch (error) {
      console.error('خطأ في رسالة الدعم:', error);
    }
  });

  // ════════════ الرد على رسالة دعم ════════════
  socket.on('reply-support-message', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isSupremeLeader) {
        return socket.emit('error', 'غير مصرح');
      }

      const message = supportMessages.get(data.messageId);
      if (!message) return;

      message.replied = true;
      message.reply = data.reply;
      message.repliedAt = new Date();

      // إرسال للمستخدم المحظور
      const userSocket = Array.from(io.sockets.sockets.values())
        .find(s => s.userId === message.userId);
      
      if (userSocket) {
        userSocket.emit('support-reply', {
          messageId: data.messageId,
          reply: data.reply
        });
      }

      socket.emit('action-success', 'تم الرد على الرسالة');
    } catch (error) {
      console.error('خطأ في الرد:', error);
    }
  });

  // ════════════ قبول طلب إلغاء الحظر ════════════
  socket.on('accept-unban-request', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isSupremeLeader) {
        return socket.emit('error', 'غير مصرح');
      }

      const message = supportMessages.get(data.messageId);
      if (!message) return;

      // إلغاء الحظر
      bannedUsers.delete(message.userId);
      
      for (const [ip, info] of bannedIPs.entries()) {
        if (info.userId === message.userId) {
          bannedIPs.delete(ip);
        }
      }

      // حذف الرسالة
      supportMessages.delete(data.messageId);

      socket.emit('action-success', 'تم قبول الطلب وإلغاء الحظر');
      updateBannedList();
      updateSupportMessages();
    } catch (error) {
      console.error('خطأ في قبول الطلب:', error);
    }
  });

  // ════════════ حذف رسالة دعم ════════════
  socket.on('delete-support-message', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isSupremeLeader) {
        return socket.emit('error', 'غير مصرح');
      }

      supportMessages.delete(data.messageId);
      socket.emit('action-success', 'تم حذف الرسالة');
      updateSupportMessages();
    } catch (error) {
      console.error('خطأ في حذف رسالة الدعم:', error);
    }
  });

  // ════════════ تنظيف رسائل الدعم ════════════
  socket.on('clean-support-messages', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isSupremeLeader) {
        return socket.emit('error', 'غير مصرح');
      }

      if (data.deleteAll) {
        supportMessages.clear();
      } else if (data.messageIds) {
        data.messageIds.forEach(id => supportMessages.delete(id));
      }

      socket.emit('action-success', 'تم تنظيف رسائل الدعم');
      updateSupportMessages();
    } catch (error) {
      console.error('خطأ في التنظيف:', error);
    }
  });

  // ════════════ رسالة خاصة ════════════
  socket.on('send-private-message', async (data) => {
    try {
      const sender = users.get(socket.userId);
      const receiver = users.get(data.receiverId);
      
      if (!sender || !receiver) return;

      // التحقق من الحظر في الخاص
      const senderPMs = privateMessages.get(socket.userId);
      if (senderPMs && senderPMs.has('blocked_' + data.receiverId)) {
        return socket.emit('error', 'لقد حظرت هذا المستخدم');
      }

      const receiverPMs = privateMessages.get(data.receiverId);
      if (receiverPMs && receiverPMs.has('blocked_' + socket.userId)) {
        return socket.emit('error', 'هذا المستخدم حظرك');
      }

      const messageId = uuidv4();
      const message = {
        id: messageId,
        senderId: socket.userId,
        senderName: sender.displayName,
        senderAvatar: sender.customAvatar || sender.avatar,
        receiverId: data.receiverId,
        text: data.text.substring(0, 500),
        timestamp: new Date(),
        isRead: false,
        image: data.image || null
      };

      // حفظ في الرسائل الخاصة
      if (!privateMessages.has(socket.userId)) {
        privateMessages.set(socket.userId, new Map());
      }
      if (!privateMessages.has(data.receiverId)) {
        privateMessages.set(data.receiverId, new Map());
      }

      const senderMessages = privateMessages.get(socket.userId);
      const receiverMessages = privateMessages.get(data.receiverId);

      const conversationKey = `conv_${socket.userId}_${data.receiverId}`;
      
      if (!senderMessages.has(conversationKey)) {
        senderMessages.set(conversationKey, []);
      }
      if (!receiverMessages.has(conversationKey)) {
        receiverMessages.set(conversationKey, []);
      }

      senderMessages.get(conversationKey).push(message);
      receiverMessages.get(conversationKey).push(message);

      // حد 30 رسالة
      const senderConv = senderMessages.get(conversationKey);
      const receiverConv = receiverMessages.get(conversationKey);
      
      if (senderConv.length > 30) {
        senderConv.shift();
      }
      if (receiverConv.length > 30) {
        receiverConv.shift();
      }

      // إرسال للمستقبل
      const receiverSocket = Array.from(io.sockets.sockets.values())
        .find(s => s.userId === data.receiverId);
      
      if (receiverSocket) {
        receiverSocket.emit('new-private-message', message);
      }

      socket.emit('private-message-sent', message);
    } catch (error) {
      console.error('خطأ في الرسالة الخاصة:', error);
    }
  });

  // ════════════ حظر في الخاص ════════════
  socket.on('block-user-private', async (data) => {
    try {
      const user = users.get(socket.userId);
      const targetUser = users.get(data.userId);
      
      if (!user || !targetUser) return;

      if (targetUser.isSupremeLeader) {
        return socket.emit('error', 'لا يمكن حظر الزعيم');
      }

      if (!privateMessages.has(socket.userId)) {
        privateMessages.set(socket.userId, new Map());
      }

      const userPMs = privateMessages.get(socket.userId);
      userPMs.set('blocked_' + data.userId, true);

      socket.emit('action-success', `تم حظر ${targetUser.displayName} من الخاص`);
    } catch (error) {
      console.error('خطأ في حظر الخاص:', error);
    }
  });

  // ════════════ رفع صورة ════════════
  socket.on('upload-image', async (data) => {
    try {
      const user = users.get(socket.userId);
      if (!user) return;

      const permissions = userPermissions.get(socket.userId);
      const isAdmin = permissions?.unlimitedImageUpload;

      // التحقق من الحجم
      if (data.size > systemSettings.maxImageSize) {
        return socket.emit('error', 'حجم الصورة كبير جداً (الحد الأقصى 10MB)');
      }

      // التحقق من الحجم الكلي
      if (!isAdmin && systemSettings.currentImageSize + data.size > systemSettings.maxImageSize) {
        return socket.emit('error', 'تم الوصول للحد الأقصى للصور (10MB). انتظر حذف الصور القديمة');
      }

      const imageId = uuidv4();
      const imageData = {
        id: imageId,
        uploaderId: socket.userId,
        uploaderName: user.displayName,
        data: data.imageData,
        size: data.size,
        uploadedAt: new Date(),
        deleteAt: data.isPrivate ? 
          Date.now() + (60000) : // 1 دقيقة للخاص
          Date.now() + (300000), // 5 دقائق للعام
        roomId: data.roomId || null,
        isPrivate: data.isPrivate || false
      };

      uploadedImages.set(imageId, imageData);
      systemSettings.currentImageSize += data.size;

      socket.emit('image-uploaded', {
        imageId: imageId,
        imageUrl: `/image/${imageId}`,
        expiresIn: data.isPrivate ? 60 : 300
      });

      // إرسال للغرفة
      if (data.roomId) {
        io.to(data.roomId).emit('new-image-message', {
          imageId: imageId,
          imageUrl: `/image/${imageId}`,
          uploaderId: socket.userId,
          uploaderName: user.displayName,
          uploaderAvatar: user.customAvatar || user.avatar
        });
      }
    } catch (error) {
      console.error('خطأ في رفع الصورة:', error);
    }
  });

  // ════════════ حذف صورة ════════════
  socket.on('delete-image', async (data) => {
    try {
      const user = users.get(socket.userId);
      if (!user) return;

      const imageData = uploadedImages.get(data.imageId);
      if (!imageData) return;

      const canDelete = user.isSupremeLeader || imageData.uploaderId === socket.userId;
      
      if (!canDelete) {
        return socket.emit('error', 'لا يمكنك حذف هذه الصورة');
      }

      systemSettings.currentImageSize -= imageData.size;
      uploadedImages.delete(data.imageId);

      socket.emit('action-success', 'تم حذف الصورة');
      
      if (imageData.roomId) {
        io.to(imageData.roomId).emit('image-deleted', data.imageId);
      }
    } catch (error) {
      console.error('خطأ في حذف الصورة:', error);
    }
  });

  // ════════════ تغيير اسم العرض ════════════
  socket.on('change-display-name', async (data) => {
    try {
      const user = users.get(socket.userId);
      if (!user) return;

      if (user.nameChangeCount >= user.maxNameChanges && !user.isSupremeLeader) {
        return socket.emit('error', `لقد استنفذت محاولات تغيير الاسم (${user.maxNameChanges})`);
      }

      if (data.newName.length < 3 || data.newName.length > 30) {
        return socket.emit('error', 'الاسم يجب أن يكون بين 3-30 حرف');
      }

      user.displayName = data.newName;
      if (!user.isSupremeLeader) {
        user.nameChangeCount++;
      }

      socket.emit('action-success', 'تم تغيير اسمك بنجاح');
      
      // تحديث في جميع الغرف
      rooms.forEach(room => {
        if (room.users.has(socket.userId)) {
          io.to(room.id).emit('user-name-changed', {
            userId: socket.userId,
            newName: data.newName
          });
        }
      });
    } catch (error) {
      console.error('خطأ في تغيير الاسم:', error);
    }
  });

  // ════════════ منح محاولات تغيير الاسم ════════════
  socket.on('grant-name-changes', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isSupremeLeader) {
        return socket.emit('error', 'غير مصرح');
      }

      const targetUser = users.get(data.userId);
      if (!targetUser) return;

      targetUser.maxNameChanges += data.count;
      socket.emit('action-success', `تم منح ${data.count} محاولة تغيير اسم`);
    } catch (error) {
      console.error('خطأ في منح محاولات:', error);
    }
  });

  // ════════════ تغيير الإيموجي ════════════
  socket.on('change-emoji', async (data) => {
    try {
      const user = users.get(socket.userId);
      if (!user) return;

      // منع إيموجي البراز
      if (data.emoji === '💩') {
        return socket.emit('error', 'هذا الإيموجي غير مسموح');
      }

      user.avatar = data.emoji;
      socket.emit('action-success', 'تم تغيير الإيموجي');
    } catch (error) {
      console.error('خطأ في تغيير الإيموجي:', error);
    }
  });

  // ════════════ تغيير الصورة الشخصية (الزعيم فقط) ════════════
  socket.on('change-custom-avatar', async (data) => {
    try {
      const user = users.get(socket.userId);
      if (!user || !user.isSupremeLeader) {
        return socket.emit('error', 'فقط الزعيم يمكنه رفع صورة شخصية');
      }

      user.customAvatar = data.imageData;
      socket.emit('action-success', 'تم تغيير صورتك الشخصية');
    } catch (error) {
      console.error('خطأ في تغيير الصورة:', error);
    }
  });

  // ════════════ إضافة شارة خاصة ════════════
  socket.on('add-special-badge', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isSupremeLeader) {
        return socket.emit('error', 'غير مصرح');
      }

      const targetUser = users.get(data.userId);
      if (!targetUser) return;

      if (!targetUser.specialBadges) {
        targetUser.specialBadges = [];
      }

      if (!targetUser.specialBadges.includes(data.badge)) {
        targetUser.specialBadges.push(data.badge);
      }

      socket.emit('action-success', `تم إضافة الشارة ${data.badge}`);
    } catch (error) {
      console.error('خطأ في إضافة شارة:', error);
    }
  });

  // ════════════ إزالة شارة ════════════
  socket.on('remove-special-badge', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isSupremeLeader) {
        return socket.emit('error', 'غير مصرح');
      }

      const targetUser = users.get(data.userId);
      if (!targetUser) return;

      if (targetUser.specialBadges) {
        targetUser.specialBadges = targetUser.specialBadges.filter(b => b !== data.badge);
      }

      socket.emit('action-success', 'تم إزالة الشارة');
    } catch (error) {
      console.error('خطأ في إزالة شارة:', error);
    }
  });

  // ════════════ تفعيل رسائل مشعة ════════════
  socket.on('toggle-glowing-messages', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isSupremeLeader) {
        return socket.emit('error', 'غير مصرح');
      }

      const targetUser = users.get(data.userId);
      if (!targetUser) return;

      targetUser.glowingMessages = data.enabled;
      socket.emit('action-success', data.enabled ? 'تم تفعيل الرسائل المشعة' : 'تم إلغاء الرسائل المشعة');
    } catch (error) {
      console.error('خطأ في الرسائل المشعة:', error);
    }
  });

  // ════════════ تغيير إعدادات النظام ════════════
  socket.on('change-system-settings', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isSupremeLeader) {
        return socket.emit('error', 'غير مصرح');
      }

      if (data.setting === 'allowCopy') {
        systemSettings.allowCopy = data.value;
        io.emit('system-setting-changed', { setting: 'allowCopy', value: data.value });
      } else if (data.setting === 'allowScreenshot') {
        systemSettings.allowScreenshot = data.value;
        io.emit('system-setting-changed', { setting: 'allowScreenshot', value: data.value });
      } else if (data.setting === 'siteColor') {
        systemSettings.siteColor = data.value;
        io.emit('system-color-changed', { color: data.value });
        io.emit('system-notification', {
          message: 'تم تغيير لون الموقع'
        });
      } else if (data.setting === 'siteLogo') {
        systemSettings.siteLogo = data.value;
        io.emit('system-logo-changed', { logo: data.value });
        io.emit('system-notification', {
          message: 'تم تغيير صورة الموقع'
        });
      } else if (data.setting === 'siteTitle') {
        systemSettings.siteTitle = data.value;
        io.emit('system-title-changed', { title: data.value });
      } else if (data.setting === 'socialLinks') {
        systemSettings.socialLinks = { ...systemSettings.socialLinks, ...data.value };
        io.emit('system-social-changed', { links: systemSettings.socialLinks });
      }

      socket.emit('action-success', 'تم تحديث الإعدادات');
    } catch (error) {
      console.error('خطأ في تغيير الإعدادات:', error);
    }
  });

  // ════════════ حذف حساب ════════════
  socket.on('delete-account', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isSupremeLeader) {
        return socket.emit('error', 'غير مصرح');
      }

      const targetUser = users.get(data.userId);
      if (!targetUser) return;

      if (targetUser.isProtected) {
        return socket.emit('error', 'هذا الحساب محمي');
      }

      // فصل المستخدم
      const targetSocket = Array.from(io.sockets.sockets.values())
        .find(s => s.userId === data.userId);
      
      if (targetSocket) {
        targetSocket.emit('account-deleted', 'تم حذف حسابك');
        targetSocket.disconnect();
      }

      users.delete(data.userId);
      userProfiles.delete(data.userId);
      privateMessages.delete(data.userId);

      socket.emit('action-success', 'تم حذف الحساب');
    } catch (error) {
      console.error('خطأ في حذف الحساب:', error);
    }
  });

  // ════════════ طلب حذف الحساب (من المستخدم) ════════════
  socket.on('request-account-deletion', async (data) => {
    try {
      const user = users.get(socket.userId);
      if (!user) return;

      const requestId = uuidv4();
      const request = {
        id: requestId,
        userId: socket.userId,
        username: user.username,
        displayName: user.displayName,
        reason: data.reason,
        timestamp: new Date()
      };

      accountRequests.set(requestId, request);

      // إرسال للمدير
      const adminSocket = Array.from(io.sockets.sockets.values())
        .find(s => s.userData?.isSupremeLeader);
      
      if (adminSocket) {
        adminSocket.emit('new-account-deletion-request', request);
      }

      socket.emit('action-success', 'تم إرسال طلبك للمدير');
    } catch (error) {
      console.error('خطأ في طلب الحذف:', error);
    }
  });

  // ════════════ الموافقة على حذف حساب ════════════
  socket.on('approve-account-deletion', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isSupremeLeader) {
        return socket.emit('error', 'غير مصرح');
      }

      const request = accountRequests.get(data.requestId);
      if (!request) return;

      // حذف الحساب القديم
      users.delete(request.userId);
      userProfiles.delete(request.userId);
      
      accountRequests.delete(data.requestId);

      socket.emit('action-success', 'تم الموافقة على حذف الحساب');
    } catch (error) {
      console.error('خطأ في الموافقة:', error);
    }
  });

  // ════════════ الحصول على القوائم ════════════
  socket.on('get-muted-list', () => {
    updateMutedList(socket);
  });

  socket.on('get-banned-list', () => {
    updateBannedList(socket);
  });

  socket.on('get-support-messages', () => {
    updateSupportMessages(socket);
  });

  socket.on('get-rooms', () => {
    updateRoomsList(socket);
  });

  socket.on('get-users', (data) => {
    updateUsersList(data.roomId, socket);
  });

  socket.on('get-system-settings', () => {
    const admin = users.get(socket.userId);
    if (!admin || !admin.isSupremeLeader) return;

    socket.emit('system-settings', systemSettings);
  });

  // ════════════ قطع الاتصال ════════════
  socket.on('disconnect', () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      userSessions.delete(socket.userId);
      
      rooms.forEach(room => {
        if (!room.isOfficial && room.users.has(socket.userId)) {
          room.users.delete(socket.userId);
          updateUsersList(room.id);
        }
      });
      
      updateRoomsList();
    }
    console.log('🔌 قطع اتصال:', socket.id);
  });

  socket.on('ping', () => {
    if (socket.userId) {
      onlineUsers.set(socket.userId, Date.now());
    }
  });
});

// ═══════════════════ دوال مساعدة ═══════════════════

function updateRoomsList(socket = null) {
  const roomList = Array.from(rooms.values()).map(room => ({
    id: room.id,
    name: room.name,
    description: room.description,
    userCount: room.users.size,
    hasPassword: room.hasPassword,
    isOfficial: room.isOfficial,
    cannotLeave: room.cannotLeave,
    cannotBeDeleted: room.cannotBeDeleted,
    createdBy: room.createdBy,
    isSilenced: room.isSilenced
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
      isProtected: user.isProtected,
      specialBadges: user.specialBadges || [],
      profile: userProfiles.get(userId) || {}
    };
  }).filter(Boolean);

  if (socket) {
    socket.emit('users-list', userList);
  } else {
    io.to(roomId).emit('users-list', userList);
  }
}

function updateMutedList(socket = null) {
  const mutedList = Array.from(mutedUsers.entries()).map(([userId, data]) => {
    const user = users.get(userId);
    return {
      userId: userId,
      username: user?.displayName || 'مستخدم',
      mutedBy: data.mutedBy,
      reason: data.reason,
      temporary: data.temporary,
      expiresIn: data.temporary && data.expires ? 
        Math.ceil((data.expires - Date.now()) / 60000) : null,
      canOnlyBeRemovedBy: data.canOnlyBeRemovedBy
    };
  });

  if (socket) {
    socket.emit('muted-list', mutedList);
  } else {
    const adminSocket = Array.from(io.sockets.sockets.values())
      .find(s => s.userData?.isSupremeLeader);
    if (adminSocket) {
      adminSocket.emit('muted-list', mutedList);
    }
  }
}

function updateBannedList(socket = null) {
  const bannedList = Array.from(bannedUsers.entries()).map(([userId, data]) => {
    const user = users.get(userId);
    return {
      userId: userId,
      username: user?.username || 'مستخدم',
      bannedBy: data.bannedBy,
      reason: data.reason,
      bannedAt: data.bannedAt,
      canOnlyBeRemovedBy: data.canOnlyBeRemovedBy
    };
  });

  if (socket) {
    socket.emit('banned-list', bannedList);
  } else {
    const adminSocket = Array.from(io.sockets.sockets.values())
      .find(s => s.userData?.isSupremeLeader);
    if (adminSocket) {
      adminSocket.emit('banned-list', bannedList);
    }
  }
}

function updateSupportMessages(socket = null) {
  const messages = Array.from(supportMessages.values());

  if (socket) {
    socket.emit('support-messages-list', messages);
  } else {
    const adminSocket = Array.from(io.sockets.sockets.values())
      .find(s => s.userData?.isSupremeLeader);
    if (adminSocket) {
      adminSocket.emit('support-messages-list', messages);
    }
  }
}

// ═══════════════════ Routes للصور ═══════════════════
app.get('/image/:imageId', (req, res) => {
  const imageData = uploadedImages.get(req.params.imageId);
  
  if (!imageData) {
    return res.status(404).send('الصورة غير موجودة');
  }

  // التحقق من انتهاء الصلاحية
  if (imageData.deleteAt && Date.now() > imageData.deleteAt) {
    systemSettings.currentImageSize -= imageData.size;
    uploadedImages.delete(req.params.imageId);
    return res.status(410).send('انتهت صلاحية الصورة');
  }

  const buffer = Buffer.from(imageData.data.split(',')[1], 'base64');
  res.set('Content-Type', 'image/jpeg');
  res.send(buffer);
});

// ═══════════════════ معالجة الأخطاء ═══════════════════
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
});

// ═══════════════════ تشغيل السيرفر ═══════════════════
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ╔═══════════════════════════════════════════════════════╗
  ║          ✅ الخادم يعمل بنجاح                        ║
  ╠═══════════════════════════════════════════════════════╣
  ║  🔗 البورت: ${PORT}                                  ║
  ║  🌐 الرابط: http://localhost:${PORT}                ║
  ║  👑 نظام MOBO المتكامل جاهز للعمل                   ║
  ║  © 2025 MOBO - جميع الحقوق محفوظة                   ║
  ╚═══════════════════════════════════════════════════════╝
  `);
  
  console.log(`
  ═══════════════════ الميزات المتاحة ═══════════════════
  ✅ نظام تسجيل دخول وإنشاء حسابات آمن
  ✅ كتم مؤقت ودائم مع صلاحيات متقدمة
  ✅ حظر بالـ IP مع نظام استئناف
  ✅ غرف دردشة بكلمات سر
  ✅ نظام مشرفين بصلاحيات محددة
  ✅ رسائل خاصة بين المستخدمين
  ✅ رفع صور بحد أقصى 10MB
  ✅ حذف تلقائي للصور
  ✅ نظام دعم فني للمحظورين
  ✅ تغيير أسماء وإيموجي
  ✅ شارات خاصة ورسائل مشعة
  ✅ وضع صمت للغرف
  ✅ تنظيف الشات التلقائي
  ✅ حماية من النسخ والسكرينشوت
  ✅ تغيير ألوان الموقع ديناميكياً
  ✅ ربط حسابات التواصل الاجتماعي
  ✅ إدارة كاملة من لوحة التحكم
  ✅ حذف حسابات وطلبات حذف
  ✅ صلاحيات الزعيم الكاملة
  ═══════════════════════════════════════════════════════
  `);
});

module.exports = { app, server, io };
