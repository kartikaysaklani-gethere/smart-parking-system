/*
  =============================================================================
  PARKWISE PRO - FINAL SMART MOBILITY & AUTOMATED PARKING SYSTEM
  =============================================================================
  Engineered by: Kartikay Saklani & Anshuman (Chandigarh University)
  Board: ESP32 Dev Module

  Hardware Calibrations:
    - Wi-Fi SSID:         "OnePlus"
    - Wi-Fi Password:     "kartikay1234"
    - Gate Sensor Range:  <= 6 cm (Trigger arrival - reduced by 1 cm)
    - Slot Sensors Range: <= 9 cm (Occupied threshold)
    - Servo Gate Barrier: 90 deg (Open) for 3 Seconds, then auto-closes to 0 deg
    - Slot Guidance LEDs: Active HIGH (GPIO16, GPIO17, GPIO19)
    - Total Garage Bays:  6 Slots (Starts with 4 Free: G1, G2, F1, F2)
                          G3 = Permanently Occupied | F3 = Permanently Reserved
    - Wire Optimization:  15us clean trigger pulse, 15ms acoustic settling delay
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
const char* BASE_URL      = "https://smart-parking-system-ten-pearl.vercel.app";
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

// ---------- OPERATIONAL CALIBRATIONS ----------
const uint8_t  LCD_ADDR             = 0x27;
const int      SERVO_CLOSED         = 0;   // Barrier closed angle
const int      SERVO_OPEN           = 90;  // Barrier open angle (90 degrees)
const unsigned long GATE_HOLD_MS    = 3000UL; // Gate remains open for 3 seconds
const unsigned long GATE_COOLDOWN_MS = 1500UL; // Cooldown after closing to prevent flutter

// Distance Thresholds (Calibrated)
const float    GATE_OPEN_CM         = 6.0f;   // Gate triggers when vehicle <= 6 cm
const float    SLOT_OCCUPIED_CM     = 9.0f;   // Slot occupied when distance <= 9 cm

// Extended Wire & Signal Timing
const unsigned long ULTRA_TIMEOUT_US = 15000UL; // 15ms timeout prevents hang on long wires
const unsigned long SENSOR_TICK_MS   = 60UL;    // Fast polling cycle
const unsigned long TELEMETRY_MS    = 1000UL;  // Cloud telemetry interval (1s)

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
bool gateCar                = false;
bool gateIsOpen             = false;
unsigned long gateOpenedAt  = 0;
unsigned long gateClosedAt  = 0;
int assignedSlotIdx         = -1; // -1 = None, 0 = G1, 1 = G2, 2 = F1

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

// Clean ultrasonic read with 15us pulse for extended wire harnesses
static float readCm(uint8_t trig, uint8_t echo) {
  digitalWrite(trig, LOW);
  delayMicroseconds(4);
  digitalWrite(trig, HIGH);
  delayMicroseconds(15);
  digitalWrite(trig, LOW);

  unsigned long us = pulseIn(echo, HIGH, ULTRA_TIMEOUT_US);
  if (us == 0) return -1.0f;
  return us * 0.0343f * 0.5f;
}

static void setGate(bool open) {
  gateIsOpen = open;
  if (open) {
    gateServo.write(SERVO_OPEN);
    gateOpenedAt = millis();
    Serial.printf("[GATE] OPENED to 90 degrees at %lu ms\n", gateOpenedAt);
  } else {
    gateServo.write(SERVO_CLOSED);
    gateClosedAt = millis();
    Serial.println("[GATE] CLOSED to 0 degrees");
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
  samples[i][sampleIdx[i]] = cm;
  sampleIdx[i] = (sampleIdx[i] + 1) % 5;
  slotDist[i] = median5(samples[i]);

  // Slot is marked occupied when <= 9.0 cm
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

    // If car parked into the assigned slot, clear guidance assignment
    if (!wasOccupied && occupied[i] && assignedSlotIdx == (int)i) {
      Serial.printf("[ASSIGNMENT] Driver successfully parked in %s!\n", SLOT_NAME[i]);
      assignedSlotIdx = -1;
    }
  }
}

static void gateLogic(float cm, bool remoteHold) {
  if (cm < 0) cm = 999.0f;
  gateDist = cm;
  gateCar = (gateDist <= GATE_OPEN_CM); // Car at gate if <= 6 cm

  // Cooldown check after previous close
  bool inCooldown = (millis() - gateClosedAt < GATE_COOLDOWN_MS);

  // 1. Vehicle arrives at gate:
  if (gateCar && !gateIsOpen && !inCooldown) {
    // Automatically find first available free parking bay
    assignedSlotIdx = -1;
    for (uint8_t i = 0; i < 3; i++) {
      if (!occupied[i]) {
        assignedSlotIdx = i;
        break;
      }
    }

    if (assignedSlotIdx != -1) {
      Serial.printf("[AUTO-ASSIGN] Car detected at gate (%.1fcm <= 6cm)! Assigned %s. LED Lit.\n",
                    gateDist, SLOT_NAME[assignedSlotIdx]);
    }

    // Open barrier to 90 degrees
    setGate(true);
  }

  // 2. Gate auto-close timer: closes automatically after 3 seconds
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
  WiFiClientSecure client;
  client.setInsecure(); // Skip TLS certificate checks for fast embedded telemetry

  HTTPClient http;
  http.setConnectTimeout(4000);
  http.setTimeout(4000);
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
        Serial.print("\n>>> [WIFI] CONNECTED TO ");
        Serial.print(WIFI_SSID);
        Serial.print("! IP: ");
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

  Serial.println("\n==================================================");
  Serial.println("  PARKWISE PRO - FINAL SMART MOBILITY SYSTEM     ");
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
    for (uint8_t k = 0; k < 5; k++) samples[i][k] = 400.0f;
  }

  // Attach Servo (Compatible across all ESP32 Arduino Cores)
  gateServo.setPeriodHertz(50);
  gateServo.attach(PIN_SERVO, 500, 2400);

  // Startup Calibration Sweep: Test servo movement
  Serial.println("[SERVO] Testing barrier sweep: 45 deg -> 0 deg...");
  gateServo.write(45);
  delay(300);
  gateServo.write(SERVO_CLOSED);
  delay(200);
  gateIsOpen = false;

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

  // Start Cloud Telemetry Worker on Core 0
  xTaskCreatePinnedToCore(netTask, "net", 8192, NULL, 1, NULL, 0);
  Serial.println("[BOOT] All systems active. Ready.\n");
}

void loop() {
  Cmd cmd;
  portENTER_CRITICAL(&mux); cmd = cmdShared; portEXIT_CRITICAL(&mux);
  bool fresh = cmd.okAt != 0 && (millis() - cmd.okAt) < 5000UL;

  // Round-Robin Ultrasonic Sensor Polling with Acoustic Clearance
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

    // 12ms acoustic settling delay prevents echo crosstalk between neighboring extended wires
    delay(12);
  }

  // ==========================================================
  //  Guidance LEDs Logic
  // ==========================================================
  // Rule:
  // - When a slot is OCCUPIED (car parked <= 9cm): LED turns OFF (LOW).
  // - When a car arrives at the gate (<= 6cm): the assigned slot LED GLOWS (HIGH) to guide driver!
  // - When idle: all free slots have their guidance light lit.
  for (uint8_t i = 0; i < 3; i++) {
    bool ledOn = false;

    if (occupied[i]) {
      // Car is parked in the bay -> LED must be OFF
      ledOn = false;
    } else if (assignedSlotIdx == (int)i) {
      // This is the active auto-assigned slot -> GLOW BRIGHT!
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
  // Total 6 bays: G1, G2, G3 (occupied), F1, F2 (virtual free), F3 (reserved).
  // Starts with 4 free out of 6!
  int freeSensorCount = (!occupied[0]) + (!occupied[1]) + (!occupied[2]);
  int totalFree = freeSensorCount + 1; // 4 free at start!

  if (gateCar && assignedSlotIdx != -1) {
    // Arrival Screen: Shows assigned bay within 1 sec of vehicle arriving at gate
    char line1[20], line2[20];
    snprintf(line1, sizeof(line1), "PARK AT: %s", SLOT_NAME[assignedSlotIdx]);
    snprintf(line2, sizeof(line2), "Follow Green LED");
    showLcd(line1, line2);
  } else if (fresh && cmd.lcdActive) {
    // Server commanded message (e.g. online booking guidance)
    showLcd(cmd.l1, cmd.l2);
  } else {
    // Standard Free Capacity Screen
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
    Serial.printf("[STATUS] Gate=%.0fcm(Open:%d) | G1=%.0f(%c) G2=%.0f(%c) F1=%.0f(%c) | LEDs=[%d,%d,%d] Free=%d/6 | Wi-Fi=%d\n",
                  gateDist, gateIsOpen ? 1 : 0,
                  slotDist[0], occupied[0] ? 'O' : 'F',
                  slotDist[1], occupied[1] ? 'O' : 'F',
                  slotDist[2], occupied[2] ? 'O' : 'F',
                  digitalRead(SLOT_LED[0]), digitalRead(SLOT_LED[1]), digitalRead(SLOT_LED[2]),
                  totalFree,
                  WiFi.status() == WL_CONNECTED ? 1 : 0);
  }
  delay(2);
}
