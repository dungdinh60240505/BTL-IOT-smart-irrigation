const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const config = require('./config');
const User = require('./models/User');

let wss;

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
    try {
      const user = await User.findById(req.authUserId).select('_id status_online');
      if (!user || !user.status_online) {
        socket.close(1008, 'Unauthorized');
        return;
      }
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
    if (socket.readyState === 1 && socket.deviceIds.has(deviceId)) {
      try {
        socket.send(msg);
      } catch (error) {
        console.error('[ws] khong gui duoc message:', error.message);
      }
    }
  }
}

module.exports = { initWs, broadcast };
