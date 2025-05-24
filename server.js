const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: "https://zoromeet.vercel.app",
  credentials: true
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://zoromeet.vercel.app",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Track rooms and users
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // ✅ Move this joinRoom block INSIDE here
  socket.on('joinRoom', ({ roomId }) => {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { users: [] });
    }

    rooms.get(roomId).users.push(socket.id);
    socket.join(roomId);
    socket.emit('roomJoined', { id: roomId });
  });

  // Handle joining a room
  socket.on('join-room', (roomName, username) => {
    try {
      if (!rooms.has(roomName)) {
        rooms.set(roomName, {
          users: new Map(),
          isPrivate: false,
          password: null
        });
      }

      const room = rooms.get(roomName);
      room.users.set(socket.id, username);
      socket.join(roomName);

      io.to(roomName).emit('user-connected', username);
      console.log(`${username} joined ${roomName}`);
      socket.emit('current-users', Array.from(room.users.values()));
    } catch (err) {
      console.error('Join error:', err);
      socket.emit('room-error', 'Failed to join room');
    }
  });

  // WebRTC signaling
  socket.on('signal', (data) => {
    io.to(data.to).emit('signal', {
      from: socket.id,
      signal: data.signal
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    rooms.forEach((room, roomName) => {
      if (room.users instanceof Map && room.users.has(socket.id)) {
        const username = room.users.get(socket.id);
        room.users.delete(socket.id);
        io.to(roomName).emit('user-disconnected', username);
        console.log(`${username} left ${roomName}`);

        if (room.users.size === 0) {
          rooms.delete(roomName);
        }
      } else if (Array.isArray(room.users)) {
        room.users = room.users.filter(id => id !== socket.id);
        if (room.users.length === 0) {
          rooms.delete(roomName);
        }
      }
    });
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
