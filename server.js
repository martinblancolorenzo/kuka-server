const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const wss  = new WebSocket.Server({ port: PORT });
const rooms = new Map();

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

wss.on('connection', (ws) => {
  ws.roomCode    = null;
  ws.playerIndex = null;

  ws.on('message', (data) => {
    try {
      handleMessage(ws, JSON.parse(data));
    } catch (e) {
      console.error('Fehler:', e);
    }
  });

  ws.on('close', () => {
    if (!ws.roomCode || !rooms.has(ws.roomCode)) return;
    const room  = rooms.get(ws.roomCode);
    const other = room.players.find(p => p !== ws);
    if (other && other.readyState === WebSocket.OPEN) {
      other.send(JSON.stringify({ type: 'opponent_disconnected' }));
    }
    rooms.delete(ws.roomCode);
    console.log('Room', ws.roomCode, 'geschlossen');
  });
});

function handleMessage(ws, msg) {
  switch (msg.type) {

    case 'create_room': {
      const code = generateCode();
      rooms.set(code, { players: [ws] });
      ws.roomCode    = code;
      ws.playerIndex = 0;
      ws.send(JSON.stringify({ type: 'room_created', code, player_index: 0 }));
      console.log('Room erstellt:', code);
      break;
    }

    case 'join_room': {
      const code = (msg.code || '').toUpperCase();
      if (!rooms.has(code)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Raum nicht gefunden' }));
        return;
      }
      const room = rooms.get(code);
      if (room.players.length >= 2) {
        ws.send(JSON.stringify({ type: 'error', message: 'Raum voll' }));
        return;
      }
      room.players.push(ws);
      ws.roomCode    = code;
      ws.playerIndex = 1;
      ws.send(JSON.stringify({ type: 'room_joined', code, player_index: 1 }));
      room.players[0].send(JSON.stringify({ type: 'opponent_joined' }));
      console.log('Room', code, 'voll — Spiel kann starten');
      break;
    }

    default: {
      // Alles andere wird zum anderen Spieler weitergeleitet
      if (!ws.roomCode || !rooms.has(ws.roomCode)) return;
      const room  = rooms.get(ws.roomCode);
      const other = room.players.find(p => p !== ws);
      if (other && other.readyState === WebSocket.OPEN) {
        other.send(JSON.stringify({ ...msg, from: ws.playerIndex }));
      }
    }
  }
}

console.log('Server läuft auf Port', PORT);
