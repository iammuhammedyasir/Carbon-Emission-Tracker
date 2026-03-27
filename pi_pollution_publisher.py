Raspberry Pi — Data Producer
Reads OBD-II data, calculates Pollution Score via calc_pollution_score(),
and publishes the `scores` dict to HiveMQ broker over MQTT.
"""

import time
import json
import statistics
import serial
import paho.mqtt.client as mqtt   # pip install paho-mqtt

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
MQTT_BROKER = "broker.hivemq.com"   # ← change from "192.168.1.XX"
MQTT_PORT        = 1883
MQTT_TOPIC       = "results/data"

SERIAL_PORT      = "/dev/rfcomm0"   # ← your OBD adapter port on Pi
                                     #   (Windows: "COM3", Mac: "/dev/tty.usbserial-xxx")
BAUD_RATE        = 38400
VEHICLE_TYPE     = "petrol"          # "petrol" or "diesel"
PUBLISH_INTERVAL = 5                 # seconds between publishes
# ─────────────────────────────────────────────


# ── OBD serial helpers ────────────────────────

def send_cmd(ser, cmd):
    ser.write((cmd + '\r').encode())
    time.sleep(0.3)
    response = ser.read(ser.inWaiting()).decode(errors='ignore')
    return response.strip()


def parse_hex_bytes(response):
    """Strip echo/prompt and return list of hex byte values."""
    lines = [l.strip() for l in response.splitlines()
             if l.strip() and '>' not in l and l.strip() != '']
    for line in reversed(lines):
        parts = line.replace(':', '').split()
        hex_parts = [p for p in parts if all(c in '0123456789ABCDEFabcdef' for c in p)]
        if len(hex_parts) >= 3:
            return [int(b, 16) for b in hex_parts]
    return []


def decode_rpm(response):
    b = parse_hex_bytes(response)
    if len(b) >= 4:
        return ((b[2] * 256) + b[3]) / 4
    return None


def decode_speed(response):
    b = parse_hex_bytes(response)
    return b[2] if len(b) >= 3 else None


def decode_coolant(response):
    b = parse_hex_bytes(response)
    return b[2] - 40 if len(b) >= 3 else None


def decode_load(response):
    b = parse_hex_bytes(response)
    return round(b[2] * 100 / 255, 1) if len(b) >= 3 else None


def decode_stft(response):
    """STFT % = (A - 128) * 100 / 128  — Mode 01, PID 06"""
    b = parse_hex_bytes(response)
    return round((b[2] - 128) * 100 / 128, 2) if len(b) >= 3 else None


def decode_ltft(response):
    """LTFT % = (A - 128) * 100 / 128  — Mode 01, PID 07"""
    b = parse_hex_bytes(response)
    return round((b[2] - 128) * 100 / 128, 2) if len(b) >= 3 else None


def decode_lambda(response):
    """Lambda λ — Mode 01, PID 0x24"""
    b = parse_hex_bytes(response)
    if len(b) >= 4:
        return round(((b[2] * 256) + b[3]) / 32768, 4)
    return None


def decode_o2_upstream(response):
    """Upstream O2 voltage — Mode 01, PID 0x14"""
    b = parse_hex_bytes(response)
    if len(b) >= 3:
        voltage = b[2] / 200
        return round(voltage, 4), None
    return None, None


def decode_o2_downstream(response):
    """Downstream O2 voltage — Mode 01, PID 0x15"""
    b = parse_hex_bytes(response)
    return round(b[2] / 200, 4) if len(b) >= 3 else None


# ── Rolling sample buffers ────────────────────
# Keep last 60 samples (~30s) for lambda and O2 variance calculations
_lambda_samples  = []
_o2_up_samples   = []
_o2_down_samples = []


# ── Score calculators ─────────────────────────

def calc_pollution_score(stft, ltft, lam, o2_up_v, o2_down, load, vehicle_type):
    """
    Returns scores dict with keys:
      fuel_trim, lambda, catalyst, combustion, aftertreatment, final
    """
    scores = {}

    # ── Fuel Trim Score ───────────────────────
    # FuelTrim_Score = 100 - (TotalTrim * 2)
    # TotalTrim = |STFT| + |LTFT|
    if stft is not None and ltft is not None:
        total_trim = abs(stft) + abs(ltft)
        scores['fuel_trim'] = round(max(0, min(100, 100 - (total_trim * 2))), 2)
    else:
        scores['fuel_trim'] = None

    # ── Lambda Stability Score ────────────────
    # LambdaStability_Score = 100 - (Avg_Dev * 1000)
    # Avg_Dev = mean of |λ - 1| over sample window
    if lam is not None:
        _lambda_samples.append(lam)
        if len(_lambda_samples) > 60:
            _lambda_samples.pop(0)
        deviations = [abs(l - 1.0) for l in _lambda_samples]
        avg_dev = sum(deviations) / len(deviations)
        scores['lambda'] = round(max(0, min(100, 100 - (avg_dev * 1000))), 2)
    else:
        scores['lambda'] = None

    # ── Catalyst Efficiency Score ─────────────
    # CatalystEfficiency_Score = 100 - (Ratio * 100)
    # Ratio = Var_Down / Var_Up
    if o2_up_v is not None and o2_down is not None:
        _o2_up_samples.append(o2_up_v)
        _o2_down_samples.append(o2_down)
        if len(_o2_up_samples) > 60:
            _o2_up_samples.pop(0)
            _o2_down_samples.pop(0)
        if len(_o2_up_samples) >= 2:
            var_up   = statistics.variance(_o2_up_samples)
            var_down = statistics.variance(_o2_down_samples)
            if var_up > 0:
                ratio = var_down / var_up
                scores['catalyst'] = round(max(0, min(100, 100 - (ratio * 100))), 2)
            else:
                scores['catalyst'] = 100.0
        else:
            scores['catalyst'] = None
    else:
        scores['catalyst'] = None

    # ── Combustion Score ──────────────────────
    # Petrol: Combustion = 0.5 * FuelTrim + 0.5 * Lambda
    # Diesel: Combustion = Lambda (no fuel trim exposed)
    if vehicle_type == "petrol" and scores['fuel_trim'] is not None and scores['lambda'] is not None:
        scores['combustion'] = round(0.5 * scores['fuel_trim'] + 0.5 * scores['lambda'], 2)
    elif scores['lambda'] is not None:
        scores['combustion'] = scores['lambda']
    else:
        scores['combustion'] = None

    # ── AfterTreatment Score ──────────────────
    # AfterTreatment = 0.6 * Catalyst + 0.4 * Lambda
    if scores['catalyst'] is not None and scores['lambda'] is not None:
        scores['aftertreatment'] = round(0.6 * scores['catalyst'] + 0.4 * scores['lambda'], 2)
    else:
        scores['aftertreatment'] = None

    # ── Final Pollution Score ─────────────────
    # Pollution = 0.6 * Combustion + 0.4 * AfterTreatment
    if scores['combustion'] is not None and scores['aftertreatment'] is not None:
        scores['final'] = round(0.6 * scores['combustion'] + 0.4 * scores['aftertreatment'], 2)
    else:
        scores['final'] = None

    return scores


def rating(score):
    if score is None:
        return "N/A"
    if score >= 80:
        return "LOW RISK"
    elif score >= 50:
        return "MODERATE"
    else:
        return "HIGH RISK"


# ── Build MQTT payload ────────────────────────

def make_payload(scores, rpm, speed, coolant, load, stft, ltft, lam, o2_up_v, o2_down, vehicle_type):
    """
    Combines raw sensor values + scores dict into one flat JSON payload.
    Keys match the Supabase 'results' table columns exactly.
    """
    return {
        "timestamp":                 time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "vehicle_type":              vehicle_type,
        # raw sensor readings
        "rpm":                       rpm,
        "speed":                     speed,
        "coolant":                   coolant,
        "load":                      load,
        "stft":                      stft,
        "ltft":                      ltft,
        "lambda":                    lam,
        "o2_upstream":               o2_up_v,
        "o2_downstream":             o2_down,
        # scores — taken directly from scores dict
        "fuel_trim_score":           scores.get('fuel_trim'),
        "lambda_stability_score":    scores.get('lambda'),
        "catalyst_efficiency_score": scores.get('catalyst'),
        "combustion_score":          scores.get('combustion'),
        "aftertreatment_score":      scores.get('aftertreatment'),
        "pollution_score":           scores.get('final'),
        "risk":                      rating(scores.get('final')),
    }


# ── Main read loop ────────────────────────────

def read_loop(ser, mqtt_client, vehicle_type):
    while True:
        try:
            rpm        = decode_rpm(send_cmd(ser, '010C'))
            speed      = decode_speed(send_cmd(ser, '010D'))
            coolant    = decode_coolant(send_cmd(ser, '0105'))
            load       = decode_load(send_cmd(ser, '0104'))
            stft       = decode_stft(send_cmd(ser, '0106'))
            ltft       = decode_ltft(send_cmd(ser, '0107'))
            lam        = decode_lambda(send_cmd(ser, '0124'))
            o2_up_v, _ = decode_o2_upstream(send_cmd(ser, '0114'))
            o2_down    = decode_o2_downstream(send_cmd(ser, '0115'))

            scores = calc_pollution_score(
                stft, ltft, lam, o2_up_v, o2_down, load, vehicle_type)

            # ── Print to terminal ─────────────
            print("\033[2J\033[H", end="")
            print("=" * 55)
            print("   CARBON EMISSION TRACKER — LIVE DATA")
            print("=" * 55)
            print(f"  RPM          : {rpm or '---'}")
            print(f"  Speed        : {str(speed or '---')} km/h")
            print(f"  Coolant Temp : {str(coolant or '---')} °C")
            print(f"  Engine Load  : {str(load or '---')} %")
            print(f"  STFT         : {str(stft or '---')} %")
            print(f"  LTFT         : {str(ltft or '---')} %")
            print(f"  Lambda       : {lam or '---'}")
            print(f"  O2 Upstream  : {str(o2_up_v or '---')} V")
            print(f"  O2 Downstream: {str(o2_down or '---')} V")
            print("-" * 55)
            print(f"  Fuel Trim Score  : {scores.get('fuel_trim', 'N/A')}")
            print(f"  Lambda Score     : {scores.get('lambda', 'N/A')}")
            print(f"  Catalyst Score   : {scores.get('catalyst', 'N/A')}")
            print(f"  Combustion Score : {scores.get('combustion', 'N/A')}")
            print(f"  Aftertreat Score : {scores.get('aftertreatment', 'N/A')}")
            print("=" * 55)
            final = scores.get('final')
            print(f"  POLLUTION SCORE  : {final or 'N/A'}  —  {rating(final)}")
            print("=" * 55)
            print(f"  Vehicle: {vehicle_type.upper()}   |   Ctrl+C to stop")

            # ── Publish scores to MQTT ────────
            payload = make_payload(
                scores, rpm, speed, coolant, load,
                stft, ltft, lam, o2_up_v, o2_down, vehicle_type)
            mqtt_client.publish(MQTT_TOPIC, json.dumps(payload))
            print(f"  📤 Published to '{MQTT_TOPIC}'")

            time.sleep(PUBLISH_INTERVAL)

        except Exception as e:
            print(f"[Read error: {e}]")
            raise   # triggers reconnect in main


# ── Entry point ───────────────────────────────

def main():
    # Connect to HiveMQ broker
    mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
    mqtt_client.loop_start()
    print(f"✅ MQTT connected to {MQTT_BROKER}:{MQTT_PORT}")

    # Connect OBD serial with auto-reconnect
    while True:
        try:
            with serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1) as ser:
                print(f"✅ OBD connected on {SERIAL_PORT}")
                ser.write(b'ATZ\r')    # reset adapter
                time.sleep(1)
                ser.write(b'ATE0\r')   # echo off
                time.sleep(0.5)
                ser.flushInput()
                read_loop(ser, mqtt_client, VEHICLE_TYPE)
        except Exception as e:
            print(f"[Connection error: {e}] Retrying in 5s...")
            time.sleep(5)


if __name__ == "__main__":
    main()
