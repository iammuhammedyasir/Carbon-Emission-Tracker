"""
mqtt_worker.py
MQTT Worker — Subscriber + Supabase Feeder
Uses plain HTTP requests to insert into Supabase.
No supabase library needed — works on Python 3.14+

Install:
  pip install paho-mqtt requests
"""

import json
import requests
import paho.mqtt.client as mqtt

# ─────────────────────────────────────────────
# CONFIG — replace with your actual values
# ─────────────────────────────────────────────
SUPABASE_URL  = "YOUR_SUPABASE_URL"       # e.g. https://xyzxyz.supabase.co
SUPABASE_KEY  = "YOUR_SUPABASE_ANON_KEY"  # anon public key

MQTT_BROKER   = "localhost"               # HiveMQ on this laptop
MQTT_PORT     = 1883
MQTT_TOPIC    = "results/data"
# ─────────────────────────────────────────────

# Supabase REST endpoint for the results table
SUPABASE_ENDPOINT = f"{SUPABASE_URL}/rest/v1/results"

# Headers required by Supabase REST API
HEADERS = {
    "apikey":        SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "return=minimal"
}


def insert_to_supabase(row: dict):
    """Insert a row into Supabase using plain HTTP POST."""
    response = requests.post(SUPABASE_ENDPOINT, headers=HEADERS, json=row)
    if response.status_code in (200, 201):
        print(f"✅ Inserted → pollution_score={row.get('pollution_score')}  risk={row.get('risk')}")
    else:
        print(f"⚠️  Supabase error {response.status_code}: {response.text}")


# ── MQTT callbacks ────────────────────────────

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"✅ Connected to HiveMQ at {MQTT_BROKER}:{MQTT_PORT}")
        client.subscribe(MQTT_TOPIC)
        print(f"   Subscribed to '{MQTT_TOPIC}' — waiting for Pi data...")
    else:
        print(f"⚠️  MQTT connection failed — code {rc}")


def on_message(client, userdata, msg):
    try:
        data = json.loads(msg.payload.decode())
        print(f"\n📥 Received: pollution_score={data.get('pollution_score')}  risk={data.get('risk')}")

        row = {
            "timestamp":                 data.get("timestamp"),
            "vehicle_type":              data.get("vehicle_type"),
            "rpm":                       data.get("rpm"),
            "speed":                     data.get("speed"),
            "coolant":                   data.get("coolant"),
            "load":                      data.get("load"),
            "stft":                      data.get("stft"),
            "ltft":                      data.get("ltft"),
            "lambda":                    data.get("lambda"),
            "o2_upstream":               data.get("o2_upstream"),
            "o2_downstream":             data.get("o2_downstream"),
            "fuel_trim_score":           data.get("fuel_trim_score"),
            "lambda_stability_score":    data.get("lambda_stability_score"),
            "catalyst_efficiency_score": data.get("catalyst_efficiency_score"),
            "combustion_score":          data.get("combustion_score"),
            "aftertreatment_score":      data.get("aftertreatment_score"),
            "pollution_score":           data.get("pollution_score"),
            "risk":                      data.get("risk"),
        }

        insert_to_supabase(row)

    except json.JSONDecodeError as e:
        print(f"⚠️  Failed to decode message: {e}")
    except Exception as e:
        print(f"⚠️  Error: {e}")


def on_disconnect(client, userdata, rc):
    if rc != 0:
        print(f"⚠️  Unexpected disconnect (code {rc}) — will reconnect...")


# ── Main ──────────────────────────────────────

def main():
    client = mqtt.Client()
    client.on_connect    = on_connect
    client.on_message    = on_message
    client.on_disconnect = on_disconnect

    print(f"Connecting to HiveMQ at {MQTT_BROKER}:{MQTT_PORT} ...")
    client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
    client.loop_forever()


if __name__ == "__main__":
    main()
