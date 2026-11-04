/*
  =============================================================================
  PARKWISE PRO - HIGH-SPEED SMART MOBILITY & AUTOMATED PARKING SYSTEM
  =============================================================================
  Engineered by: Kartikay Saklani & Anshuman (Chandigarh University)
  Board: ESP32 Dev Module

  Hardware Calibrations:
    - Wi-Fi SSID:         "OnePlus"
    - Wi-Fi Password:     "kartikay1234"
    - Gate Sensor Range:  <= 6 cm (Vehicle arrival detection)
    - Slot Sensors Range: <= 9 cm (Bay occupied detection)
    - Servo Gate Barrier: 45 deg (Half angle) - FAST action
    - Gate Hold Time:     1.5 Seconds (Fast automatic closure)
    - Anti-Flutter Lock:  Requires vehicle to clear (>8 cm) before retriggering
    - Glitch Filter:      5-sample median filter on Gate & Slot ultrasonics
    - Guidance LEDs:      Active HIGH (GPIO16=G1, GPIO17=G2, GPIO19=F1)
    - Total Bays:         6 Slots (4 Free at start: G1, G2, F1, F2)
                          G3 = Permanently Occupied | F3 = Permanently Reserved
  =============================================================================
*/

#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <LiquidCrystal_I2C.h>
#include <ESP32Servo.h>

// ===================== WI-FI & CLOUD CONFIG =====================
const char* WIFI_SSID     = "OnePlus";
const char* WIFI_PASSWORD = "kartikay1234";

// Server Endpoints:
// - Vercel Cloud (Online): "https://smart-parking-system-ten-pearl.vercel.app"
// - Local Mac Host (Offline/LAN): "http://10.47.237.156:3000"
const char* BASE_URL      = "http://10.47.237.156:3000";
const char* DEVICE_KEY    = "esp32_smart_parking_secret_key_2026";

// ---------- PIN MAPPINGS (Exact Physical Wiring) ----------
const uint8_t PIN_SERVO     = 13; // GPIO13: Gate Servo Signal (orange wire)

// Gate Ultrasonic Sensor
const uint8_t PIN_GATE_TRIG = 4;  // GPIO4:  Gate Sensor TRIG
const uint8_t PIN_GATE_ECHO = 34; // GPIO34: Gate Sensor ECHO (Input only)

// Slot Names and Sensors
const char*   SLOT_NAME[3]  = {"G1", "G2", "F1"};
const uint8_t SLOT_TRIG[3]  = {23, 25, 26}; // GPIO23 (G1), GPIO25 (G2), GPIO26 (F1)
const uint8_t SLOT_ECHO[3]  = {35, 36, 39}; // GPIO35 (G1), GPIO36 (G2), GPIO39 (F1)
const uint8_t SLOT_LED[3]   = {16, 17, 19}; // GPIO16 (G1), GPIO17 (G2), GPIO19 (F1)

// I2C 16x2 LCD Display Pins
const uint8_t PIN_SDA       = 21; // GPIO21: LCD SDA
const uint8_t PIN_SCL       = 22; // GPIO22: LCD SCL

// ---------- OPERATIONAL CALIBRATIONS (FAST SERVO & HALF ANGLE) ----------
const uint8_t  LCD_ADDR             = 0x27;
const int      SERVO_CLOSED         = 0;   // Barrier closed angle (0 degrees)
const int      SERVO_OPEN           = 45;  // Barrier open angle (45 degrees - EXACTLY HALF)
const unsigned long GATE_HOLD_MS    = 1500UL; // Gate opens & auto-closes fast (1.5 seconds)
const unsigned long GATE_COOLDOWN_MS = 800UL; // Fast cooldown to avoid repeated jitter

// Distance Thresholds
const float    GATE_OPEN_CM         = 6.0f;   // Gate triggers when vehicle <= 6 cm
const float    GATE_CLEAR_CM        = 8.5f;   // Must clear beyond 8.5 cm before re-triggering
const float    SLOT_OCCUPIED_CM     = 9.0f;   // Slot occupied when distance <= 9 cm

// Wire & Signal Timing
const unsigned long ULTRA_TIMEOUT_US = 12000UL; // 12ms timeout for lightning fast reads
const unsigned long SENSOR_TICK_MS   = 40UL;    // Fast 40ms polling rate
const unsigned long TELEMETRY_MS     = 1000UL;  // Cloud telemetry interval (1s)

LiquidCrystal_I2C lcd(LCD_ADDR, 16, 2);
Servo gateServo;

// ---------- SENSOR FILTERING & STATE ----------
float slotSamples[3][5];
uint8_t slotSampleIdx[3]    = {0, 0, 0};
float slotDist[3]           = {400, 400, 400};
bool occupied[3]            = {false, false, false};
bool candidate[3]           = {false, false, false};
uint8_t candidateCount[3]   = {0, 0, 0};

