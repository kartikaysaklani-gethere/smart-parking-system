/*
  PARKPULSE PRO - SMART MOBILITY & PARKING SYSTEM
  ================================================
  ESP32 Firmware with Dual-Floor Ultrasonic Sensing,
  Automated Servo Barrier Control, and Cloud Telemetry.

  Configuration:
    Wi-Fi SSID:     "Anshuman"
    Wi-Fi Password: "abcd12345"
    Servo Open:     150 degrees
    Cloud Server:   https://smart-parking-system-ten-pearl.vercel.app
    Guidance LEDs:  GPIO16 (G1), GPIO17 (G2), GPIO19 (F1) -> Active HIGH (Lit when Free)
*/

#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <LiquidCrystal_I2C.h>
#include <ESP32Servo.h>

// ===================== WI-FI & CLOUD CONFIG =====================
const char* WIFI_SSID     = "Anshuman";
const char* WIFI_PASSWORD = "abcd12345";
const char* BASE_URL      = "https://smart-parking-system-ten-pearl.vercel.app";
const char* DEVICE_KEY    = "esp32_smart_parking_secret_key_2026";
// ================================================================

// ---------- PIN MAPPINGS (Exact Physical Wiring) ----------
const uint8_t PIN_SERVO     = 13; // GPIO13: Gate Servo Signal (orange)

// Gate Ultrasonic Sensor
const uint8_t PIN_GATE_TRIG = 4;  // GPIO4:  Gate Sensor TRIG
const uint8_t PIN_GATE_ECHO = 34; // GPIO34: Gate Sensor ECHO

// Slot Names and Sensors
const char*   SLOT_NAME[3]  = {"G1", "G2", "F1"};
const uint8_t SLOT_TRIG[3]  = {23, 25, 26}; // GPIO23 (G1), GPIO25 (G2), GPIO26 (F1)
const uint8_t SLOT_ECHO[3]  = {35, 36, 39}; // GPIO35 (G1), GPIO36 (G2), GPIO39 (F1)
const uint8_t SLOT_LED[3]   = {16, 17, 19}; // GPIO16 (G1), GPIO17 (G2), GPIO19 (F1)

// I2C 16x2 LCD Display
const uint8_t PIN_SDA       = 21; // GPIO21: LCD SDA
const uint8_t PIN_SCL       = 22; // GPIO22: LCD SCL

// ---------- OPERATIONAL SETTINGS ----------
const uint8_t  LCD_ADDR             = 0x27;
const int      SERVO_CLOSED         = 0;
const int      SERVO_OPEN           = 150; // Set to 150° for full barrier clearance
const unsigned long ULTRA_TIMEOUT_US = 25000UL;
const unsigned long SENSOR_TICK_MS   = 70UL;
const float    SLOT_OCCUPIED_CM     = 10.0f;
const float    GATE_OPEN_CM         = 15.0f;
const float    GATE_CLOSE_CM        = 25.0f;
const unsigned long GATE_CLOSE_DELAY_MS = 2000UL;
const uint8_t  GATE_OPEN_READS      = 2;
const uint8_t  SLOT_STABLE_READS    = 3;
const unsigned long TELEMETRY_MS    = 1000UL; // Fast 1-second cloud telemetry
const unsigned long CMD_FRESH_MS    = 5000UL;

LiquidCrystal_I2C lcd(LCD_ADDR, 16, 2);
Servo gateServo;

// ---------- SENSOR FILTERING & STATE ----------
float samples[3][5];
uint8_t sampleIdx[3]        = {0, 0, 0};
float slotDist[3]           = {400, 400, 400};
bool occupied[3]            = {false, false, false};
bool candidate[3]           = {false, false, false};
uint8_t candidateCount[3]   = {0, 0, 0};

float gateDist              = 999.0f;
bool gateCar = false, gateIsOpen = false;
uint8_t gateOpenCount       = 0;
unsigned long gateFarSince  = 0;
uint8_t roundRobin          = 0;
unsigned long lastTick = 0, lastPrint = 0;

