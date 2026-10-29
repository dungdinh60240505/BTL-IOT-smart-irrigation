# BTL IoT - Hệ thống tưới cây tự động

## Thành phần

- `src/main.cpp`: firmware ESP32 (DHT11, độ ẩm đất, relay, MQTT).
- `server/`: Express API, WebSocket, MQTT consumer và MongoDB.
- `reactUI/`: giao diện Next.js.
- `mosquitto/`: cấu hình broker MQTT có xác thực/ACL.
- `docker-compose.yml`: MongoDB + Mosquitto + backend + frontend.

## Cấu hình bảo mật

1. Copy `.env.example` thành `.env` và đổi toàn bộ mật khẩu/secret.
2. Copy `server/.env.example` thành `server/.env` nếu chạy backend trực tiếp.
3. Copy `include/config.example.h` thành `include/config.h`, sau đó điền WiFi,
   `MQTT_HOST`, `MQTT_USER` và `MQTT_PASSWORD`. `MQTT_USER` phải trùng
   `MQTT_DEVICE_USER` trong `.env` (mặc định `esp32_01`).
   Nếu có cảm biến mực nước, đặt `PIN_WATER_LEVEL` và hiệu chỉnh
   `WATER_ADC_EMPTY`/`WATER_ADC_FULL`; mặc định `-1` là không dùng.
4. `JWT_SECRET` phải dài ít nhất 32 ký tự. `ADMIN_PASSWORD` dùng để tạo admin
   lần đầu; không có mật khẩu mặc định trong mã nguồn.

`server/.env` và `include/config.h` chứa secret nên đã được đưa vào
`.gitignore`, không commit lên Git.

## Chạy bằng Docker

```bash
docker compose up --build
```

- Frontend: http://localhost:4001
- Backend: http://localhost:3001
- MQTT: `localhost:1883` (bắt buộc username/password; ESP32 kết nối qua IP LAN của máy host)
- MongoDB chỉ mở trên `127.0.0.1:27017` và yêu cầu tài khoản root trong `.env`.

Nếu volume MongoDB cũ đã được tạo trước khi bật auth, cần migrate/tạo user hoặc
xóa volume dev rồi khởi động lại.

## Chạy backend trực tiếp

```bash
cd server
npm install
npm start
```

## Logic cảnh báo và tự động tắt bơm

Khi telemetry được ghi nhận:

- Độ ẩm đất thấp hơn `safe_min_soil_humidity` → tạo thông báo `SOIL_LOW`.
- Độ ẩm đất cao hơn `safe_max_soil_humidity` → tạo thông báo `SOIL_HIGH` và
  gửi lệnh `WATER OFF` để tắt relay (có cooldown).
- Mực nước thấp/cao hơn ngưỡng tương ứng → tạo thông báo `WATER_LOW`/`WATER_HIGH`.

Thông báo được xem qua API `/api/notifications` và icon chuông trên giao diện.