// Gate Sensor Filtering (Eliminates False Glitches & Continuous Jitter)
float gateSamples[5]        = {999, 999, 999, 999, 999};
uint8_t gateSampleIdx       = 0;
float gateDist              = 999.0f;
bool gateCar                = false;
bool gateIsOpen             = false;
bool gateArmed              = true; // Prevents endless rotation while car stays at gate
unsigned long gateOpenedAt  = 0;
unsigned long gateClosedAt  = 0;
int assignedSlotIdx         = -1;   // -1 = None, 0 = G1, 1 = G2, 2 = F1

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

// Clean ultrasonic pulse with fast 12us trigger
static float readCm(uint8_t trig, uint8_t echo) {
  digitalWrite(trig, LOW);
  delayMicroseconds(3);
  digitalWrite(trig, HIGH);
  delayMicroseconds(12);
  digitalWrite(trig, LOW);

  unsigned long us = pulseIn(echo, HIGH, ULTRA_TIMEOUT_US);
  if (us == 0) return -1.0f;
  return us * 0.0343f * 0.5f;
}

// Fast servo actuation
static void setGate(bool open) {
  if (gateIsOpen == open) return; // Prevent repeated redundant writes
  gateIsOpen = open;
  if (open) {
    gateServo.write(SERVO_OPEN); // 45 degrees
    gateOpenedAt = millis();
    Serial.printf("[GATE] FAST OPEN (45 deg) at %lu ms\n", gateOpenedAt);
  } else {
    gateServo.write(SERVO_CLOSED); // 0 degrees
    gateClosedAt = millis();
    Serial.println("[GATE] FAST CLOSED (0 deg)");
  }
}

static void showLcd(const char* a, const char* b) {
  char l1[17], l2[17];
  snprintf(l1, sizeof(l1), "%-16.16s", a);
  snprintf(l2, sizeof(l2), "%-16.16s", b);
  if (strcmp(l1, lastL1) != 0) { lcd.setCursor(0, 0); lcd.print(l1); strcpy(lastL1, l1); }
  if (strcmp(l2, lastL2) != 0) { lcd.setCursor(0, 1); lcd.print(l2); strcpy(lastL2, l2); }
}

static void updateSlot(uint8_t i, float cm) {
  if (cm < 0) cm = 400.0f;
  slotSamples[i][slotSampleIdx[i]] = cm;
  slotSampleIdx[i] = (slotSampleIdx[i] + 1) % 5;
  slotDist[i] = median5(slotSamples[i]);

  // Slot marked occupied when <= 9.0 cm
  bool now = slotDist[i] <= SLOT_OCCUPIED_CM;
  if (now == candidate[i]) {
    if (candidateCount[i] < 255) candidateCount[i]++;
  } else {
    candidate[i] = now;
    candidateCount[i] = 1;
  }

  // 2 consecutive stable reads confirm status change
  if (candidateCount[i] >= 2) {
    bool wasOccupied = occupied[i];
    occupied[i] = candidate[i];

    // If car parked into the assigned slot, clear guidance
    if (!wasOccupied && occupied[i] && assignedSlotIdx == (int)i) {
      Serial.printf("[ASSIGNMENT] Car parked in %s! Guidance done.\n", SLOT_NAME[i]);
      assignedSlotIdx = -1;
    }
  }
}

