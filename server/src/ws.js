const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const config = require('./config');
const User = require('./models/User');

let wss;

// So ket noi WebSocket dang mo theo tung userId (1 user co the mo nhieu tab).
const userConnections = new Map();

function readCookie(header, name) {
  const item = String(header || '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return item ? item.slice(name.length + 1) : '';
}

function readToken(req) {
  const authorization = req.headers.authorization || '';
  if (authorization.startsWith('Bearer ')) return authorization.slice(7).trim();
  try {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    if (token) return token;
  } catch {
    // Bo qua URL khong hop le; se thu cookie ben duoi.
  }
  return readCookie(req.headers.cookie, 'auth_token');
}

function sendSafe(socket, msg) {
  try {
    socket.send(msg);
  } catch (error) {
    console.error('[ws] khong gui duoc message:', error.message);
  }
}

// Gui trang thai ket noi cua user cho cac socket cua admin.
function broadcastToAdmins(type, data) {
  if (!wss) return;
  const msg = JSON.stringify({ type, data });
  for (const socket of wss.clients) {
    if (socket.readyState === 1 && socket.isAdmin) sendSafe(socket, msg);
  }
}

function isUserConnected(userId) {
  return (userConnections.get(String(userId)) || 0) > 0;
}

function addUserConnection(userId) {
  const key = String(userId);
  const next = (userConnections.get(key) || 0) + 1;
  userConnections.set(key, next);
  if (next === 1) broadcastToAdmins('USER_STATUS', { userId: key, connected: true, timestamp: new Date() });
}

function removeUserConnection(userId) {
  const key = String(userId);
  const next = (userConnections.get(key) || 0) - 1;
  if (next > 0) {
    userConnections.set(key, next);
    return;
  }
  userConnections.delete(key);
  broadcastToAdmins('USER_STATUS', { userId: key, connected: false, timestamp: new Date() });
}

// Dong toan bo socket cua user (dung khi dang xuat / xoa tai khoan).
function disconnectUser(userId) {
  if (!wss) return;
  const key = String(userId);
  for (const socket of wss.clients) {
    if (socket.userId === key) socket.close(4001, 'Logged out');
  }
}

// Client gui {"type":"subscribe","deviceIds":["esp32_01"]} de chi nhan du lieu cua cac thiet bi do.
function initWs(server) {
  wss = new WebSocketServer({
    server,
    path: '/ws',
    verifyClient: (info, done) => {
      try {
        const token = readToken(info.req);
        if (!token) return done(false, 401, 'Unauthorized');
        const payload = jwt.verify(token, config.jwtSecret);
        info.req.authUserId = payload.sub;
        done(true);
      } catch {
        done(false, 401, 'Unauthorized');
      }
    },
  });
  wss.on('connection', async (socket, req) => {
    socket.deviceIds = new Set();
    socket.on('error', (error) => console.error('[ws] loi socket:', error.message));
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
    socket.on('close', () => {
      if (socket.userId) removeUserConnection(socket.userId);
    });
    try {
      const user = await User.findById(req.authUserId).select('_id role status_online');
      if (!user || !user.status_online) {
        socket.close(1008, 'Unauthorized');
        return;
      }
      if (socket.readyState !== 1) return;
      socket.userId = String(user._id);
      socket.isAdmin = user.role === 'admin';
      addUserConnection(socket.userId);
    } catch (error) {
      console.error('[ws] loi xac thuc nguoi dung:', error.message);
      socket.close(1011, 'Server error');
      return;
    }
  });
}

function broadcast(deviceId, type, data) {
  if (!wss) return;
  const msg = JSON.stringify({ type, deviceId, data });
  for (const socket of wss.clients) {
    if (socket.readyState === 1 && socket.deviceIds.has(deviceId)) sendSafe(socket, msg);
  }
}

// Gui cho moi client da xac thuc (khong loc theo subscribe), dung cho trang thai online cua thiet bi.
function broadcastAll(type, payload) {
  if (!wss) return;
  const msg = JSON.stringify({ type, ...payload });
  for (const socket of wss.clients) {
    if (socket.readyState === 1 && socket.userId) sendSafe(socket, msg);
  }
}

module.exports = {
  initWs,
  broadcast,
  broadcastAll,
  broadcastToAdmins,
  isUserConnected,
  disconnectUser,
};
