const { WebSocketServer } = require('ws');

let wss;

// Client gui {"type":"subscribe","deviceIds":["esp32_01"]} de chi nhan du lieu cua cac thiet bi do.
function initWs(server) {
  wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (socket) => {
    socket.deviceIds = new Set();
    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'subscribe' && Array.isArray(msg.deviceIds)) {
          socket.deviceIds = new Set(msg.deviceIds);
          socket.send(JSON.stringify({ type: 'SUBSCRIBED', deviceIds: msg.deviceIds }));
        }
      } catch {
        socket.send(JSON.stringify({ type: 'ERROR', message: 'JSON khong hop le' }));
      }
    });
  });
}

function broadcast(deviceId, type, data) {
  if (!wss) return;
  const msg = JSON.stringify({ type, deviceId, data });
  for (const socket of wss.clients) {
    if (socket.readyState === 1 && socket.deviceIds.has(deviceId)) socket.send(msg);
  }
}

module.exports = { initWs, broadcast };