static void gateLogic(float rawCm, bool remoteHold) {
  if (rawCm < 0) rawCm = 999.0f;
  
  // Median filter on gate to stop random noise triggers
  gateSamples[gateSampleIdx] = rawCm;
  gateSampleIdx = (gateSampleIdx + 1) % 5;
  gateDist = median5(gateSamples);

  gateCar = (gateDist <= GATE_OPEN_CM);

  // Re-arm trigger ONLY when car has passed or backed away (> 8.5 cm)
  if (gateDist > GATE_CLEAR_CM) {
    gateArmed = true;
  }

  // Cooldown check after closing
  bool inCooldown = (millis() - gateClosedAt < GATE_COOLDOWN_MS);

  // 1. Vehicle arrives at gate (<= 6 cm) and gate is armed:
  if (gateCar && !gateIsOpen && gateArmed && !inCooldown) {
    gateArmed = false; // LOCK OUT re-triggering until car moves away!

    // Find first available free parking bay
    assignedSlotIdx = -1;
    for (uint8_t i = 0; i < 3; i++) {
      if (!occupied[i]) {
        assignedSlotIdx = i;
        break;
      }
    }

    if (assignedSlotIdx != -1) {
      Serial.printf("[AUTO-ASSIGN] Car detected (%.1fcm)! Assigned %s. LED Lit.\n",
                    gateDist, SLOT_NAME[assignedSlotIdx]);
    }

    // Fast open to 45 degrees
    setGate(true);
  }

  // 2. Fast Auto-Close: Closes after 1.5 seconds (or if car clears)
  if (gateIsOpen && !remoteHold) {
    if (millis() - gateOpenedAt >= GATE_HOLD_MS) {
      setGate(false);
    }
  }

  // 3. Remote hold override from Admin page
  if (remoteHold && !gateIsOpen) {
    setGate(true);
  } else if (!remoteHold && !gateCar && gateIsOpen && (millis() - gateOpenedAt >= GATE_HOLD_MS)) {
    setGate(false);
  }
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
//  Cloud Network Task (Async Core 0)
// ============================================================
static void postTelemetry() {
  Snapshot s;
  portENTER_CRITICAL(&mux); s = snap; portEXIT_CRITICAL(&mux);

  char payload[180];
  snprintf(payload, sizeof(payload),
           "{\"slots\":{\"G1\":%s,\"G2\":%s,\"F1\":%s},\"gate\":{\"car_present\":%s,\"distance_cm\":%d}}",
           s.occ[0] ? "true" : "false", s.occ[1] ? "true" : "false", s.occ[2] ? "true" : "false",
           s.car ? "true" : "false", s.dist);

  String url = String(BASE_URL) + "/api/device/telemetry";
  int code = -1;
  String body = "";

  if (String(BASE_URL).startsWith("https")) {
    WiFiClientSecure client;
    client.setInsecure(); // Fast TLS bypass for embedded telemetry
    HTTPClient http;
    http.setConnectTimeout(4000);
    http.setTimeout(4000);
    if (http.begin(client, url)) {
      http.addHeader("Content-Type", "application/json");
      http.addHeader("x-device-key", DEVICE_KEY);
      code = http.POST((uint8_t*)payload, strlen(payload));
      if (code > 0) body = http.getString();
      http.end();
    }
  } else {
    WiFiClient client;
    HTTPClient http;
    http.setConnectTimeout(2500);
    http.setTimeout(2500);
    if (http.begin(client, url)) {
      http.addHeader("Content-Type", "application/json");
      http.addHeader("x-device-key", DEVICE_KEY);
      code = http.POST((uint8_t*)payload, strlen(payload));
      if (code > 0) body = http.getString();
      http.end();
    }
  }

  // Diagnostic feedback to Serial Monitor
  if (code == 200) {
    static unsigned long lastOkLog = 0;
    if (millis() - lastOkLog >= 4000) {
      lastOkLog = millis();
      Serial.println(">>> [SERVER] Connected & Synced! (HTTP 200 OK)");
    }
    Cmd c;
    if (parseResponse(body, c)) {
      c.okAt = millis();
      portENTER_CRITICAL(&mux); cmdShared = c; portEXIT_CRITICAL(&mux);
    }
  } else {
    static unsigned long lastErrLog = 0;
    if (millis() - lastErrLog >= 4000) {
      lastErrLog = millis();
      Serial.printf(">>> [SERVER] Sync attempt response: HTTP %d (Check internet or URL)\n", code);
    }
  }
}

void netTask(void*) {
  unsigned long lastPost = 0;
  bool connectedOnce = false;

  for (;;) {
    if (WiFi.status() == WL_CONNECTED) {
      if (!connectedOnce) {
        connectedOnce = true;
        Serial.print("\n>>> [WIFI] CONNECTED TO ");
        Serial.print(WIFI_SSID);
        Serial.print("! ESP32 IP: ");
        Serial.println(WiFi.localIP());
      }
      if (millis() - lastPost >= TELEMETRY_MS) {
        lastPost = millis();
        postTelemetry();
      }
    } else {
      connectedOnce = false;
    }
    vTaskDelay(pdMS_TO_TICKS(80));
  }
}

// ============================================================
//  Setup & Main Loop
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(200);

  Serial.println("\n==================================================");
  Serial.println("  PARKWISE PRO - FAST SERVO SMART MOBILITY        ");
  Serial.println("  Kartikay Saklani & Anshuman | Chandigarh Univ   ");
  Serial.println("==================================================");

  // Initialize Ultrasonic Sensor Pins
  pinMode(PIN_GATE_TRIG, OUTPUT); digitalWrite(PIN_GATE_TRIG, LOW);
  pinMode(PIN_GATE_ECHO, INPUT);

  for (uint8_t i = 0; i < 3; i++) {
    pinMode(SLOT_TRIG[i], OUTPUT); digitalWrite(SLOT_TRIG[i], LOW);
    pinMode(SLOT_ECHO[i], INPUT);
    // Initialize Guidance LEDs (Active HIGH: HIGH = ON, LOW = OFF)
    pinMode(SLOT_LED[i], OUTPUT);
    digitalWrite(SLOT_LED[i], HIGH); // Light up free bay guidance LEDs on boot
    for (uint8_t k = 0; k < 5; k++) slotSamples[i][k] = 400.0f;
  }
  for (uint8_t k = 0; k < 5; k++) gateSamples[k] = 999.0f;

  // Attach Servo & Lock at 0 degrees (Closed) immediately without jitter
  gateServo.setPeriodHertz(50);
  gateServo.attach(PIN_SERVO, 500, 2400);
  gateServo.write(SERVO_CLOSED);
  gateIsOpen = false;
  gateArmed = true;
  Serial.println("[SERVO] Initialized directly to 0 deg (Closed).");

  // I2C 16x2 LCD Initialization
  Wire.begin(PIN_SDA, PIN_SCL);
  lcd.init();
  lcd.backlight();
  lcd.clear();
  showLcd("PARKWISE SYSTEM", "Starting Up...");

  // Wi-Fi Setup with Auto-Reconnect
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  Serial.printf("[WIFI] Connecting to '%s'...\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  // Start Cloud Telemetry Worker with increased 12KB stack for TLS
  xTaskCreatePinnedToCore(netTask, "net", 12288, NULL, 1, NULL, 0);
  Serial.println("[BOOT] All systems active. Ready.\n");
}

void loop() {
  Cmd cmd;
  portENTER_CRITICAL(&mux); cmd = cmdShared; portEXIT_CRITICAL(&mux);
  bool fresh = cmd.okAt != 0 && (millis() - cmd.okAt) < 6000UL;

  // Fast Round-Robin Ultrasonic Sensor Polling
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

    delay(8); // Short 8ms acoustic settling delay for ultra-fast loop
  }

  // ==========================================================
  //  Guidance LEDs Logic
  // ==========================================================
  for (uint8_t i = 0; i < 3; i++) {
    bool ledOn = false;

    if (occupied[i]) {
      // Car is parked in the bay -> LED must be OFF
      ledOn = false;
    } else if (assignedSlotIdx == (int)i) {
      // Active auto-assigned slot -> GLOW BRIGHT!
      ledOn = true;
    } else if (assignedSlotIdx == -1) {
      // No active arrival: all free bays have their guidance light lit
      ledOn = true;
    }

    // Honor server override if actively commanded
    if (fresh && cmd.ledActive[i]) {
      ledOn = cmd.ledVal[i];
    }

    digitalWrite(SLOT_LED[i], ledOn ? HIGH : LOW);
  }

  // ==========================================================
  //  16x2 LCD Display Updates
  // ==========================================================
  int freeSensorCount = (!occupied[0]) + (!occupied[1]) + (!occupied[2]);
  int totalFree = freeSensorCount + 1; // 4 free at start!

  if (gateCar && assignedSlotIdx != -1) {
    char line1[20], line2[20];
    snprintf(line1, sizeof(line1), "PARK AT: %s", SLOT_NAME[assignedSlotIdx]);
    snprintf(line2, sizeof(line2), "Follow Green LED");
    showLcd(line1, line2);
  } else if (fresh && cmd.lcdActive) {
    showLcd(cmd.l1, cmd.l2);
  } else {
    char line1[20], line2[20];
    if (totalFree <= 0) {
      snprintf(line1, sizeof(line1), "  PARKING FULL");
      snprintf(line2, sizeof(line2), " 0/6 Available");
    } else {
      snprintf(line1, sizeof(line1), "PARKWISE SYSTEM");
      int groundFree = (!occupied[0]) + (!occupied[1]);
      int firstFree = (!occupied[2]) + 1; // F1 + F2
      snprintf(line2, sizeof(line2), "Free: %d/6 G:%d F:%d", totalFree, groundFree, firstFree);
    }
    showLcd(line1, line2);
  }

  // Status Serial Output (Every 1 Second)
  if (millis() - lastPrint >= 1000) {
    lastPrint = millis();
    bool serverSynced = (cmd.okAt != 0 && (millis() - cmd.okAt) < 6000UL);
    Serial.printf("[STATUS] Gate=%.0fcm(Open:%d) | G1=%.0f(%c) G2=%.0f(%c) F1=%.0f(%c) | LEDs=[%d,%d,%d] Free=%d/6 | Wi-Fi=%s | Server=%s\n",
                  gateDist, gateIsOpen ? 1 : 0,
                  slotDist[0], occupied[0] ? 'O' : 'F',
                  slotDist[1], occupied[1] ? 'O' : 'F',
                  slotDist[2], occupied[2] ? 'O' : 'F',
                  digitalRead(SLOT_LED[0]), digitalRead(SLOT_LED[1]), digitalRead(SLOT_LED[2]),
                  totalFree,
                  WiFi.status() == WL_CONNECTED ? "ONLINE" : "OFFLINE",
                  serverSynced ? "SYNCED" : "CONNECTING...");
  }
  delay(1);
}
