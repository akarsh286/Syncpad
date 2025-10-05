import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { okaidia } from '@uiw/codemirror-theme-okaidia';
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { FaPlay, FaSyncAlt, FaSave } from 'react-icons/fa';
import './App.css';
import { nanoid } from 'nanoid'; // <-- Import nanoid instead of uuid

// --- Components for different pages ---

// HomePage Component: Create or Join a Room
const HomePage = () => {
  const [roomId, setRoomId] = useState('');

  const createNewRoom = (e) => {
    e.preventDefault();
    const id = nanoid(6); // <-- Generate a short 6-character ID
    window.location.href = `/editor/${id}`;
  };
  
  const joinRoom = () => {
    if (roomId) {
      window.location.href = `/editor/${roomId}`;
    } else {
      alert("Please enter a Room ID.");
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
      <div className="p-8 bg-gray-800 rounded-lg shadow-xl text-center">
        <h1 className="text-4xl font-bold text-blue-400 mb-4">SyncPad</h1>
        <p className="text-gray-400 mb-6">Real-time collaborative code editor.</p>
        <div className="flex flex-col space-y-4">
          <button onClick={createNewRoom} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            Create a New Room
          </button>
          <div className="flex items-center">
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Enter Room ID"
              className="bg-gray-700 text-white p-2 rounded-l-md focus:outline-none flex-grow"
            />
            <button onClick={joinRoom} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-r-md">
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// EditorPage Component: The main editor UI
const EditorPage = ({ roomId }) => {
  const [socket, setSocket] = useState(null);
  const [code, setCode] = useState("console.log('Welcome to SyncPad!');");
  const [language, setLanguage] = useState("javascript");
  const [output, setOutput] = useState("Click 'Run' to see your code's output here.");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const s = io.connect(import.meta.env.VITE_BACKEND_URL || "http://localhost:5000");
    setSocket(s);

    s.emit("join_room", roomId);

    s.on("receive_code", (data) => {
      setCode(data);
    });

    return () => {
      s.disconnect();
    };
  }, [roomId]);

  const onChange = (value) => {
    setCode(value);
    if (socket) {
      socket.emit("code_change", { room: roomId, code: value });
    }
  };
  
  const handleRun = async () => {
    setIsLoading(true);
    setOutput("Running code...");
    try {
      const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
      const response = await axios.post(`${API_URL}/api/run`, { language, code });
      setOutput(response.data.output);
    } catch (error) {
      setOutput(error.response?.data?.output || "Failed to run code.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = () => {
    const fileExtensions = { javascript: 'js', python: 'py', cpp: 'cpp' };
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const extension = fileExtensions[language] || 'txt';
    link.download = `code.${extension}`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100 font-sans">
      <header className="flex items-center justify-between bg-gray-950 p-3 shadow-lg border-b border-gray-800 z-20 flex-shrink-0">
        <h1 className="text-xl font-bold text-blue-400">SyncPad</h1>
        <div className="flex items-center space-x-2">
          <p className="text-sm text-gray-400 hidden sm:block">Room ID: <span className="font-mono bg-gray-700 p-1 rounded">{roomId}</span></p>
          <img src="https://avatars.githubusercontent.com/u/102924133?v=4" alt="User Avatar" className="w-9 h-9 rounded-full border-2 border-blue-500" />
        </div>
      </header>
      <div className="flex items-center justify-between p-2 bg-gray-800 shadow-md border-b border-gray-700 z-10 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <label htmlFor="language-select" className="text-gray-300 text-sm">Language:</label>
          <select id="language-select" value={language} onChange={(e) => setLanguage(e.target.value)} className="bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors">
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="cpp">C++</option>
          </select>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={handleSave} className="flex items-center bg-gray-600 hover:bg-gray-700 text-white font-semibold py-1.5 px-4 rounded-md shadow-md transform hover:scale-105 transition-all duration-200">
            <FaSave className="mr-2" /> Save
          </button>
          <button onClick={handleRun} disabled={isLoading} className="flex items-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 px-4 rounded-md shadow-md transform hover:scale-105 transition-all duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed">
            {isLoading ? (<FaSyncAlt className="animate-spin mr-2" />) : (<FaPlay className="mr-2" />)}
            {isLoading ? "Running..." : "Run"}
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <PanelGroup direction="vertical" className="h-full">
          <Panel><CodeMirror value={code} height="100%" theme={okaidia} extensions={[javascript({ jsx: true })]} onChange={onChange} className="h-full" /></Panel>
          <PanelResizeHandle className="h-2 bg-gray-800 hover:bg-blue-600 transition-colors duration-200 cursor-row-resize flex items-center justify-center"><div className="w-8 h-1 bg-gray-600 rounded-full" /></PanelResizeHandle>
          <Panel defaultSize={20} minSize={10}>
            <div className="h-full bg-[#1e1e1e] p-4 overflow-auto font-mono text-sm">
              <h2 className="text-md font-semibold mb-2 text-gray-400">Output:</h2>
              <pre className="text-gray-200 whitespace-pre-wrap">{output}</pre>
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
};

// Main App Component: Acts as a Router
function App() {
  const path = window.location.pathname;
  
  if (path.startsWith('/editor/')) {
    const roomId = path.split('/')[2];
    return <EditorPage roomId={roomId} />;
  }

  return <HomePage />;
}

export default App;

