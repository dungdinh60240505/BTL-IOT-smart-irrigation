const Notification = require('../models/Notification');

function parseLimit(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 50;
  return Math.min(Math.floor(number), 100);
}

async function listNotifications(req, res) {
  const filter = {};
  if (req.query.active === 'true') filter.active = true;
  if (req.query.unread === 'true') filter.read = false;

  const items = await Notification.find(filter)
    .sort({ active: -1, createdAt: -1 })
    .limit(parseLimit(req.query.limit))
    .lean();

  res.json(items);
}

async function markNotificationRead(req, res) {
  const notification = await Notification.findByIdAndUpdate(
    req.params.id,
    { $set: { read: true, readAt: new Date() } },
    { new: true, runValidators: true }
  );
  if (!notification) return res.status(404).json({ error: 'Khong tim thay thong bao' });
  res.json(notification);
}

async function markAllNotificationsRead(req, res) {
  const result = await Notification.updateMany(
    { read: false },
    { $set: { read: true, readAt: new Date() } }
  );
  res.json({ updated: result.modifiedCount });
}

module.exports = { listNotifications, markNotificationRead, markAllNotificationsRead };
