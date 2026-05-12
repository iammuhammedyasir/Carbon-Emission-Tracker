"""
pi_pollution_publisher.py
=========================
Runs on Raspberry Pi 4B.
- Reads OBD2 via Bluetooth ELM327
- Calculates Pollution Score (diesel or petrol)
- Publishes JSON to HiveMQ every 5 seconds
- mqttworker.py on laptop receives and inserts into Supabase

Install: pip install pyserial paho-mqtt
Run:     sudo python3 ~/pi_pollution_publisher.py
"""

import serial, time, json, subprocess, sys, re, statistics
import paho.mqtt.client as mqtt

# ── CONFIG ────────────────────────────────────────────────────────────────────
MAC              = "01:23:45:67:89:BA"
CHANNEL          = 2
PORT             = "/dev/rfcomm0"
BAUD_RATE        = 38400

MQTT_BROKER      = "a769917024e3407dbcacc8ee92e680d4.s1.eu.hivemq.cloud"
MQTT_PORT        = 8883
MQTT_USERNAME    = "carbon04"
MQTT_PASSWORD    = "Carbon04"
MQTT_TOPIC       = "results/data"

PUBLISH_INTERVAL = 5      # publish to MQTT every 5 seconds
# ─────────────────────────────────────────────────────────────────────────────


# ── Bluetooth connect ─────────────────────────────────────────────────────────

