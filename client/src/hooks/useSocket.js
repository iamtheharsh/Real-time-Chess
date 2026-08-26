import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

// Creates ONE socket connection per component mount, and cleans it up on unmount.
// The token is passed in the handshake so the server can authenticate the socket.
export function useSocket() {
  const socketRef = useRef(null);

  if (!socketRef.current) {
    const token = localStorage.getItem("chess_token");
    socketRef.current = io("/", {
      // "/" connects to same origin — Vite proxy forwards /socket.io → localhost:3001
      auth: { token },
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
  }

  useEffect(() => {
    // Cleanup: disconnect when the component using this hook unmounts
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  return socketRef.current;
}
