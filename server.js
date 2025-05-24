const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

// CORS configuration
app.use(cors({
  origin: "https://zoromeet.vercel.app", // Your Vercel frontend URL
  credentials: true
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://zoromeet.vercel.app", // Must match your frontend URL
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Track rooms and users
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle joining a room
  socket.on('join-room', (roomName, username) => {
    try {
      // Create room if it doesn't exist
      if (!rooms.has(roomName)) {
        rooms.set(roomName, {
          users: new Map(),
          isPrivate: false,
          password: null
        });
      }

      const room = rooms.get(roomName);

      // Add user to room
      room.users.set(socket.id, username);
      socket.join(roomName);

      // Notify room
      io.to(roomName).emit('user-connected', username);
      console.log(`${username} joined ${roomName}`);

      // Send current room users to the new user
      socket.emit('current-users', Array.from(room.users.values()));

    } catch (err) {
      console.error('Join error:', err);
      socket.emit('room-error', 'Failed to join room');
    }
  });

  // Handle WebRTC signaling
  socket.on('signal', (data) => {
    io.to(data.to).emit('signal', {
      from: socket.id,
      signal: data.signal
    });
  });

  // Handle disconnections
  socket.on('disconnect', () => {
    rooms.forEach((room, roomName) => {
      if (room.users.has(socket.id)) {
        const username = room.users.get(socket.id);
        room.users.delete(socket.id);
        io.to(roomName).emit('user-disconnected', username);
        console.log(`${username} left ${roomName}`);

        // Clean up empty rooms
        if (room.users.size === 0) {
          rooms.delete(roomName);
        }
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});