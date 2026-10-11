const Device = require('../models/Device');
const Telemetry = require('../models/Telemetry');
const WateringEvent = require('../models/WateringEvent');

const PERIOD_DAYS = { day: 1, week: 7, month: 30 };

// Thong ke cua mot Asset trong 1 / 7 / 30 ngay gan nhat.
async function assetStats(assetId, period) {
  const days = PERIOD_DAYS[period];
  if (!days) return null;
  const from = new Date(Date.now() - days * 24 * 3600 * 1000);
  const deviceIds = (await Device.find({ assetId }).select('_id')).map((d) => d._id);

  const [tele] = await Telemetry.aggregate([
    { $match: { deviceId: { $in: deviceIds }, timestamp: { $gte: from } } },
    {
      $group: {
        _id: null,
        avgSoilHumidity: { $avg: '$soil_humidity' },
        avgTemperature: { $avg: '$temperature' },
        avgHumidity: { $avg: '$humidity' },
        samples: { $sum: 1 },
      },
    },
  ]);
  const [water] = await WateringEvent.aggregate([
    { $match: { deviceId: { $in: deviceIds }, startedAt: { $gte: from }, endedAt: { $ne: null } } },
    { $group: { _id: null, totalLiters: { $sum: '$liters' }, totalSec: { $sum: '$durationSec' }, count: { $sum: 1 } } },
  ]);

  const round = (v) => (v == null ? null : Number(v.toFixed(2)));
  return {
    period,
    from,
    to: new Date(),
    samples: tele?.samples ?? 0,
    avgSoilHumidity: round(tele?.avgSoilHumidity),
    avgTemperature: round(tele?.avgTemperature),
    avgHumidity: round(tele?.avgHumidity),
    wateringCount: water?.count ?? 0,
    totalWateringSec: water?.totalSec ?? 0,
    totalLiters: round(water?.totalLiters ?? 0),
  };
}

module.exports = { assetStats };
