import { Server } from "socket.io";

let io;

export default function handler(req, res) {
  if (!res.socket.server.io) {
    io = new Server(res.socket.server, {
      path: "/api/socket",
      addTrailingSlash: false
    });

    io.on("connection", (socket) => {
      socket.on("join", (room) => {
        socket.join(room);
        socket.to(room).emit("peer-joined");
      });

      socket.on("signal", ({ room, data }) => {
        socket.to(room).emit("signal", data);
      });
    });

    res.socket.server.io = io;
  }
  res.end();
}
