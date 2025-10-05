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

const LANGUAGE_IDS = {
  javascript: 93,
  python: 71,
  cpp: 54,
};

app.post("/api/run", async (req, res) => {
  const { language, code } = req.body;
  if (!LANGUAGE_IDS[language]) {
    return res.status(400).json({ output: "Unsupported language." });
  }
  const options = {
    method: 'POST',
    url: 'https://judge0-ce.p.rapidapi.com/submissions',
    params: { base64_encoded: 'false', wait: 'true' },
    headers: {
      'content-type': 'application/json',
      'X-RapidAPI-Key': process.env.JUDGE0_API_KEY,
      'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
    },
    data: { language_id: LANGUAGE_IDS[language], source_code: code }
  };
  try {
    const response = await axios.request(options);
    const result = response.data;
    let output = '';
    if (result.stdout) output = result.stdout;
    else if (result.stderr) output = `Error:\n${result.stderr}`;
    else if (result.compile_output) output = `Compilation Error:\n${result.compile_output}`;
    else if (result.message) output = `Error:\n${result.message}`;
    else output = "Execution finished with no output.";
    res.json({ output });
  } catch (error) {
    console.error(error.response ? error.response.data : error.message);
    const errorMessage = error.response?.data?.message || "An error occurred while communicating with the compiler service.";
    res.status(500).json({ output: errorMessage });
  }
});

io.on('connection', (socket) => {
  console.log(`User Connected: ${socket.id}`);

  // --- ROOM LOGIC ---
  socket.on("join_room", (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  socket.on("code_change", (data) => {
    // Broadcast to the specific room
    socket.to(data.room).emit("receive_code", data.code);
  });

  socket.on('disconnect', () => {
    console.log('User Disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});