// ---------- INTER-TASK SHARED MEMORY ----------
portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;
struct Snapshot { bool occ[3]; bool car; int dist; };
struct Cmd {
  bool ledActive[3]; bool ledVal[3];
  bool lcdActive; char l1[17]; char l2[17];
  bool gateHold; unsigned long okAt;
};
Snapshot snap = {{false, false, false}, false, 999};
Cmd cmdShared = {{false, false, false}, {false, false, false}, false, "", "", false, 0};
char lastL1[17] = "", lastL2[17] = "";

// ============================================================
//  Helper Functions
// ============================================================
static float median5(const float in[5]) {
  float v[5];
  for (uint8_t i = 0; i < 5; i++) v[i] = in[i];
  for (uint8_t i = 1; i < 5; i++) {
    float key = v[i]; int j = i - 1;
    while (j >= 0 && v[j] > key) { v[j + 1] = v[j]; j--; }
    v[j + 1] = key;
  }
  return v[2];
}

static float readCm(uint8_t trig, uint8_t echo) {
  digitalWrite(trig, LOW);  delayMicroseconds(2);
  digitalWrite(trig, HIGH); delayMicroseconds(10);
  digitalWrite(trig, LOW);
  unsigned long us = pulseIn(echo, HIGH, ULTRA_TIMEOUT_US);
  if (us == 0) return -1.0f;
  return us * 0.0343f * 0.5f;
}

static void setGate(bool open) {
  gateIsOpen = open;
  gateServo.write(open ? SERVO_OPEN : SERVO_CLOSED);
  Serial.printf("[GATE] %s (%d deg)\n", open ? "OPEN" : "CLOSED", open ? SERVO_OPEN : SERVO_CLOSED);
}

static void updateSlot(uint8_t i, float cm) {
  if (cm < 0) cm = 400.0f;
  samples[i][sampleIdx[i]] = cm;
  sampleIdx[i] = (sampleIdx[i] + 1) % 5;
  slotDist[i] = median5(samples[i]);
  bool now = slotDist[i] < SLOT_OCCUPIED_CM;
  if (now == candidate[i]) { if (candidateCount[i] < 255) candidateCount[i]++; }
  else { candidate[i] = now; candidateCount[i] = 1; }
  if (candidateCount[i] >= SLOT_STABLE_READS) occupied[i] = candidate[i];
}

static void gateLogic(float cm, bool hold) {
  if (cm < 0) cm = 999.0f;
  gateDist = cm;
  gateCar = gateDist < GATE_CLOSE_CM;
  if (gateDist < GATE_OPEN_CM) { if (gateOpenCount < 255) gateOpenCount++; }
  else gateOpenCount = 0;
  if (!gateIsOpen && (gateOpenCount >= GATE_OPEN_READS || hold)) setGate(true);
  if (gateIsOpen && !hold) {
    if (gateDist > GATE_CLOSE_CM) {
      if (gateFarSince == 0) gateFarSince = millis();
      else if (millis() - gateFarSince >= GATE_CLOSE_DELAY_MS) { setGate(false); gateFarSince = 0; }
    } else gateFarSince = 0;
  } else gateFarSince = 0;
}

static void showLcd(const char* a, const char* b) {
  char l1[17], l2[17];
  snprintf(l1, sizeof(l1), "%-16.16s", a);
  snprintf(l2, sizeof(l2), "%-16.16s", b);
  if (strcmp(l1, lastL1) != 0) { lcd.setCursor(0, 0); lcd.print(l1); strcpy(lastL1, l1); }
  if (strcmp(l2, lastL2) != 0) { lcd.setCursor(0, 1); lcd.print(l2); strcpy(lastL2, l2); }
}

// ============================================================
//  JSON Response Parser
// ============================================================
static int findValue(const String& b, const char* key, int from) {
  String pat = String("\"") + key + "\"";
  int i = b.indexOf(pat, from);
  if (i < 0) return -1;
  i += pat.length();
  while (i < (int)b.length() && (b[i] == ' ' || b[i] == ':')) i++;
  return i;
}

static bool isTrueAt(const String& b, int i) {
  return i >= 0 && i + 3 < (int)b.length() && b.substring(i, i + 4) == "true";
}

