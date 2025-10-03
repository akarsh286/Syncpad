const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Your React app's address
    methods: ["GET", "POST"],
  },
});

// ... (keep all the existing setup code)

io.on('connection', (socket) => {
  console.log(`User Connected: ${socket.id}`);

  // Listen for code changes from a client
  socket.on("code_change", (data) => {
    // Broadcast the changes to all OTHER clients
    socket.broadcast.emit("receive_code", data);
  });

  socket.on('disconnect', () => {
    console.log('User Disconnected', socket.id);
  });
});

// ... (keep the server.listen code)

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});