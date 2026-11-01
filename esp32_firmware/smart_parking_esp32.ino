/**
 * Smart Parking System with Intelligent Slot Detection
 * ESP32 NodeMCU Firmware (Arduino C++)
 * 
 * Hardware:
 *  - 3x HC-SR04 Ultrasonic Sensors (G1, G2, F1)
 *  - 1x HC-SR04 Ultrasonic Entrance Gate Sensor
 *  - 1x SG90 Micro Servo (Gate Barrier)
 *  - 1x 16x2 I2C LCD Display (0x27)
 *  - 3x High-Brightness LEDs for Slot Guidance (G1, G2, F1)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ESP32Servo.h>

// Wi-Fi Credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// API Configuration
const char* serverUrl = "https://your-vercel-domain.vercel.app/api/device/telemetry";
const char* deviceApiKey = "esp32_smart_parking_secret_key_2026";

// Pinout Definitions
#define TRIG_G1 13
#define ECHO_G1 12
#define LED_G1 2

#define TRIG_G2 14
#define ECHO_G2 27
#define LED_G2 4

#define TRIG_F1 26
#define ECHO_F1 25
#define LED_F1 5

#define TRIG_GATE 33
#define ECHO_GATE 32
#define SERVO_PIN 18

// Threshold distance for slot occupancy (cm)
const int OCCUPIED_THRESHOLD_CM = 15;
const int GATE_CAR_THRESHOLD_CM = 20;

LiquidCrystal_I2C lcd(0x27, 16, 2);
Servo gateServo;

// Distance measurement helper
long readDistanceCM(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  long duration = pulseIn(echoPin, HIGH, 30000); // 30ms timeout (~5m)
  if (duration == 0) return 999;
  return duration * 0.034 / 2;
}

void setup() {
  Serial.begin(115200);

  // Setup Pin Modes
  pinMode(TRIG_G1, OUTPUT); pinMode(ECHO_G1, INPUT); pinMode(LED_G1, OUTPUT);
  pinMode(TRIG_G2, OUTPUT); pinMode(ECHO_G2, INPUT); pinMode(LED_G2, OUTPUT);
  pinMode(TRIG_F1, OUTPUT); pinMode(ECHO_F1, INPUT); pinMode(LED_F1, OUTPUT);
  pinMode(TRIG_GATE, OUTPUT); pinMode(ECHO_GATE, INPUT);

  // Turn off all LEDs initially
  digitalWrite(LED_G1, LOW);
  digitalWrite(LED_G2, LOW);
  digitalWrite(LED_F1, LOW);

  // Setup LCD
  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Smart Parking");
  lcd.setCursor(0, 1);
  lcd.print("Connecting WiFi...");

  // Setup Servo Gate
  gateServo.attach(SERVO_PIN);
  gateServo.write(0); // 0 deg = Closed barrier

  // Connect to Wi-Fi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi Connected! IP: " + WiFi.localIP().toString());
  lcd.clear();
  lcd.print("System Online");
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    // 1. Read Physical Ultrasonic Sensors
    long distG1 = readDistanceCM(TRIG_G1, ECHO_G1);
    long distG2 = readDistanceCM(TRIG_G2, ECHO_G2);
    long distF1 = readDistanceCM(TRIG_F1, ECHO_F1);
    long distGate = readDistanceCM(TRIG_GATE, ECHO_GATE);

    bool g1Occupied = (distG1 < OCCUPIED_THRESHOLD_CM);
    bool g2Occupied = (distG2 < OCCUPIED_THRESHOLD_CM);
    bool f1Occupied = (distF1 < OCCUPIED_THRESHOLD_CM);
    bool carAtGate = (distGate < GATE_CAR_THRESHOLD_CM);

    // 2. Prepare JSON Payload
    StaticJsonDocument<512> reqDoc;
    JsonObject slotsObj = reqDoc.createNestedObject("slots");
    slotsObj["G1"] = g1Occupied;
    slotsObj["G2"] = g2Occupied;
    slotsObj["F1"] = f1Occupied;

    JsonObject gateObj = reqDoc.createNestedObject("gate");
    gateObj["car_present"] = carAtGate;
    gateObj["distance_cm"] = distGate;

    String jsonString;
    serializeJson(reqDoc, jsonString);

    // 3. Send Telemetry to Next.js API
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-device-key", deviceApiKey);

    int httpCode = http.POST(jsonString);
    if (httpCode == 200) {
      String response = http.getString();
      StaticJsonDocument<512> resDoc;
      DeserializationError error = deserializeJson(resDoc, response);

      if (!error) {
        // 4. Update Slot LEDs
        digitalWrite(LED_G1, resDoc["leds"]["G1"] | false ? HIGH : LOW);
        digitalWrite(LED_G2, resDoc["leds"]["G2"] | false ? HIGH : LOW);
        digitalWrite(LED_F1, resDoc["leds"]["F1"] | false ? HIGH : LOW);

        // 5. Update 16x2 LCD Lines
        const char* line1 = resDoc["lcd"][0] | "ParkSmart System";
        const char* line2 = resDoc["lcd"][1] | "Welcome";
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print(line1);
        lcd.setCursor(0, 1);
        lcd.print(line2);

        // 6. Servo Gate Control
        bool gateHold = resDoc["gate_hold"] | false;
        if (carAtGate || gateHold) {
          gateServo.write(90); // 90 deg = Open Barrier
        } else {
          gateServo.write(0);  // 0 deg = Closed Barrier
        }
      }
    } else {
      Serial.printf("HTTP Telemetry Error: %d\n", httpCode);
    }
    http.end();
  }

  // Telemetry loop delay (every 1.5 seconds)
  delay(1500);
}
