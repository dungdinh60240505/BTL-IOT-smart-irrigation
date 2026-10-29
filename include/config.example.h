// Sao chep file nay thanh config.h roi dien thong tin cua ban.
#pragma once

#define WIFI_SSID "ten-wifi"
#define WIFI_PASSWORD "mat-khau-wifi"

// IP cua may dang chay MQTT broker (cung mang LAN voi ESP32), KHONG dung "localhost".
#define MQTT_HOST "192.168.1.10"
#define MQTT_PORT 1883
#define MQTT_USER "esp32_01"
#define MQTT_PASSWORD "change-mqtt-device-password"

#define DEVICE_ID "esp32_01"
#define FIRMWARE_VERSION "0.1.0"

// --- Chan GPIO ---
#define PIN_DHT 4         // DHT11 data
#define PIN_SOIL 34       // Cam bien do am dat (analog). Phai dung chan ADC1 (32-39) vi ADC2 khong dung duoc khi bat WiFi.
#define PIN_WATER_LEVEL -1 // Dat chan ADC1 neu co cam bien muc nuoc; -1 = khong dung
#define PIN_LED_GREEN 25  // Dong vai "bom": sang = dang tuoi
#define PIN_LED_YELLOW 26 // Sang = mat ket noi WiFi/MQTT
#define PIN_LED_RED 27    // Sang = dat kho (duoi SOIL_DRY_PERCENT)

// --- Hieu chinh cam bien do am dat: doc gia tri ADC tho khi de ngoai khong khi va khi nhung trong nuoc ---
#define SOIL_ADC_DRY 3200
#define SOIL_ADC_WET 1300
#define SOIL_DRY_PERCENT 30

// Neu dung cam bien muc nuoc: hieu chinh ADC khi be can va khi day.
#define WATER_ADC_EMPTY 0
#define WATER_ADC_FULL 4095

#define TELEMETRY_INTERVAL_MS 5000
// An toan van hanh: tu tat bom neu tuoi qua thoi gian nay (ke ca khi mat ket noi).
#define MAX_WATERING_MS 60000