static int readQuoted(const String& b, int pos, char* out) {
  int q = b.indexOf('"', pos);
  out[0] = 0;
  if (q < 0) return -1;
  int i = q + 1, n = 0;
  while (i < (int)b.length()) {
    char ch = b[i];
    if (ch == '\\' && i + 1 < (int)b.length()) { i++; ch = b[i]; if (ch == 'n') ch = ' '; }
    else if (ch == '"') { out[n] = 0; return i + 1; }
    if (n < 16) out[n++] = ch;
    i++;
  }
  out[n] = 0;
  return -1;
}

static bool parseResponse(const String& b, Cmd& c) {
  memset(&c, 0, sizeof(c));
  if (b.indexOf('{') < 0) return false;
  int li = b.indexOf("\"leds\"");
  if (li >= 0) {
    for (uint8_t k = 0; k < 3; k++) {
      int v = findValue(b, SLOT_NAME[k], li);
      if (v >= 0) { c.ledActive[k] = true; c.ledVal[k] = isTrueAt(b, v); }
    }
  }
  int ci = b.indexOf("\"lcd\"");
  if (ci >= 0) {
    int p = b.indexOf('[', ci);
    if (p >= 0) {
      p = readQuoted(b, p + 1, c.l1);
      if (p >= 0) { p = readQuoted(b, p, c.l2); if (p >= 0) c.lcdActive = true; }
    }
  }
  int gh = findValue(b, "gate_hold", 0);
  c.gateHold = isTrueAt(b, gh);
  return true;
}

// ============================================================
//  Network Task (Runs Asynchronously on Core 0)
// ============================================================
static void postTelemetry() {
  Snapshot s;
  portENTER_CRITICAL(&mux); s = snap; portEXIT_CRITICAL(&mux);

  char payload[170];
  snprintf(payload, sizeof(payload),
           "{\"slots\":{\"G1\":%s,\"G2\":%s,\"F1\":%s},\"gate\":{\"car_present\":%s,\"distance_cm\":%d}}",
           s.occ[0] ? "true" : "false", s.occ[1] ? "true" : "false", s.occ[2] ? "true" : "false",
           s.car ? "true" : "false", s.dist);

  String url = String(BASE_URL) + "/api/device/telemetry";
  WiFiClientSecure client;
  client.setInsecure(); // Skip SSL certificate checks for embedded IoT

  HTTPClient http;
  http.setConnectTimeout(5000);
  http.setTimeout(5000);
  if (!http.begin(client, url)) return;
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_KEY);

  int code = http.POST((uint8_t*)payload, strlen(payload));
  String body = (code > 0) ? http.getString() : String("");
  http.end();

  if (code < 200 || code >= 300) return;

  Cmd c;
  if (!parseResponse(body, c)) return;

  c.okAt = millis();
  portENTER_CRITICAL(&mux); cmdShared = c; portEXIT_CRITICAL(&mux);
}

void netTask(void*) {
  unsigned long lastPost = 0;
  bool connectedOnce = false;

  for (;;) {
    if (WiFi.status() == WL_CONNECTED) {
      if (!connectedOnce) {
        connectedOnce = true;
        Serial.print("\n>>> [WIFI] CONNECTED SUCCESSFULLY! IP: ");
        Serial.println(WiFi.localIP());
      }
      if (millis() - lastPost >= TELEMETRY_MS) {
        lastPost = millis();
        postTelemetry();
      }
    } else {
      connectedOnce = false;
    }
    vTaskDelay(pdMS_TO_TICKS(100));
  }
}

