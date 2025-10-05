const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const LANGUAGE_IDS = { javascript: 93, python: 71, cpp: 54 };
const userMapping = {};
const userColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FED766', '#2AB7CA'];

function getClientsInRoom(roomId) {
  const clients = [];
  const room = io.sockets.adapter.rooms.get(roomId);
  if (room) {
    for (const clientId of room) {
      if(userMapping[clientId]) clients.push(userMapping[clientId]);
    }
  }
  return clients;
}

app.get("/api/room/:roomId", (req, res) => {
  const { roomId } = req.params;
  const room = io.sockets.adapter.rooms.get(roomId);
  if (room && room.size > 0) res.json({ exists: true });
  else res.json({ exists: false });
});

app.post("/api/run", async (req, res) => {
  // Your Judge0 logic remains the same...
  const { language, code } = req.body;
  // ... (rest of the run logic) ...
});

io.on('connection', (socket) => {
  console.log(`User Connected: ${socket.id}`);

  socket.on("join_room", (roomId) => {
    socket.join(roomId);
    userMapping[socket.id] = {
      id: socket.id,
      username: `User${Math.floor(Math.random() * 1000)}`,
      color: userColors[Math.floor(Math.random() * userColors.length)]
    };
    const clients = getClientsInRoom(roomId);
    io.to(roomId).emit("room_update", clients);
  });

  socket.on("code_change", (data) => {
    socket.to(data.room).emit("receive_code", data.code);
  });
  
  // --- WebRTC Signaling Logic ---
  socket.on('webrtc_offer', (data) => {
    socket.to(data.to).emit('webrtc_offer', { sdp: data.sdp, from: socket.id });
  });

  socket.on('webrtc_answer', (data) => {
    socket.to(data.to).emit('webrtc_answer', { sdp: data.sdp, from: socket.id });
  });

  socket.on('webrtc_ice_candidate', (data) => {
    socket.to(data.to).emit('webrtc_ice_candidate', { candidate: data.candidate, from: socket.id });
  });
  // --- End of WebRTC Signaling ---

  socket.on('disconnecting', () => {
    const rooms = Array.from(socket.rooms);
    rooms.forEach((roomId) => {
      if (roomId !== socket.id) {
          const clients = getClientsInRoom(roomId).filter(client => client && client.id !== socket.id);
          socket.to(roomId).emit("room_update", clients);
      }
    });
  });

  socket.on('disconnect', () => {
    delete userMapping[socket.id];
    console.log('User Disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
