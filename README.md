# ❄️ Cold Room V2 - Complete Chat Platform

Professional chat platform with advanced features and persistent data storage.

## 🚀 Quick Start

```bash
npm install
npm start
```

Open: `http://localhost:3000`

**⚠️ CHANGE PASSWORD IMMEDIATELY!**

## ✨ Features V2

### 💾 Data Persistence
- All data saved to `cold_room_data.json`
- Survives server restarts
- Auto-save every 30 seconds

### 👥 User Management
- Mute (temporary/permanent)
- Ban (IP-based)
- Delete accounts + all messages
- Batch unmute/unban

### 🏠 Room Management
- Create/edit/delete rooms
- Password protection
- Silence/unsilence
- Clean messages
- Party mode with lights

### 💬 Messages
- 500 characters max
- Edit messages
- Delete messages
- Images (owner only)
- Private messages

### 🎵 Music System
- Separate login/chat music
- Volume control
- MP3 URLs

### 📺 YouTube Watch Together
- Watch videos in global room
- Synchronized playback

### ⚙️ Owner Panel
- Muted list
- Banned list
- Support messages
- Complete settings

### 🎨 Customization
- Site logo
- Site title
- Color themes (blue/black)
- Party mode effects

## 📁 Files

- `server.js` - Backend with persistent storage
- `index.html` - Complete UI
- `script.js` (Parts 1 & 2) - Full client logic
- `style.css` - Beautiful design
- `package.json` - Dependencies
- `cold_room_data.json` - Auto-created data file

## 🎮 Usage

### Owner Powers
- Access Owner Panel (👑 button)
- Long-press rooms for options
- Click messages for actions
- Control everything

### Moderators
- Can mute users
- Owner grants/revokes permissions

### Users
- 500 char messages
- Edit own messages
- Private chat
- Join rooms

## 🔧 Settings

### In Owner Panel → Settings:

1. **Logo**: Image URL
2. **Title**: Site name
3. **Color**: Blue or Black
4. **Login Music**: MP3 URL + volume
5. **Chat Music**: MP3 URL + volume
6. **Clean All**: Remove all messages

## 📊 Technical Details

- **Port**: 3000 (or PORT env variable)
- **Storage**: JSON file
- **Sessions**: Persistent across restarts
- **Online**: Real-time Socket.IO
- **Music**: Hidden audio players
- **YouTube**: IFrame API

## 🚀 Deploy to Render

1. Push to GitHub
2. Create Web Service on Render
3. Connect repository
4. Build: `npm install`
5. Start: `npm start`
6. Deploy!

**Important**: `cold_room_data.json` will be created automatically but won't persist on free Render plan restarts. For production, use a database.

## 🐛 Troubleshooting

### Messages appear in wrong rooms
✅ Fixed! Messages now stay in their rooms.

### Actions menu moves around
✅ Fixed! Menu now centered and stable.

### Moderator permissions don't work
✅ Fixed! Moderators can now mute users.

### Data lost on restart
✅ Fixed! All data persists in JSON file.

### Music doesn't play
- Check MP3 URLs are direct links
- Browser may block autoplay initially
- Click anywhere to allow audio

### YouTube not working
- Only works in Global Room
- Need valid YouTube video ID/URL
- Owner only can start/stop

## 📝 Notes

- All settings persist forever
- Logo/title update everywhere
- Colors apply to all screens
- Snowman has reduced opacity
- Party mode is smooth and light
- Moderators shown with ⭐
- Owner always shown with 👑

## ⚖️ Copyright

© 2025 Cold Room
Owner: Cold Room King
All Rights Reserved

---

**❄️ Where Conversations Freeze Time ❄️**
