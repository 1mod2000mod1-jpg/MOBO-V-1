const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 10e6
});

const PORT = process.env.PORT || 3000;

console.log(`
╔════════════════════════════════════════════════════════════════╗
║          🚀 موقع MOBO العالمي - النظام الأقوى                ║
║            © 2025 جميع الحقوق محفوظة للزعيم                  ║
║         ⚠️ يمنع النسخ أو التقليد تحت طائلة القانون ⚠️        ║
╚════════════════════════════════════════════════════════════════╝
`);

// إعدادات رفع الصور
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('الملف يجب أن يكون صورة'));
    }
  }
});

app.use(express.static(path.join(__dirname)));
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    time: new Date(),
    uptime: process.uptime(),
    version: '7.0.0'
  });
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
const accountDeletionRequests = new Map();
const secretRooms = new Map();
const userPermissions = new Map();

// إعدادات النظام
let systemSettings = {
  allowCopy: false,
  allowScreenshot: false,
  siteColor: 'red',
  siteLogo: 'https://i.top4top.io/p_3583q2vy21.jpg',
  siteTitle: 'موقع MOBO العالمي',
  maxImageSize: 10 * 1024 * 1024,
  currentImageSize: 0,
  adminPassword: 'Mobo@Supreme2025!@#',
  socialLinks: {
    telegram: '',
    instagram: '',
    youtube: '',
    email: 'supreme@mobo.com'
  },
  maxChatMessages: 100,
  autoCleanImages: true,
  imageRetentionTime: 300000, // 5 دقائق
  privateImageRetentionTime: 60000 // دقيقة واحدة
};

// إنشاء حساب الزعيم الأعلى
const createSupremeLeader = () => {
  const supremeId = 'supreme_mobo_001';
  
  const supremeLeader = {
    id: supremeId,
    username: 'MOBO',
    displayName: '👑 الزعيم MOBO - المالك الأعلى',
    password: bcrypt.hashSync(systemSettings.adminPassword, 12),
    isAdmin: true,
    isSuperAdmin: true,
    isSupremeLeader: true,
    isVerified: true,
    isProtected: true,
    cannotBeMuted: true,
    cannotBeBanned: true,
    cannotBeKicked: true,
    hasAllPermissions: true,
    joinDate: new Date(),
    lastActive: new Date(),
    avatar: '👑',
    customAvatar: null,
    customImage: null,
    specialBadges: ['👑', '⭐', '💎', '🔱'],
    glowingMessages: true,
    nameChangeCount: 0,
    maxNameChanges: Infinity,
    canAccessAllRooms: true,
    canDeleteAnyMessage: true,
    canDeleteAnyRoom: true,
    canAddModerators: true,
    canRemoveModerators: true,
    canChangeSystemSettings: true,
    canSeeChatPasswords: true,
    totalPower: Infinity
  };

  users.set(supremeId, supremeLeader);
  userProfiles.set(supremeId, {
    userId: supremeId,
    gender: 'male',
    avatar: '👑',
    customImage: null,
    status: '🔱 المطور والمالك الأعلى - لا يُقهر 🔱',
    country: 'global',
    joinDate: new Date(),
    specialStatus: 'SUPREME_LEADER'
  });
  privateMessages.set(supremeId, new Map());

  console.log(`✅ الزعيم الأعلى جاهز: MOBO`);
  console.log(`🔐 كلمة المرور: ${systemSettings.adminPassword}`);
  return supremeLeader;
};

// إنشاء الغرفة العالمية الرسمية
const createGlobalRoom = () => {
  const globalRoom = {
    id: 'global_official_supreme',
    name: '🌍 الغرفة العالمية الرسمية - MOBO',
    description: 'الغرفة الرئيسية للجميع تحت إشراف الزعيم',
    createdBy: 'الزعيم MOBO',
    creatorId: 'supreme_mobo_001',
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
    isSilenced: false,
    silencedBy: null,
    maxMessages: 100,
    autoClean: true
  };

  rooms.set(globalRoom.id, globalRoom);
  console.log('✅ الغرفة العالمية الرسمية جاهزة');
  return globalRoom;
};

createSupremeLeader();
createGlobalRoom();

