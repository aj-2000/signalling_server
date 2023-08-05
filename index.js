const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

const rooms = new Map();

function addClientToRoom(roomId, ws) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  rooms.get(roomId).add(ws);
}

function removeFromRoom(roomId, ws) {
  const room = rooms.get(roomId);
  if (room) {
    room.delete(ws);
    if (room.size === 0) {
      rooms.delete(roomId);
    }
  }
}

function getClientsInRoom(roomId) {
  return rooms.get(roomId) || new Set();
}

const connections = new Set();

wss.on("connection", (ws) => {
  console.log("New client connected.");

  ws.on("message", (message) => {
    try {
      const parsedMessage = JSON.parse(message);

      if (parsedMessage.command === "createRoom") {
        const roomId = parsedMessage.roomId;
        if (!rooms.has(roomId)) {
          addClientToRoom(roomId, ws);
          console.log(`Client joined room: ${roomId}`);
          notifyRoomUpdate(roomId, rooms.get(roomId));
        } else {
          addClientToRoom(roomId, ws);
          notifyRoomUpdate(roomId, rooms.get(roomId));
          console.log(`Room already exists: ${roomId}`);
          console.log(`Adding client to room: ${roomId}`);
        }
      } else if (parsedMessage.command === "deleteRoom") {
        const roomId = parsedMessage.roomId;
        if (rooms.has(roomId)) {
          rooms.delete(roomId);
          console.log(`Room deleted: ${roomId}`);
          notifyRoomUpdate(roomId, new Set()); // Notify all participants that the room is deleted
        }
      } else {
        broadcastMessage(parsedMessage, ws);
      }
    } catch (error) {
      console.error("Error parsing incoming message:", error);
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected.");
    // Remove the connection from all rooms it belongs to
    rooms.forEach((room, roomId) => {
      if (room.has(ws)) {
        removeFromRoom(roomId, ws);
        notifyRoomUpdate(roomId, rooms.get(roomId));
      }
    });

    // Remove the connection from the global set of connections
    connections.delete(ws);
  });
});

const broadcastMessage = (message, sender) => {
  const roomId = message.roomId;
  if (roomId) {
    const clientsInRoom = getClientsInRoom(roomId);
    clientsInRoom.forEach((ws) => {
      if (ws !== sender && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }
};

const notifyRoomUpdate = (roomId, participants) => {
  const participantsArray = Array.from(participants || []);
  const updateMessage = JSON.stringify({
    command: "roomUpdate",
    roomId,
    participants: participantsArray,
  });

  const clientsInRoom = getClientsInRoom(roomId);
  clientsInRoom.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(updateMessage);
    }
  });
};

// Enable CORS for all origins
wss.on("headers", (headers) => {
  headers.push("Access-Control-Allow-Origin: *");
  headers.push(
    "Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept"
  );
});
