import { Server } from "socket.io";

let io;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*", // allow all or use specific origins
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    console.log(`[Socket] User connected: ${socket.id}`);

    // Join a specific room (bookingCode or supportId)
    socket.on("join_room", (roomId) => {
      socket.join(roomId);
      console.log(`[Socket] Socket ${socket.id} joined room ${roomId}`);
    });

    // Leave room
    socket.on("leave_room", (roomId) => {
      socket.leave(roomId);
      console.log(`[Socket] Socket ${socket.id} left room ${roomId}`);
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] User disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};