// ============================================================
//  Setup & Main Loop
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(300);

  // Initialize Ultrasonic Sensor Pins
  pinMode(PIN_GATE_TRIG, OUTPUT); digitalWrite(PIN_GATE_TRIG, LOW);
  pinMode(PIN_GATE_ECHO, INPUT);
  for (uint8_t i = 0; i < 3; i++) {
    pinMode(SLOT_TRIG[i], OUTPUT); digitalWrite(SLOT_TRIG[i], LOW);
    pinMode(SLOT_ECHO[i], INPUT);
    // Initialize Guidance LEDs (Active HIGH: HIGH = ON, LOW = OFF)
    pinMode(SLOT_LED[i], OUTPUT);
    digitalWrite(SLOT_LED[i], HIGH); // Light up LEDs at boot as slots start FREE
    for (uint8_t k = 0; k < 5; k++) samples[i][k] = 400.0f;
  }

  // Servo Configuration (0° to 150°)
  ESP32PWM::allocateTimer(0);
  gateServo.setPeriodHertz(50);
  gateServo.attach(PIN_SERVO, 500, 2400);
  setGate(false);

  // I2C 16x2 LCD Initialization
  Wire.begin(PIN_SDA, PIN_SCL);
  lcd.init();
  lcd.backlight();
  lcd.clear();
  showLcd("PARKPULSE PRO", "Connecting WiFi..");

  // Wi-Fi Setup with Auto-Reconnect
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  Serial.printf("[WIFI] Connecting to '%s'...\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  // Start Cloud Telemetry Worker on Core 0
  xTaskCreatePinnedToCore(netTask, "net", 8192, NULL, 1, NULL, 0);
  Serial.println("[BOOT] ParkPulse System Active. Servo Angle: 150 deg.");
}

void loop() {
  Cmd cmd;
  portENTER_CRITICAL(&mux); cmd = cmdShared; portEXIT_CRITICAL(&mux);
  bool fresh = cmd.okAt != 0 && (millis() - cmd.okAt) < CMD_FRESH_MS;

  // Round-Robin Ultrasonic Sensor Polling
  if (millis() - lastTick >= SENSOR_TICK_MS) {
    lastTick = millis();
    if (roundRobin == 0) {
      gateLogic(readCm(PIN_GATE_TRIG, PIN_GATE_ECHO), fresh && cmd.gateHold);
    } else {
      uint8_t i = roundRobin - 1;
      updateSlot(i, readCm(SLOT_TRIG[i], SLOT_ECHO[i]));
    }
    roundRobin = (roundRobin + 1) % 4;

    int d = (int)gateDist; if (d < 0) d = 0; if (d > 999) d = 999;
    portENTER_CRITICAL(&mux);
    for (uint8_t i = 0; i < 3; i++) snap.occ[i] = occupied[i];
    snap.car = gateCar; snap.dist = d;
    portEXIT_CRITICAL(&mux);
  }

  // Guidance LEDs Drive:
  // Slot FREE     -> LED ON  (HIGH) to guide drivers
  // Slot OCCUPIED -> LED OFF (LOW)
  for (uint8_t i = 0; i < 3; i++) {
    bool shouldBeLit = !occupied[i]; // Default: Lit if FREE
    if (fresh && cmd.ledActive[i]) {
      shouldBeLit = cmd.ledVal[i]; // Honor server guidance override if available
    }
    digitalWrite(SLOT_LED[i], shouldBeLit ? HIGH : LOW);
  }

  // 16x2 LCD Display Updates
  if (fresh && cmd.lcdActive) {
    showLcd(cmd.l1, cmd.l2);
  } else {
    int freeCount = (!occupied[0]) + (!occupied[1]) + (!occupied[2]);
    char a[20], b[20];
    if (freeCount == 0) snprintf(a, sizeof(a), "  PARKING FULL");
    else snprintf(a, sizeof(a), "Free slots: %d/3", freeCount);
    snprintf(b, sizeof(b), "G1:%c G2:%c F1:%c", occupied[0] ? 'O' : 'F', occupied[1] ? 'O' : 'F', occupied[2] ? 'O' : 'F');
    showLcd(a, b);
  }

  // Status Serial Output (Every 1 Second)
  if (millis() - lastPrint >= 1000) {
    lastPrint = millis();
    Serial.printf("[STATUS] gate=%.0fcm open=%d | G1=%.0f(%c) G2=%.0f(%c) F1=%.0f(%c) | LEDs=[%d,%d,%d] | wifi=%d server=%d\n",
                  gateDist, gateIsOpen ? 1 : 0,
                  slotDist[0], occupied[0] ? 'O' : 'F',
                  slotDist[1], occupied[1] ? 'O' : 'F',
                  slotDist[2], occupied[2] ? 'O' : 'F',
                  digitalRead(SLOT_LED[0]), digitalRead(SLOT_LED[1]), digitalRead(SLOT_LED[2]),
                  WiFi.status() == WL_CONNECTED ? 1 : 0, fresh ? 1 : 0);
  }
  delay(2);
}
