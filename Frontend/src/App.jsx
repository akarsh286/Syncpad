

import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { okaidia } from '@uiw/codemirror-theme-okaidia';
import './App.css';

const socket = io.connect("http://localhost:5000");

function App() {
  const [code, setCode] = useState("console.log('hello world!');");

  const onChange = (value) => {
    setCode(value);
    socket.emit("code_change", value); // Send code to server on change
  };
  
  useEffect(() => {
    // Listen for code changes from the server
    socket.on("receive_code", (data) => {
      setCode(data); // Update the editor with the new code
    });

    // Clean up the listener when the component unmounts
    return () => {
      socket.off("receive_code");
    };
  }, [socket]);

  return (
    <CodeMirror
      value={code}
      height="100vh"
      theme={okaidia}
      extensions={[javascript({ jsx: true })]}
      onChange={onChange}
    />
  );
}

export default App;