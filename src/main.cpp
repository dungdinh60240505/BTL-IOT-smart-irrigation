// Chỉ lắp và đọc dữ liệu từ DHT11
// Mục tiêu: test sensor DHT11 trước khi nối WiFi / MQTT / LED / bơm
// Sau này nếu cần, bạn có thể bỏ comment các phần khác ra lại.

#include <Arduino.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <PubSubClient.h>
#include <WiFi.h>

#define WIFI_SSID "DD"
#define WIFI_PASSWORD "1357924680"

// IP cua may dang chay MQTT broker (cung mang LAN voi ESP32), KHONG dung
// "localhost".
#define MQTT_HOST "180.93.195.207"
#define MQTT_PORT 1883

#define DEVICE_ID "esp32_01"
#define MQTT_USER DEVICE_ID // Username phai bang DEVICE_ID theo Mosquitto ACL
#define MQTT_PASSWORD "12345678"
#define FIRMWARE_VERSION "0.1.0"

// -------------------- CẤU HÌNH  --------------------
#define PIN_DHT 4      // DHT11 nối chân GPIO4
#define DHT_TYPE DHT11 // chuyen sang DHT11 khi nap code, simulator DHT22
// #define PIN_LED 2      // LED test, dùng chân GPIO2

#define PIN_SOIL 32  // chân cắm độ ẩm đất D32
#define PIN_RELAY 5  // IN relay 5V nối GPIO5
#define RELAY_ON LOW // Relay 1 kênh thường kích mức LOW
#define RELAY_OFF HIGH

DHT dht(PIN_DHT, DHT_TYPE);
WiFiClient espClient;
PubSubClient mqttClient(espClient);

void turnLampOn() {
  digitalWrite(PIN_RELAY, RELAY_ON);

  Serial.println("Relay ON: den bat");
}

void turnLampOff() {
  digitalWrite(PIN_RELAY, RELAY_OFF);

  Serial.println("Relay OFF: den tat");
}

void publishRelayState(const char *state, const char *attribute) {
  JsonDocument doc;
  doc[attribute] = state;

  String payload;
  serializeJson(doc, payload);

  String attributesTopic = "dt/attributes/" + String(DEVICE_ID);
  mqttClient.publish(attributesTopic.c_str(), payload.c_str());
}

void mqttCallback(char *topic, byte *payload, unsigned int length) {
  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, payload, length);
  if (error) {
    Serial.printf("Loi doc MQTT command tren %s: %s\n", topic, error.c_str());
    return;
  }

  const char *action = doc["action"] | "";
  const char *state = doc["state"] | "";
  if ((strcmp(action, "WATER") != 0 && strcmp(action, "LAMP") != 0) ||
      (strcmp(state, "ON") != 0 && strcmp(state, "OFF") != 0)) {
    Serial.printf("MQTT command khong hop le: %s\n", payload);
    return;
  }

  if (strcmp(state, "ON") == 0) {
    turnLampOn();
  } else {
    turnLampOff();
  }

  publishRelayState(state,
                    strcmp(action, "LAMP") == 0 ? "led_state" : "pump_state");
}

void connectWiFi() {
  // BẢO MẬT: Tuyệt đối không in WIFI_PASSWORD ra Serial Monitor
  Serial.printf("\nDang ket noi den WiFi: %s\n", WIFI_SSID);

  WiFi.mode(WIFI_STA);
  // Xóa bộ nhớ đệm WiFi cũ (nếu có) để tránh lỗi kẹt trạng thái của ESP32
  WiFi.disconnect();
  delay(100);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int timeout_counter = 0;
  const int MAX_RETRIES = 20; // Giới hạn 20 lần thử (20 * 500ms = 10 giây)

  // CHỐNG TREO: Vòng lặp sẽ tự thoát nếu vượt quá số lần thử
  while (WiFi.status() != WL_CONNECTED && timeout_counter < MAX_RETRIES) {
    delay(500);
    Serial.print(".");
    timeout_counter++;
  }

  Serial.println();

  // Đánh giá kết quả sau khi thoát vòng lặp
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("Ket noi WiFi THANH CONG!");
    Serial.print("Dia chi IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("LOI: Khong the ket noi WiFi (Qua thoi gian cho).");
  }
}

void connectMqtt() {
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);

  while (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT...");
    String clientId = "esp32-" + String(DEVICE_ID);

    if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASSWORD)) {
      Serial.println(" connected");
      String commandTopic = "dt/command/" + String(DEVICE_ID);
      if (mqttClient.subscribe(commandTopic.c_str())) {
        Serial.printf("Subscribed to %s\n", commandTopic.c_str());
      } else {
        Serial.printf("Khong subscribe duoc topic %s\n", commandTopic.c_str());
      }
    } else {
      Serial.print(" failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" retry in 2s");
      delay(2000);
    }
  }
}

void publishTelemetry() {
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  int soilRaw = analogRead(PIN_SOIL);
  int soilPercent = map(soilRaw, 4095, 0, 0, 100);

  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("Loi doc DHT");
    return;
  }

  JsonDocument doc;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["soil"] = soilPercent;

  String payload;
  serializeJson(doc, payload);

  String telemetryTopic = "dt/telemetry/" + String(DEVICE_ID);
  mqttClient.publish(telemetryTopic.c_str(), payload.c_str());

  Serial.printf("Publish to %s: %s\n", telemetryTopic.c_str(), payload.c_str());
}

const int unusedPins[] = {12, 13, 14, 25, 26, 27, 33};
const int numUnusedPins = sizeof(unusedPins) / sizeof(unusedPins[0]);

void setup() {
  Serial.begin(115200);

  // Hạ điện bằng code cho Nhóm 1
  for (int i = 0; i < numUnusedPins; i++) {
    pinMode(unusedPins[i], OUTPUT);
    digitalWrite(unusedPins[i], LOW);
  }

  pinMode(PIN_LED, OUTPUT);
  digitalWrite(PIN_LED, LOW);
  pinMode(PIN_RELAY, OUTPUT);
  digitalWrite(PIN_RELAY, RELAY_OFF);
  mqttClient.setCallback(mqttCallback);
  dht.begin();

  Serial.println(
      "DHT11 ready, da ha dien cac chan 12, 13, 14, 25, 26, 27, 33...");
  Serial.println("ESP32 ready");
  Serial.println("Dang doc DHT va gui MQTT...");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  if (!mqttClient.connected()) {
    connectMqtt();
  }

  mqttClient.loop();

  delay(5000); // Đọc mỗi 2 giây

  publishTelemetry();
}