// تنظيف تلقائي متقدم
setInterval(() => {
  const now = Date.now();
  
  // تنظيف المستخدمين غير النشطين
  for (const [userId, lastSeen] of onlineUsers.entries()) {
    if (now - lastSeen > 300000) { // 5 دقائق
      onlineUsers.delete(userId);
    }
  }
  
  // تنظيف الصور المنتهية
  for (const [imageId, imageData] of uploadedImages.entries()) {
    if (imageData.deleteAt && now > imageData.deleteAt) {
      systemSettings.currentImageSize -= imageData.size;
      uploadedImages.delete(imageId);
      console.log(`🧹 تم حذف صورة منتهية: ${imageId}`);
    }
  }
  
  // تنظيف الكتم المؤقت
  for (const [userId, muteData] of mutedUsers.entries()) {
    if (muteData.temporary && muteData.expires && now > muteData.expires) {
      mutedUsers.delete(userId);
      console.log(`🔊 تم إلغاء كتم مؤقت: ${userId}`);
    }
  }
  
  // تنظيف الرسائل الزائدة
  for (const [roomId, room] of rooms.entries()) {
    if (room.messages.length > room.maxMessages) {
      const removed = room.messages.length - room.maxMessages;
      room.messages = room.messages.slice(-room.maxMessages);
      console.log(`🧹 تنظيف ${removed} رسالة من ${room.name}`);
    }
  }
  
  // تنظيف الرسائل الخاصة القديمة
  for (const [userId, conversations] of privateMessages.entries()) {
    for (const [otherUserId, messages] of conversations.entries()) {
      if (messages.length > 30) {
        const removed = messages.length - 30;
        conversations.set(otherUserId, messages.slice(-30));
        console.log(`🧹 تنظيف ${removed} رسالة خاصة`);
      }
    }
  }
  
}, 60000); // كل دقيقة

