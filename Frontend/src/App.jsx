import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { okaidia } from '@uiw/codemirror-theme-okaidia';
import { githubLight } from '@uiw/codemirror-theme-github';
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { FaPlay, FaSyncAlt, FaSave, FaCopy, FaPlus, FaSignInAlt, FaSun, FaMoon, FaMicrophone, FaMicrophoneSlash } from 'react-icons/fa';
import './App.css';
import { nanoid } from 'nanoid';

// --- Theme Toggle Component ---
const ThemeToggle = ({ theme, setTheme }) => {
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  return (
    <button onClick={toggleTheme} className="p-2 rounded-full bg-white/10 hover:bg-white/20 dark:bg-black/20 dark:hover:bg-black/30 transition-colors">
      {theme === 'dark' ? <FaSun className="text-yellow-300" /> : <FaMoon className="text-purple-400" />}
    </button>
  );
};


// --- Components for different pages ---

const HomePage = () => {
  const [roomId, setRoomId] = useState('');
  const [joining, setJoining] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Force dark theme for the homepage
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
    setLoaded(true);
  }, []);

  const createNewRoom = (e) => {
    e.preventDefault();
    const id = nanoid(6);
    window.location.href = `/editor/${id}`;
  };
  
  const joinRoom = async () => {
    if (roomId) {
      setJoining(true);
      try {
        const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
        const response = await axios.get(`${API_URL}/api/room/${roomId}`);
        
        if (response.data.exists) {
          window.location.href = `/editor/${roomId}`;
        } else {
          alert("Invalid Room ID. This room does not exist or is empty.");
        }
      } catch (error) {
        console.error("Error checking room:", error);
        alert("Could not connect to the server to verify the Room ID. Please try again.");
      } finally {
        setJoining(false);
      }
    } else {
      alert("Please enter a Room ID.");
    }
  };

  return (
    <div className="flex items-center justify-center h-screen text-white overflow-hidden">
       <div className={`p-10 rounded-2xl shadow-2xl w-full max-w-lg mx-4 text-center transition-all duration-700 ease-out ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} bg-black/30 backdrop-blur-xl border border-white/10`}>
        <h1 className={`text-8xl font-extrabold mb-4 transition-all duration-700 ease-out delay-100 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            SyncPad
          </span>
        </h1>
        <p className={`mb-10 transition-all duration-700 ease-out delay-200 ${loaded ? 'opacity-100' : 'opacity-0'} text-gray-400`}>
          Collaborate in real-time. Code with anyone, anywhere.
        </p>
        <div className={`flex flex-col space-y-5 transition-all duration-700 ease-out delay-300 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <button 
            onClick={createNewRoom} 
            className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-blue-600/30 transition-all transform hover:scale-105"
          >
            <FaPlus className="mr-2"/> Create a New Room
          </button>
          <div className="flex items-center pt-4">
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Enter Room ID to Join"
              className="p-3 rounded-l-xl focus:outline-none focus:ring-2 flex-grow border transition-all bg-white/5 text-white focus:ring-purple-500 border-transparent focus:border-purple-500"
              onKeyUp={(e) => e.key === 'Enter' && joinRoom()}
            />
            <button 
              onClick={joinRoom} 
              disabled={joining} 
              className="flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-r-xl transition-colors disabled:bg-gray-500"
            >
              <FaSignInAlt className="mr-2"/> {joining ? 'Joining...' : 'Join'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const EditorPage = ({ roomId, theme, setTheme }) => {
  const [socket, setSocket] = useState(null);
  const [socketId, setSocketId] = useState('');
  const [code, setCode] = useState("console.log('Welcome to your SyncPad room!');");
  const [language, setLanguage] = useState("javascript");
  const [output, setOutput] = useState("Click 'Run' to see your code's output here.");
  const [isLoading, setIsLoading] = useState(false);
  const [clients, setClients] = useState([]);
  const [copyText, setCopyText] = useState('Copy');
  
  // --- Voice Chat State ---
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [isMuted, setIsMuted] = useState(true);
  const peerConnections = useRef({});

  useEffect(() => {
    const s = io.connect(import.meta.env.VITE_BACKEND_URL || "http://localhost:5000");
    setSocket(s);
    s.on('connect', () => { setSocketId(s.id); });
    s.emit("join_room", roomId);
    s.on("receive_code", (data) => { setCode(data); });
    s.on("room_update", (connectedClients) => {
        setClients(connectedClients);
        // If voice chat is active, create connections for new users
        if (localStream) {
            const newClients = connectedClients.filter(client => client.id !== s.id && !peerConnections.current[client.id]);
            newClients.forEach(client => {
                createPeerConnection(client.id, localStream, true, s);
            });
        }
    });

    // --- WebRTC Signaling Listeners ---
    s.on('webrtc_offer', (data) => handleOffer(data, s));
    s.on('webrtc_answer', handleAnswer);
    s.on('webrtc_ice_candidate', handleIceCandidate);

    return () => {
      localStream?.getTracks().forEach(track => track.stop());
      Object.values(peerConnections.current).forEach(pc => pc.close());
      s.disconnect();
    };
  }, [roomId, localStream]);

  // --- WebRTC Logic ---
  const startVoiceChat = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLocalStream(stream);
      setIsMuted(false);
      
      const otherUsers = clients.filter(client => client.id !== socketId);
      otherUsers.forEach(user => {
        createPeerConnection(user.id, stream, true, socket);
      });

    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const createPeerConnection = (remoteSocketId, stream, isInitiator, socketInstance) => {
    if (peerConnections.current[remoteSocketId]) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.onicecandidate = event => {
      if (event.candidate && socketInstance) {
        socketInstance.emit('webrtc_ice_candidate', { to: remoteSocketId, candidate: event.candidate });
      }
    };

    pc.ontrack = event => {
      setRemoteStreams(prev => ({ ...prev, [remoteSocketId]: event.streams[0] }));
    };

    if (isInitiator && socketInstance) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          socketInstance.emit('webrtc_offer', { to: remoteSocketId, sdp: pc.localDescription });
        });
    }
    
    peerConnections.current[remoteSocketId] = pc;
  };
  
  const handleOffer = ({ sdp, from }, socketInstance) => {
    if (localStream) {
        createPeerConnection(from, localStream, false, socketInstance);
        const pc = peerConnections.current[from];
        if (pc) {
          pc.setRemoteDescription(new RTCSessionDescription(sdp))
          .then(() => pc.createAnswer())
          .then(answer => pc.setLocalDescription(answer))
          .then(() => {
              if (socketInstance) {
                  socketInstance.emit('webrtc_answer', { to: from, sdp: pc.localDescription });
              }
          });
        }
    }
  };
  
  const handleAnswer = ({ sdp, from }) => {
    const pc = peerConnections.current[from];
    if (pc) {
      pc.setRemoteDescription(new RTCSessionDescription(sdp));
    }
  };

  const handleIceCandidate = ({ candidate, from }) => {
    const pc = peerConnections.current[from];
    if (pc && candidate) {
      pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };

  const toggleMute = () => {
    if(localStream){
        localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled;
        setIsMuted(!localStream.getAudioTracks()[0].enabled);
    }
  };

  const otherClients = clients.filter(client => client && client.id !== socketId);
  
  const onChange = (value) => {
    setCode(value);
    if (socket) {
      socket.emit("code_change", { room: roomId, code: value });
    }
  };

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopyText('Copied!');
    setTimeout(() => { setCopyText('Copy'); }, 2000);
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
    <div className={`flex flex-col h-screen font-sans ${theme === 'light' ? 'bg-gray-100 text-slate-800' : 'text-gray-100'}`}>
      <header className={`flex items-center justify-between p-3 shadow-lg border-b z-20 flex-shrink-0 ${theme === 'dark' ? 'bg-black/30 backdrop-blur-lg border-white/10' : 'bg-white/70 backdrop-blur-lg border-gray-200'}`}>
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">SyncPad</h1>
        <div className="flex items-center space-x-4">
            <ThemeToggle theme={theme} setTheme={setTheme} />
             {/* Voice Chat Controls */}
            <div className="flex items-center space-x-2">
                {!localStream ? (
                <button onClick={startVoiceChat} title="Start Voice Chat" className="flex items-center p-2 rounded-full bg-green-500/20 text-green-400 hover:bg-green-500/40 transition-colors">
                    <FaMicrophone />
                </button>
                ) : (
                <button onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"} className={`flex items-center p-2 rounded-full transition-colors ${isMuted ? 'bg-red-500/20 text-red-400 hover:bg-red-500/40' : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/40'}`}>
                    {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
                </button>
                )}
            </div>
            <div className={`hidden sm:flex items-center space-x-2 p-1 pr-2 rounded-lg border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-200 border-gray-300'}`}>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Room ID:</p>
              <span className={`font-mono py-0.5 px-2 rounded ${theme === 'dark' ? 'text-white bg-gray-700' : 'text-slate-800 bg-gray-300'}`}>{roomId}</span>
              <button onClick={handleCopyRoomId} title="Copy Room ID" className={`flex items-center transition-colors ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-black'}`}>
                <FaCopy className="mr-1.5"/> {copyText}
              </button>
            </div>
            <div className="flex -space-x-3">
              {otherClients.map((client) => (
                client && <div
                  key={client.id}
                  title={client.username}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold border-2 ${theme === 'dark' ? 'border-black/50' : 'border-white/50'}`}
                  style={{ backgroundColor: client.color }}
                >
                  {client.username.substring(0, 1)}
                </div>
              ))}
            </div>
            <img src="https://avatars.githubusercontent.com/u/102924133?v=4" alt="User Avatar" className="w-9 h-9 rounded-full border-2 border-purple-500" />
        </div>
      </header>
      
      <div className={`flex items-center justify-between p-2 border-b z-10 flex-shrink-0 ${theme === 'dark' ? 'bg-black/20 backdrop-blur-lg border-white/10' : 'bg-white/50 backdrop-blur-lg border-gray-200'}`}>
        <div className="flex items-center space-x-3">
          <label htmlFor="language-select" className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Language:</label>
          <select id="language-select" value={language} onChange={(e) => setLanguage(e.target.value)} className={`border rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-200 border-gray-300'}`}>
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="cpp">C++</option>
          </select>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={handleSave} className={`flex items-center font-semibold py-1.5 px-4 rounded-md shadow-md transition-all duration-200 ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-200 hover:bg-gray-300 text-slate-800'}`}>
            <FaSave className="mr-2" /> Save
          </button>
          <button onClick={handleRun} disabled={isLoading} className="flex items-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 px-4 rounded-md shadow-lg shadow-blue-600/30 transform hover:scale-105 transition-all duration-200 disabled:bg-gray-600 disabled:shadow-none disabled:cursor-not-allowed">
            {isLoading ? (<FaSyncAlt className="animate-spin mr-2" />) : (<FaPlay className="mr-2" />)}
            {isLoading ? "Running..." : "Run"}
          </button>
        </div>
      </div>
      <div className={`flex-1 min-h-0 p-4 ${theme === 'dark' ? 'bg-black/30' : ''}`}>
        <PanelGroup direction="vertical" className={`h-full rounded-lg overflow-hidden shadow-2xl border ${theme === 'dark' ? 'border-white/10' : 'border-gray-300'}`}>
          <Panel><CodeMirror value={code} height="100%" theme={theme === 'dark' ? okaidia : githubLight} extensions={[javascript({ jsx: true })]} onChange={onChange} className="h-full" /></Panel>
          <PanelResizeHandle className={`h-2 hover:bg-blue-600 transition-colors duration-200 cursor-row-resize flex items-center justify-center ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-200'}`}>
              <div className={`w-8 h-1 rounded-full ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-400'}`} />
          </PanelResizeHandle>
          <Panel defaultSize={20} minSize={10}>
            <div className={`h-full p-4 overflow-auto font-mono text-sm ${theme === 'dark' ? 'bg-black/30' : 'bg-white'}`}>
              <h2 className={`text-md font-semibold mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Output:</h2>
              <pre className={theme === 'dark' ? 'text-gray-200' : 'text-slate-800'}>{output}</pre>
            </div>
          </Panel>
        </PanelGroup>
      </div>

      {/* --- Audio elements to play remote streams --- */}
      {Object.entries(remoteStreams).map(([socketId, stream]) => (
        <audio key={socketId} autoPlay ref={audio => { if (audio) audio.srcObject = stream; }} />
      ))}
    </div>
  );
};

// --- Main App Component ---
function App() {
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);
  
  const path = window.location.pathname;
  
  if (path.startsWith('/editor/')) {
    const roomId = path.split('/editor/')[1];
    return <EditorPage roomId={roomId} theme={theme} setTheme={setTheme} />;
  }

  return <HomePage />;
}

export default App;
