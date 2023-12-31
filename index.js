const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

const rooms = new Map();
const userMap = new Map(); // New data structure to map userId to ws

function addClientToRoom(roomId, userId, ws) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  rooms.get(roomId).add(userId);
  userMap.set(userId, ws); // Map userId to ws
}

function removeFromRoom(roomId, userId) {
  const room = rooms.get(roomId);
  if (room) {
    room.delete(userId);
    if (room.size === 0) {
      rooms.delete(roomId);
    }
  }
  userMap.delete(userId); // Remove the user from the userMap
}

function getClientsInRoom(roomId) {
  return rooms.get(roomId) || new Set();
}

const connections = new Set();

wss.on("connection", (ws) => {
  console.log("New client connected.");

  let userId; // Variable to store the userId

  ws.on("message", (message) => {
    try {
      const parsedMessage = JSON.parse(message);
      console.log(parsedMessage);
      if (parsedMessage.command === "createRoom") {
        const roomId = parsedMessage.roomId;
        userId = parsedMessage.userId; // Store the userId from the client
        if (!rooms.has(roomId)) {
          addClientToRoom(roomId, userId, ws); // Pass userId to addClientToRoom
          console.log(`Client joined room: ${roomId}`);
          notifyRoomUpdate(roomId, rooms.get(roomId));
        } else {
          addClientToRoom(roomId, userId, ws); // Pass userId to addClientToRoom
          notifyRoomUpdate(roomId, rooms.get(roomId));
          console.log(`Room already exists: ${roomId}`);
          console.log(`Adding client to room: ${roomId}`);
        }
      } else if (parsedMessage.command === "deleteRoom") {
        const roomId = parsedMessage.roomId;
        if (rooms.has(roomId)) {
          removeFromRoom(roomId, userId); // Pass userId to removeFromRoom
          console.log(`Room deleted: ${roomId}`);
          notifyRoomUpdate(roomId, new Set()); // Notify all participants that the room is deleted
        }
      } else {
        parsedMessage.userId = userId; // Attach the userId to the message
        const targetUserId = parsedMessage.targetUserId; // Extract the target userId from the message
        broadcastMessage(parsedMessage, ws, targetUserId);
      }
    } catch (error) {
      console.error("Error parsing incoming message:", error);
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected.");
    // Remove the connection from all rooms it belongs to
    rooms.forEach((room, roomId) => {
      if (room.has(userId)) {
        // Use userId to check membership in the room
        removeFromRoom(roomId, userId); // Pass userId to removeFromRoom
        notifyRoomUpdate(roomId, rooms.get(roomId));
      }
    });

    // Remove the connection from the global set of connections
    connections.delete(ws);
  });
});

const broadcastMessage = (message, sender, targetUserId) => {
  const roomId = message.roomId;
  if (roomId) {
    const clientsInRoom = getClientsInRoom(roomId);
    clientsInRoom.forEach((userId) => {
      // Iterate through userIds in the room
      const ws = userMap.get(userId); // Get the ws using the userId
      if (
        (!targetUserId || userId === targetUserId) &&
        ws !== sender &&
        ws.readyState === WebSocket.OPEN
      ) {
        // Send the message to the target userId's WebSocket connection
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
  clientsInRoom.forEach((userId) => {
    // Iterate through userIds in the room
    const ws = userMap.get(userId); // Get the ws using the userId
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