// Socket.IO - الاتصالات
io.on('connection', (socket) => {
  console.log('🔗 اتصال جديد:', socket.id);
  socket.userIP = socket.handshake.address;
  socket.connectedAt = Date.now();

  // تسجيل الدخول
  socket.on('login', async (data) => {
    try {
      console.log('📥 محاولة تسجيل دخول:', data.username);
      
      const { username, password } = data;
      
      if (!username || !password) {
        return socket.emit('login-error', 'الرجاء إدخال جميع البيانات');
      }

      // فحص الحظر بالـ IP
      if (bannedIPs.has(socket.userIP)) {
        console.log('❌ IP محظور:', socket.userIP);
        return socket.emit('banned-user', {
          reason: 'تم حظر عنوان IP الخاص بك',
          bannedBy: 'النظام',
          canAppeal: true
        });
      }

      // البحث عن المستخدم
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
        console.log('❌ بيانات خاطئة');
        return socket.emit('login-error', 'اسم المستخدم أو كلمة المرور غير صحيحة');
      }

      // فحص الحظر
      if (bannedUsers.has(userId)) {
        const banInfo = bannedUsers.get(userId);
        console.log('❌ مستخدم محظور:', username);
        return socket.emit('banned-user', {
          reason: banInfo.reason,
          bannedBy: banInfo.bannedBy,
          bannedAt: banInfo.bannedAt,
          canAppeal: true
        });
      }

      // تسجيل الدخول بنجاح
      socket.userId = userId;
      socket.userData = userFound;
      userFound.lastActive = new Date();
      onlineUsers.set(userId, Date.now());

      // الانضمام للغرفة العالمية
      const globalRoom = rooms.get('global_official_supreme');
      globalRoom.users.add(userId);
      socket.join('global_official_supreme');
      socket.currentRoom = 'global_official_supreme';

      console.log('✅ دخول ناجح:', username);

      // إرسال البيانات
      socket.emit('login-success', {
        user: {
          id: userId,
          username: userFound.username,
          displayName: userFound.displayName || userFound.username,
          avatar: userFound.customImage || userFound.customAvatar || userFound.avatar,
          isAdmin: userFound.isAdmin || false,
          isSuperAdmin: userFound.isSuperAdmin || false,
          isSupremeLeader: userFound.isSupremeLeader || false,
          isVerified: userFound.isVerified || false,
          specialBadges: userFound.specialBadges || [],
          glowingMessages: userFound.glowingMessages || false,
          nameChangeCount: userFound.nameChangeCount || 0,
          maxNameChanges: userFound.maxNameChanges || 0
        },
        permissions: {
          canDeleteAnyMessage: userFound.canDeleteAnyMessage || false,
          canDeleteAnyRoom: userFound.canDeleteAnyRoom || false,
          canAddModerators: userFound.canAddModerators || false,
          canRemoveModerators: userFound.canRemoveModerators || false,
          canChangeSystemSettings: userFound.canChangeSystemSettings || false,
          canAccessSecretRooms: userFound.isSupremeLeader || false,
          canSeeChatPasswords: userFound.canSeeChatPasswords || false,
          canKickUsers: userFound.isAdmin || userFound.isSupremeLeader || false
        },
        room: {
          id: globalRoom.id,
          name: globalRoom.name,
          description: globalRoom.description,
          messages: globalRoom.messages.slice(-50),
          isSilenced: globalRoom.isSilenced || false
        },
        systemSettings: {
          ...systemSettings,
          adminPassword: undefined // لا نرسل الباسورد
        }
      });

      // إشعار المستخدمين الآخرين
      io.to('global_official_supreme').emit('user-joined-room', {
        userId: userId,
        username: userFound.displayName || userFound.username,
        avatar: userFound.customImage || userFound.customAvatar || userFound.avatar,
        roomName: globalRoom.name,
        isSupreme: userFound.isSupremeLeader || false
      });

      updateRoomsList();
      updateUsersList('global_official_supreme');

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

      // فحص الحساب المكرر
      for (const user of users.values()) {
        if (user.username.toLowerCase() === username.toLowerCase()) {
          return socket.emit('register-error', 'اسم المستخدم موجود مسبقاً');
        }
      }

      // فحص تعدد الحسابات من نفس الـ IP
      let accountsFromIP = 0;
      for (const user of users.values()) {
        if (user.registrationIP === socket.userIP) {
          accountsFromIP++;
        }
      }

      if (accountsFromIP >= 2) {
        return socket.emit('register-error', 
          'لديك بالفعل حسابان من هذا الجهاز. اتصل بالزعيم للحصول على إذن خاص');
      }

      const userId = 'user_' + uuidv4();
      const hashedPassword = bcrypt.hashSync(password, 10);

      const newUser = {
        id: userId,
        username: username,
        displayName: displayName,
        password: hashedPassword,
        isAdmin: false,
        isSuperAdmin: false,
        isSupremeLeader: false,
        isVerified: false,
        joinDate: new Date(),
        lastActive: new Date(),
        registrationIP: socket.userIP,
        avatar: emoji || (gender === 'female' ? '👩' : '👨'),
        customAvatar: null,
        customImage: null,
        nameChangeCount: 0,
        maxNameChanges: 0,
        specialBadges: [],
        glowingMessages: false,
        isModerator: false,
        moderatorRooms: new Set()
      };

      users.set(userId, newUser);
      userProfiles.set(userId, {
        userId: userId,
        gender: gender || 'male',
        avatar: emoji || (gender === 'female' ? '👩' : '👨'),
        customImage: null,
        status: '🌟 عضو جديد',
        country: 'global',
        joinDate: new Date()
      });
      privateMessages.set(userId, new Map());

      console.log('✅ تسجيل ناجح:', username);

      socket.emit('register-success', {
        message: '🎉 تم إنشاء حسابك بنجاح! يمكنك الآن تسجيل الدخول',
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

      // فحص الصمت
      if (room.isSilenced && !user.isSupremeLeader) {
        return socket.emit('message-error', '🔇 الغرفة في وضع الصمت من قبل الزعيم');
      }

      // فحص الكتم
      const muteInfo = mutedUsers.get(socket.userId);
      if (muteInfo) {
        const canUnmute = muteInfo.canOnlyBeRemovedBy === 'supreme' ? 
          false : (muteInfo.temporary && muteInfo.expires && muteInfo.expires <= Date.now());
        
        if (!canUnmute) {
          const remaining = muteInfo.temporary && muteInfo.expires ? 
            Math.ceil((muteInfo.expires - Date.now()) / 60000) : 'دائم';
          return socket.emit('message-error', 
            `أنت مكتوم ${muteInfo.temporary ? `لمدة ${remaining} دقيقة` : 'بشكل دائم'} من قبل ${muteInfo.mutedBy}`);
        } else {
          mutedUsers.delete(socket.userId);
        }
      }

      const messageText = data.text.trim().substring(0, 500);
      if (!messageText) return;

      const message = {
        id: 'msg_' + uuidv4(),
        userId: socket.userId,
        username: user.displayName || user.username,
        avatar: user.customImage || user.customAvatar || user.avatar,
        text: messageText,
        timestamp: new Date().toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        fullTimestamp: new Date(),
        isSupremeLeader: user.isSupremeLeader || false,
        isSuperAdmin: user.isSuperAdmin || false,
        isAdmin: user.isAdmin || false,
        isModerator: room.moderators.has(socket.userId) || false,
        isVerified: user.isVerified || false,
        specialBadges: user.specialBadges || [],
        roomId: socket.currentRoom,
        glowing: user.glowingMessages || false,
        canDelete: user.isSupremeLeader || room.creatorId === socket.userId
      };

      room.messages.push(message);
      
      // تنظيف تلقائي
      if (room.messages.length > room.maxMessages) {
        const removed = room.messages.length - room.maxMessages;
        room.messages = room.messages.slice(-room.maxMessages);
        io.to(socket.currentRoom).emit('chat-auto-cleaned', {
          message: `🧹 تم تنظيف ${removed} رسالة قديمة تلقائياً`,
          remaining: room.messages.length
        });
      }

      io.to(socket.currentRoom).emit('new-message', message);
      onlineUsers.set(socket.userId, Date.now());

    } catch (error) {
      console.error('خطأ في إرسال الرسالة:', error);
      socket.emit('message-error', 'فشل إرسال الرسالة');
    }
  });

  // إنشاء غرفة
  socket.on('create-room', async (data) => {
    try {
      const user = users.get(socket.userId);
      if (!user) return;

      const roomId = 'room_' + uuidv4();
      const roomName = data.name.trim().substring(0, 50);
      const roomDesc = data.description?.trim().substring(0, 200) || '';
      const roomPass = data.password?.trim() || null;

      if (!roomName) {
        return socket.emit('error', 'أدخل اسم الغرفة');
      }

      const newRoom = {
        id: roomId,
        name: roomName,
        description: roomDesc,
        createdBy: user.displayName || user.username,
        creatorId: socket.userId,
        createdAt: new Date(),
        users: new Set([socket.userId]),
        messages: [],
        isActive: true,
        isGlobal: false,
        isOfficial: false,
        isSecret: false,
        hasPassword: !!roomPass,
        password: roomPass ? bcrypt.hashSync(roomPass, 10) : null,
        rawPassword: user.isSupremeLeader ? roomPass : null,
        moderators: new Set(),
        isSilenced: false,
        silencedBy: null,
        maxMessages: 100,
        autoClean: true,
        canLeave: true,
        canDelete: true
      };

      rooms.set(roomId, newRoom);
      
      socket.emit('room-created', {
        roomId: roomId,
        roomName: newRoom.name,
        message: '✅ تم إنشاء الغرفة بنجاح!'
      });

      updateRoomsList();
      console.log('✅ غرفة جديدة:', newRoom.name, 'بواسطة', user.displayName);
      
    } catch (error) {
      console.error('خطأ في إنشاء غرفة:', error);
      socket.emit('error', 'فشل إنشاء الغرفة');
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

      // فحص كلمة السر
      if (room.hasPassword && !user.isSupremeLeader) {
        if (!data.password) {
          return socket.emit('room-password-required', {
            roomId: room.id,
            roomName: room.name
          });
        }
        if (!bcrypt.compareSync(data.password, room.password)) {
          return socket.emit('error', '❌ كلمة المرور غير صحيحة');
        }
      }

      // مغادرة الغرفة السابقة
      if (socket.currentRoom && socket.currentRoom !== 'global_official_supreme') {
        const prevRoom = rooms.get(socket.currentRoom);
        if (prevRoom && prevRoom.canLeave) {
          prevRoom.users.delete(socket.userId);
          socket.leave(socket.currentRoom);
          updateUsersList(socket.currentRoom);
        }
      }

      // الانضمام للغرفة الجديدة
      room.users.add(socket.userId);
      socket.join(data.roomId);
      socket.currentRoom = data.roomId;

      // إرسال بيانات الغرفة
      socket.emit('room-joined', {
        room: {
          id: room.id,
          name: room.name,
          description: room.description,
          messages: room.messages.slice(-50),
          userCount: room.users.size,
          isModerator: room.moderators.has(socket.userId),
          isCreator: room.creatorId === socket.userId,
          isSupreme: user.isSupremeLeader,
          canLeave: room.canLeave && !room.isGlobal,
          isSilenced: room.isSilenced,
          hasPassword: room.hasPassword,
          password: user.isSupremeLeader ? room.rawPassword : null
        }
      });

      // إشعار المستخدمين
      io.to(data.roomId).emit('user-joined-room', {
        userId: socket.userId,
        username: user.displayName || user.username,
        avatar: user.customImage || user.customAvatar || user.avatar,
        roomName: room.name,
        isSupreme: user.isSupremeLeader || false
      });

      updateUsersList(data.roomId);
      updateRoomsList();
      
    } catch (error) {
      console.error('خطأ في الانضمام:', error);
      socket.emit('error', 'فشل الانضمام للغرفة');
    }
  });

  // كتم مستخدم
  socket.on('mute-user', async (data) => {
    try {
      const admin = users.get(socket.userId);
      const targetUser = users.get(data.userId);
      
      if (!admin || !targetUser) return;
      
      if (targetUser.cannotBeMuted || targetUser.isSupremeLeader) {
        return socket.emit('error', '❌ لا يمكن كتم الزعيم أو المحميين');
      }

      const room = rooms.get(socket.currentRoom);
      const isModerator = room?.moderators.has(socket.userId);
      const isSupreme = admin.isSupremeLeader;

      if (!isModerator && !isSupreme) {
        return socket.emit('error', '❌ ليس لديك صلاحية الحظر');
      }

      const reason = data.reason?.trim() || 'مخالفة القوانين';
      
      bannedUsers.set(data.userId, {
        reason: reason,
        bannedBy: isSupreme ? 'الزعيم' : (admin.displayName || admin.username),
        bannedById: socket.userId,
        bannedAt: new Date(),
        canOnlyBeRemovedBy: isSupreme ? 'supreme' : null,
        userIP: targetUser.registrationIP
      });

      // حظر الـ IP
      if (targetUser.registrationIP) {
        bannedIPs.set(targetUser.registrationIP, {
          userId: data.userId,
          bannedAt: new Date(),
          reason: reason
        });
      }

      // قطع اتصال المستخدم
      const targetSockets = Array.from(io.sockets.sockets.values())
        .filter(s => s.userId === data.userId);
      
      targetSockets.forEach(s => {
        s.emit('banned', {
          reason: reason,
          bannedBy: bannedUsers.get(data.userId).bannedBy,
          isSupremeBan: isSupreme
        });
        s.disconnect(true);
      });

      socket.emit('action-success', `✅ تم حظر ${targetUser.displayName || targetUser.username} نهائياً`);
      console.log(`🚫 حظر ${targetUser.username} بواسطة ${admin.username}`);
      
    } catch (error) {
      console.error('خطأ في الحظر:', error);
      socket.emit('error', 'فشل عملية الحظر');
    }
  });

 // ملاحظة: هذا هو الجزء الأخير من ملف server.js
// ضعه في نهاية الملف بعد جميع socket.on handlers

  // إلغاء الكتم
  socket.on('unmute-user', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin) return;

      const muteInfo = mutedUsers.get(data.userId);
      if (!muteInfo) {
        return socket.emit('error', 'المستخدم غير مكتوم');
      }

      if (muteInfo.canOnlyBeRemovedBy === 'supreme' && !admin.isSupremeLeader) {
        return socket.emit('error', '❌ فقط الزعيم يمكنه إلغاء هذا الكتم');
      }

      mutedUsers.delete(data.userId);
      
      const targetUser = users.get(data.userId);
      socket.emit('action-success', `✅ تم إلغاء كتم ${targetUser?.displayName || 'المستخدم'}`);
      
      io.emit('user-unmuted', {
        userId: data.userId,
        username: targetUser?.displayName || 'المستخدم'
      });
      
    } catch (error) {
      console.error('خطأ في إلغاء الكتم:', error);
    }
  });

  // إلغاء الحظر
  socket.on('unban-user', async (data) => {
    try {
      const admin = users.get(socket.userId);
      if (!admin || !admin.isSupremeLeader) {
        return socket.emit('error', '❌ فقط الزعيم يمكنه إلغاء الحظر');
      }

      const banInfo = bannedUsers.get(data.userId);
      if (!banInfo) {
        return socket.emit('error', 'المستخدم غير محظور');
      }

      // إلغاء حظر الـ IP
      if (banInfo.userIP) {
        bannedIPs.delete(banInfo.userIP);
      }

      bannedUsers.delete(data.userId);
      
      const targetUser = users.get(data.userId);
      socket.emit('action-success', `✅ تم إلغاء حظر ${targetUser?.displayName || 'المستخدم'}`);
      console.log(`✅ إلغاء حظر ${targetUser?.username} بواسطة الزعيم`);
      
    } catch (error) {
      console.error('خطأ في إلغاء الحظر:', error);
    }
  });

  // باقي الـ handlers...
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

