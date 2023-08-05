const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: process.env.PORT });

const connections = new Set();

wss.on('connection', (ws) => {
	console.log('New client connected.');

	// Add the new connection to the set
	connections.add(ws);

	ws.on('message', (message) => {
		try {
			const parsedMessage = JSON.parse(message);
			console.log(parsedMessage);
			broadcastMessage(parsedMessage);
		} catch (error) {
			console.error('Error parsing incoming message:', error);
		}
	});

	ws.on('close', () => {
		console.log('Client disconnected.');
		// Remove the connection from the set when a client disconnects
		connections.delete(ws);
	});
});

const broadcastMessage = (message) => {
	connections.forEach((ws) => {
		if (ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(message));
		}
	});
};

// Enable CORS for all origins
wss.on('headers', (headers) => {
	headers.push('Access-Control-Allow-Origin: *');
	headers.push('Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept');
});
