"use client";

import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const socket = io({ path: "/api/socket" });

export default function Home() {
  const [room, setRoom] = useState("");
  const [joined, setJoined] = useState(false);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const peerConnection = useRef();
  const dataChannel = useRef();

  /* ---------- WebRTC setup ---------- */
  useEffect(() => {
    fetch("/api/socket");

    socket.on("peer-joined", async () => {
      if (!peerConnection.current?.localDescription) createOffer();
    });

    socket.on("signal", async (data) => {
      if (data.type === "offer" && !peerConnection.current?.remoteDescription) {
        await peerConnection.current.setRemoteDescription(data);
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        socket.emit("signal", { room, data: answer });
      } else if (data.type === "answer" && !peerConnection.current?.remoteDescription) {
        await peerConnection.current.setRemoteDescription(data);
      } else if (data.candidate) {
        try {
          await peerConnection.current.addIceCandidate(data.candidate);
        } catch {}
      }
    });

    return () => {
      socket.off("peer-joined");
      socket.off("signal");
    };
  }, [room]);

  const joinRoom = () => {
    socket.emit("join", room);
    setJoined(true);
    setupPeer();
  };

  const setupPeer = () => {
    peerConnection.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    peerConnection.current.onicecandidate = (e) => {
      if (e.candidate) socket.emit("signal", { room, data: { candidate: e.candidate } });
    };

    dataChannel.current = peerConnection.current.createDataChannel("chat");
    setupDataChannel();

    peerConnection.current.ondatachannel = (e) => {
      dataChannel.current = e.channel;
      setupDataChannel();
    };
  };

  const setupDataChannel = () => {
    dataChannel.current.onopen = () => setConnected(true);
    dataChannel.current.onclose = () => setConnected(false);
    dataChannel.current.onmessage = (e) => {
      setMessages((m) => [...m, { from: "Peer", text: e.data }]);
    };
  };

  const createOffer = async () => {
    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    socket.emit("signal", { room, data: offer });
  };

  const sendMessage = () => {
    if (!input || !dataChannel.current || dataChannel.current.readyState !== "open") return;
    dataChannel.current.send(input);
    setMessages((m) => [...m, { from: "You", text: input }]);
    setInput("");
  };

  /* ---------- UI ---------- */
  return (
    <main className="flex flex-col items-center justify-center w-full min-h-screen bg-[#0d0d0d] text-white p-6">
      {!joined ? (
        <div className="flex flex-col items-center space-y-4 w-full max-w-sm text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-[#00ffcc] drop-shadow-[0_0_8px_#00ffcc]">
            P2P Wordle
          </h1>
          <p className="text-gray-300 text-sm">Connect with a peer and play together</p>
          <input
            className="w-full px-3 py-2 rounded border-2 border-[#00ffcc] bg-transparent text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00ffcc]"
            placeholder="Enter room name"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
          />
          <button
            onClick={joinRoom}
            className="bg-[#00ffcc] text-black font-semibold px-4 py-2 rounded w-full transition hover:bg-[#00e0b8] focus:outline-none focus:ring-2 focus:ring-[#00ffcc]"
          >
            Join Room
          </button>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row w-full max-w-7xl gap-6">
          {/* Wordle Board (3/4 width) */}
          <div className="flex-[3] flex flex-col items-center justify-center bg-[#121212] border border-[#00ffcc]/50 rounded-xl shadow-[0_0_25px_#00ffcc40] p-4">
            <h2 className="text-2xl font-bold text-[#00ffcc] mb-4 drop-shadow-[0_0_6px_#00ffcc]">
              Wordle Board
            </h2>
            <iframe
              src="https://www.nytimes.com/games/wordle/index.html"
              title="Wordle"
              className="w-full h-[75vh] border-2 border-[#00ffcc] rounded-lg"
            />
          </div>

          {/* Chat Section (1/4 width) */}
          <div className="flex-[1] flex flex-col bg-[#1a1a1a] border border-[#00ffcc]/50 rounded-xl shadow-[0_0_15px_#00ffcc30] p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold text-[#00ffcc]">Room: {room}</h2>
              <span
                className={`text-sm ${
                  connected ? "text-[#00ffcc]" : "text-gray-500"
                }`}
              >
                {connected ? "Connected ✓" : "Connecting..."}
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto border border-[#00ffcc]/30 rounded p-3 mb-3 bg-black/30 text-gray-100">
              {messages.map((m, i) => (
                <div key={i} className={`mb-2 ${m.from === "You" ? "text-right" : "text-left"}`}>
                  <p className="text-sm leading-snug">
                    <b className="text-[#00ffcc]">{m.from}:</b> {m.text}
                  </p>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="flex gap-2 mt-auto">
              <input
                className="flex-1 px-3 py-2 rounded border-2 border-[#00ffcc] bg-transparent text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00ffcc]"
                placeholder="Type a message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              />
              <button
                onClick={sendMessage}
                className="bg-[#00ffcc] text-black px-4 rounded font-semibold transition hover:bg-[#00e0b8] focus:outline-none focus:ring-2 focus:ring-[#00ffcc]"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