// دوال مساعدة
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
      isSupremeLeader: user.isSupremeLeader || false,
      isSuperAdmin: user.isSuperAdmin || false,
      isAdmin: user.isAdmin || false,
      isModerator: room.moderators.has(userId),
      isVerified: user.isVerified || false,
      specialBadges: user.specialBadges || []
    };
  }).filter(Boolean);

  if (socket) {
    socket.emit('users-list', userList);
  } else {
    io.to(roomId).emit('users-list', userList);
  }
}

// معالجة الأخطاء
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
});

// تشغيل الخادم
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                  ✅ الخادم يعمل بنجاح                         ║
║  🔗 البورت: ${PORT.toString().padEnd(48)}║
║  🌐 الرابط: http://localhost:${PORT.toString().padEnd(35)}║
║  👑 نظام MOBO - الأقوى والأكثر تطوراً                        ║
║  ⚡ جاهز لاستقبال الاتصالات                                  ║
║  🛡️ محمي ضد الاختراق والنسخ                                 ║
╚════════════════════════════════════════════════════════════════╝

📊 إحصائيات التشغيل:
   • المستخدمون: ${users.size}
   • الغرف: ${rooms.size}
   • الإعدادات: محملة ✅
   • الحماية: مفعلة 🛡️

⚠️  تذكير: هذا النظام محمي بحقوق الطبع والنشر
   © 2025 MOBO - جميع الحقوق محفوظة للزعيم
  `);
});

// لا تصدر أي شيء - هذا سيرفر مستقل
// module.exports محذوف لتجنب الأخطاء
}userId);
      const isSupreme = admin.isSupremeLeader;

      if (!isModerator && !isSupreme) {
        return socket.emit('error', '❌ ليس لديك صلاحية الكتم');
      }

      const duration = parseInt(data.duration) || 10;
      const reason = data.reason?.trim() || 'مخالفة القوانين';
      
      mutedUsers.set(data.userId, {
        expires: duration > 0 ? Date.now() + (duration * 60000) : null,
        reason: reason,
        mutedBy: isSupreme ? 'الزعيم' : (admin.displayName || admin.username),
        mutedById: socket.userId,
        temporary: duration > 0,
        roomId: socket.currentRoom,
        mutedAt: new Date(),
        canOnlyBeRemovedBy: isSupreme ? 'supreme' : null
      });

      io.to(socket.currentRoom).emit('user-muted', {
        userId: data.userId,
        username: targetUser.displayName || targetUser.username,
        duration: duration > 0 ? `${duration} دقيقة` : 'دائم',
        reason: reason,
        mutedBy: mutedUsers.get(data.userId).mutedBy,
        isSupremeMute: isSupreme
      });

      socket.emit('action-success', `✅ تم كتم ${targetUser.displayName || targetUser.username}`);
      console.log(`🔇 كتم ${targetUser.username} بواسطة ${admin.username}`);
      
    } catch (error) {
      console.error('خطأ في الكتم:', error);
      socket.emit('error', 'فشل عملية الكتم');
    }
  });

  // حظر مستخدم
  socket.on('ban-user', async (data) => {
    try {
      const admin = users.get(socket.userId);
      const targetUser = users.get(data.userId);
      
      if (!admin || !targetUser) return;
      
      if (targetUser.cannotBeBanned || targetUser.isSupremeLeader) {
        return socket.emit('error', '❌ لا يمكن حظر الزعيم أو المحميين');
      }

      const room = rooms.get(socket.currentRoom);
      const isModerator = room?.moderators.has(socket.