def rfcomm_connect():
    subprocess.run(["sudo", "rfcomm", "release", "0"], capture_output=True)
    time.sleep(1)
    subprocess.Popen(
        ["sudo", "rfcomm", "connect", "0", MAC, str(CHANNEL)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    time.sleep(4)


# ── ELM327 command layer ──────────────────────────────────────────────────────

def send_cmd(ser, cmd, wait=2.0):
    """
    FIX #1 & #2: Wait actively for '>' prompt instead of sleeping 0.3s.
    Handles slow CAN buses that take >300ms to respond.
    """
    try:
        ser.reset_input_buffer()
        ser.write((cmd + '\r').encode())
        response = b''
        deadline = time.time() + wait
        while time.time() < deadline:
            if ser.in_waiting:
                response += ser.read(ser.in_waiting)
                if b'>' in response:
                    break
            time.sleep(0.05)
        return response.decode(errors='ignore').strip()
    except Exception:
        return ""


def setup_elm(ser):
    """
    FIX #3 & #4: Full ELM327 init — sends ATSP0 and ATS1 which were missing.
    ATSP0 = auto-detect protocol (needs 6s on some cars)
    ATS1  = spaces ON so response bytes are always separated
    """
    print("[Setting up ELM327...]")
    send_cmd(ser, 'ATZ',    wait=4)   # full reset — takes up to 3s
    time.sleep(2)
    send_cmd(ser, 'ATE0',   wait=2)   # echo off
    send_cmd(ser, 'ATL0',   wait=2)   # linefeeds off
    send_cmd(ser, 'ATS1',   wait=2)   # spaces ON  ← FIX: ensures spaced hex bytes
    send_cmd(ser, 'ATH0',   wait=2)   # headers off
    send_cmd(ser, 'ATAT1',  wait=2)   # adaptive timing on
    send_cmd(ser, 'ATST64', wait=2)   # timeout 400ms
    send_cmd(ser, 'ATSP0',  wait=6)   # auto-detect protocol ← FIX: was missing, needs 5s
    print("[ELM327 setup complete]")


# ── Response parser ───────────────────────────────────────────────────────────

def parse_response(raw, pid_upper):
    """
    FIX #5: Robust parser that handles both spaced and no-space ELM327 responses.

    Handles:
      Spaced:    "41 0C 1A F0"        (standard, ATS1 on)
      No-spaces: "410C1AF0"           (clone adapters that ignore ATS1)
      With echo: "010C\r41 0C 1A F0"
      Errors:    "NO DATA" / "SEARCHING" / "?" → returns None

    pid_upper: 2-char PID uppercase e.g. '0C', '0D', '05'
    Returns: list of data byte integers after the "41 XX" header, e.g. [26, 240]
    """
    if not raw:
        return None

    lines = [l.strip() for l in re.split(r'[\r\n>]+', raw) if l.strip()]

    for line in lines:
        upper = line.upper()
        # Skip non-data lines
        if any(x in upper for x in ('NO DATA', 'SEARCHING', 'ERROR', 'UNABLE', '?', 'AT')):
            continue

        # Remove spaces and search for "41" + PID marker
        compact = upper.replace(' ', '')
        marker  = '41' + pid_upper.upper()
        idx     = compact.find(marker)
        if idx == -1:
            continue

        # Everything after the marker is data bytes
        data_str   = compact[idx + len(marker):]
        data_bytes = [data_str[i:i+2] for i in range(0, len(data_str), 2)
                      if len(data_str[i:i+2]) == 2]
        try:
            ints = [int(b, 16) for b in data_bytes]
            if ints:
                return ints
        except ValueError:
            continue

    return None


# ── PID decoders ──────────────────────────────────────────────────────────────
# FIX #6: All decoders now use b[0], b[1] (data bytes after header stripped by parser)
# Old code used b[2], b[3] assuming headers were ON — but ATH0 means headers OFF.
# The new parse_response() strips the "41 XX" prefix, so b[0] is always the first data byte.

def decode_rpm(raw):
    b = parse_response(raw, '0C')
    # RPM = (A*256 + B) / 4   — 2 data bytes needed
    return round(((b[0] * 256) + b[1]) / 4, 1) if b and len(b) >= 2 else None

def decode_speed(raw):
    b = parse_response(raw, '0D')
    return b[0] if b else None                     # 1 data byte

def decode_coolant(raw):
    b = parse_response(raw, '05')
    return b[0] - 40 if b else None               # 1 byte, offset -40

def decode_load(raw):
    b = parse_response(raw, '04')
    return round(b[0] * 100 / 255, 1) if b else None

def decode_stft(raw):
    b = parse_response(raw, '06')
    return round((b[0] - 128) * 100 / 128, 2) if b else None

def decode_ltft(raw):
    b = parse_response(raw, '07')
    return round((b[0] - 128) * 100 / 128, 2) if b else None

def decode_lambda(raw):
    b = parse_response(raw, '24')
    return round(((b[0] * 256) + b[1]) * 2 / 65536, 4) if b and len(b) >= 2 else None

def decode_o2_upstream(raw):
    b = parse_response(raw, '14')
    if b:
        voltage = round(b[0] / 200, 4)
        trim    = round((b[1] - 128) * 100 / 128, 2) if len(b) >= 2 else None
        return voltage, trim
    return None, None

def decode_o2_downstream(raw):
    b = parse_response(raw, '15')
    return round(b[0] / 200, 4) if b else None


# ── Rolling buffers for variance calculations ─────────────────────────────────
_lambda_samples  = []
_o2_up_samples   = []
_o2_down_samples = []


# ── Pollution score ───────────────────────────────────────────────────────────

def calc_pollution_score(stft, ltft, lam, o2_up, o2_down,
                         load, rpm, coolant, vehicle_type):
    """
    FIX #7 & #8: Added rpm and coolant parameters.
    Diesel now calculates score from Load + RPM + Warmup (coolant).
    Petrol uses Fuel Trim + Lambda + Catalyst as before.
    """
    scores = {}

    if vehicle_type == 'petrol':
        # Fuel Trim Score
        if stft is not None and ltft is not None:
            scores['fuel_trim'] = round(max(0, 100 - (abs(stft) + abs(ltft)) * 2), 1)

        # Lambda Stability Score (rolling window average deviation)
        if lam is not None:
            _lambda_samples.append(lam)
            if len(_lambda_samples) > 60:
                _lambda_samples.pop(0)
            avg_dev = sum(abs(l - 1.0) for l in _lambda_samples) / len(_lambda_samples)
            scores['lambda'] = round(max(0, 100 - avg_dev * 1000), 1)
        elif o2_up is not None:
            # Fallback: estimate lambda from O2 upstream voltage
            scores['lambda'] = round(max(0, 100 - abs(o2_up - 0.45) * 200), 1)

        # Catalyst Efficiency Score (variance ratio method)
        if o2_up is not None and o2_down is not None:
            _o2_up_samples.append(o2_up)
            _o2_down_samples.append(o2_down)
            if len(_o2_up_samples) > 60:
                _o2_up_samples.pop(0)
                _o2_down_samples.pop(0)
            if len(_o2_up_samples) >= 2:
                var_up   = statistics.variance(_o2_up_samples)
                var_down = statistics.variance(_o2_down_samples)
                scores['catalyst'] = round(max(0, 100 - (var_down / var_up) * 100), 1) if var_up > 0 else 100.0

        # Combustion Score
        if 'fuel_trim' in scores and 'lambda' in scores:
            scores['combustion'] = round(0.5 * scores['fuel_trim'] + 0.5 * scores['lambda'], 1)
        elif 'lambda' in scores:
            scores['combustion'] = scores['lambda']

        # AfterTreatment Score
        if 'catalyst' in scores and 'lambda' in scores:
            scores['aftertreatment'] = round(0.6 * scores['catalyst'] + 0.4 * scores['lambda'], 1)

        # Final Score
        if 'combustion' in scores and 'aftertreatment' in scores:
            scores['final'] = round(0.6 * scores['combustion'] + 0.4 * scores['aftertreatment'], 1)
        elif 'combustion' in scores:
            scores['final'] = scores['combustion']

    else:  # FIX #8 & #9: Diesel branch now fully implemented
        sub = []

        if load is not None:
            ls = max(0, round(100 - load, 1))
            scores['load_score'] = ls
            sub.append((ls, 0.4))

        if rpm is not None:
            rs = 95 if rpm < 1000 else 85 if rpm < 2000 else 70 if rpm < 3000 else 50 if rpm < 4000 else 30
            scores['rpm_score'] = rs
            sub.append((rs, 0.3))

        if coolant is not None:
            ws = 100 if coolant >= 80 else 80 if coolant >= 60 else 60 if coolant >= 40 else 40 if coolant >= 20 else 20
            scores['warmup_score'] = ws
            sub.append((ws, 0.3))

        if sub:
            total_w = sum(w for _, w in sub)
            scores['final'] = round(sum(s * w for s, w in sub) / total_w, 1)
            # Map to standard keys so MQTT payload is consistent
            scores['combustion']     = scores.get('load_score')
            scores['aftertreatment'] = scores.get('warmup_score')

    return scores


def rating(score):
    if score is None: return "NO DATA"
    if score >= 80:   return "LOW RISK"
    if score >= 60:   return "MODERATE"
    return                   "HIGH RISK"


def disp(val, unit=""):
    return f"{val}{unit}" if val is not None else "---"


# ── Main read loop ────────────────────────────────────────────────────────────

def read_loop(ser, mqtt_client, vehicle_type):
    last_publish = 0

    while True:
        try:
            # Read all PIDs
            rpm      = decode_rpm          (send_cmd(ser, '010C'))
            speed    = decode_speed        (send_cmd(ser, '010D'))
            coolant  = decode_coolant      (send_cmd(ser, '0105'))
            load     = decode_load         (send_cmd(ser, '0104'))
            stft     = decode_stft         (send_cmd(ser, '0106'))
            ltft     = decode_ltft         (send_cmd(ser, '0107'))
            lam      = decode_lambda       (send_cmd(ser, '0124'))
            o2_up, _ = decode_o2_upstream  (send_cmd(ser, '0114'))
            o2_down  = decode_o2_downstream(send_cmd(ser, '0115'))

            scores = calc_pollution_score(
                stft, ltft, lam, o2_up, o2_down,
                load, rpm, coolant, vehicle_type)   # FIX: rpm + coolant now passed

            final = scores.get('final')

            # ── Terminal display ──────────────────────────────────────────
            print("\033[2J\033[H", end="")
            print("=" * 50)
            print("   CARBON EMISSION TRACKER — LIVE")
            print("=" * 50)
            print(f"   RPM           : {disp(rpm)}")
            print(f"   Speed         : {disp(speed, ' km/h')}")
            print(f"   Coolant Temp  : {disp(coolant, ' C')}")
            print(f"   Engine Load   : {disp(load, ' %')}")
            print(f"   STFT          : {disp(stft, ' %')}")
            print(f"   LTFT          : {disp(ltft, ' %')}")
            print(f"   Lambda        : {disp(lam)}")
            print(f"   O2 Upstream   : {disp(o2_up, ' V')}")
            print(f"   O2 Downstream : {disp(o2_down, ' V')}")
            print("-" * 50)

            if vehicle_type == 'petrol':
                print(f"   Fuel Trim Score  : {disp(scores.get('fuel_trim'))}")
                print(f"   Lambda Score     : {disp(scores.get('lambda'))}")
                print(f"   Catalyst Score   : {disp(scores.get('catalyst'))}")
                print(f"   Combustion Score : {disp(scores.get('combustion'))}")
                print(f"   Aftertreat Score : {disp(scores.get('aftertreatment'))}")
            else:
                print(f"   Load Score    : {disp(scores.get('load_score'))}")
                print(f"   RPM Score     : {disp(scores.get('rpm_score'))}")
                print(f"   Warmup Score  : {disp(scores.get('warmup_score'))}")

            print("=" * 50)
            print(f"   SCORE  : {disp(final)}  —  {rating(final)}")
            print("=" * 50)
            print(f"   {vehicle_type.upper()}  |  Ctrl+C to stop")

            # ── MQTT publish every PUBLISH_INTERVAL seconds ───────────────
            now = time.time()
            if now - last_publish >= PUBLISH_INTERVAL:
                payload = {
                    "timestamp":                 time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "vehicle_type":              vehicle_type,
                    "rpm":                       rpm,
                    "speed":                     speed,
                    "coolant":                   coolant,
                    "load":                      load,
                    "stft":                      stft,
                    "ltft":                      ltft,
                    "lambda":                    lam,
                    "o2_upstream":               o2_up,
                    "o2_downstream":             o2_down,
                    "fuel_trim_score":           scores.get('fuel_trim'),
                    "lambda_stability_score":    scores.get('lambda'),
                    "catalyst_efficiency_score": scores.get('catalyst'),
                    "combustion_score":          scores.get('combustion'),
                    "aftertreatment_score":      scores.get('aftertreatment'),
                    "pollution_score":           final,
                    "risk":                      rating(final),
                }
                mqtt_client.publish(MQTT_TOPIC, json.dumps(payload))
                print(f"   📤 Published → score={final}  risk={rating(final)}")
                last_publish = now

            time.sleep(1)   # screen refreshes every 1s, MQTT every 5s

        except Exception as e:
            print(f"[Read error: {e}]")
            raise


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    print("=" * 50)
    print("  Carbon Emission Tracker — Pi Publisher")
    print("=" * 50)
    print("  1 = Petrol")
    print("  2 = Diesel")
    choice = input("  Enter 1 or 2: ").strip()
    vehicle_type = 'diesel' if choice == '2' else 'petrol'
    print(f"  Vehicle: {vehicle_type.upper()}")

    # Connect MQTT (TLS required for HiveMQ cloud port 8883)
    print(f"\n[Connecting MQTT to {MQTT_BROKER}...]")
    mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)   # FIX: indentation was broken
    mqtt_client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)     # FIX: these 3 lines were
    mqtt_client.tls_set()                                         #      outside the function
    mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
    mqtt_client.loop_start()
    print("[MQTT connected]")

    # Connect OBD2 with auto-reconnect loop
    ser = None
    while True:
        try:
            if ser is None or not ser.is_open:
                print("\n[Connecting OBD2 via Bluetooth...]")
                rfcomm_connect()
                ser = serial.Serial(PORT, BAUD_RATE, timeout=5)
                setup_elm(ser)
                print("[OBD2 ready — reading live data...]\n")
            read_loop(ser, mqtt_client, vehicle_type)

        except KeyboardInterrupt:
            print("\nStopped.")
            if ser: ser.close()
            mqtt_client.loop_stop()
            sys.exit(0)
        except Exception as e:
            print(f"[Connection lost: {e}]")
            print("[Reconnecting in 5 seconds...]")
            try:
                if ser: ser.close()
            except: pass
            ser = None
            time.sleep(5)


if __name__ == "__main__":
    main()
