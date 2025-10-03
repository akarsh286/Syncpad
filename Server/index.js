const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// This allows us to use environment variables
require('dotenv').config();

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL, // Use the environment variable
    methods: ["GET", "POST"],
  },
});

io.on('connection', (socket) => {
  console.log(`User Connected: ${socket.id}`);

  socket.on("code_change", (data) => {
    socket.broadcast.emit("receive_code", data);
  });

  socket.on('disconnect', () => {
    console.log('User Disconnected', socket.id);
  });
});

// Render provides a PORT environment variable. We must use it.
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});