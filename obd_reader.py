import serial, time, subprocess, sys

MAC     = "01:23:45:67:89:BA"
CHANNEL = 2
PORT    = "/dev/rfcomm0"

def rfcomm_connect():
    subprocess.run(["sudo", "rfcomm", "release", "0"], capture_output=True)
    time.sleep(1)
    subprocess.Popen(["sudo", "rfcomm", "connect", "0", MAC, str(CHANNEL)],
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(4)

def open_serial():
    return serial.Serial(PORT, baudrate=38400, timeout=5)

def setup_elm(ser):
    send_cmd(ser, 'ATZ', wait=3)
    time.sleep(2)
    send_cmd(ser, 'ATE0')
    send_cmd(ser, 'ATL0')
    send_cmd(ser, 'ATH0')
    send_cmd(ser, 'ATSP0')
    send_cmd(ser, 'ATAT1')
    send_cmd(ser, 'ATST64')

def send_cmd(ser, cmd, wait=2):
    try:
        ser.flushInput()
        ser.write((cmd + '\r').encode())
        response = b''
        start = time.time()
        while time.time() - start < wait:
            if ser.in_waiting:
                response += ser.read(ser.in_waiting)
                if b'>' in response:
                    break
            time.sleep(0.05)
        return response.decode(errors='ignore').strip()
    except:
        return ""

def get_val(raw, pid_byte):
    try:
        parts = raw.replace('>', '').strip().split()
        idx = parts.index(pid_byte)
        return parts[idx+1:]
    except:
        return None

def decode_rpm(raw):
    v = get_val(raw, '0C')
    if v and len(v) >= 2:
        return (int(v[0], 16) * 256 + int(v[1], 16)) / 4
    return None

def decode_speed(raw):
    v = get_val(raw, '0D')
    return int(v[0], 16) if v else None

def decode_coolant(raw):
    v = get_val(raw, '05')
    return int(v[0], 16) - 40 if v else None

def decode_load(raw):
    v = get_val(raw, '04')
    return round(int(v[0], 16) * 100 / 255, 1) if v else None

def decode_stft(raw):
    v = get_val(raw, '06')
    return round((int(v[0], 16) - 128) * 100 / 128, 2) if v else None

def decode_ltft(raw):
    v = get_val(raw, '07')
    return round((int(v[0], 16) - 128) * 100 / 128, 2) if v else None

def decode_o2_upstream(raw):
    v = get_val(raw, '14')
    if v and len(v) >= 2:
        return int(v[0], 16) / 200, (int(v[1], 16) - 128) * 100 / 128
    return None, None

def decode_o2_downstream(raw):
    v = get_val(raw, '15')
    if v and len(v) >= 2:
        return int(v[0], 16) / 200
    return None

def decode_lambda(raw):
    v = get_val(raw, '24')
    if v and len(v) >= 4:
        return round((int(v[0], 16) * 256 + int(v[1], 16)) * 2 / 65536, 4)
    return None

def calc_pollution_score(stft, ltft, lam, o2_up, o2_down,
                         load, rpm, coolant, vehicle_type):
    scores = {}

    if vehicle_type == 'petrol':
        if stft is not None and ltft is not None:
            scores['fuel_trim'] = max(0, round(100 - (abs(stft) + abs(ltft)) * 2, 1))
        if lam is not None:
            scores['lambda'] = max(0, round(100 - abs(lam - 1.0) * 1000, 1))
        elif o2_up is not None:
            scores['lambda'] = max(0, round(100 - abs(o2_up - 0.45) * 200, 1))
        if o2_up is not None and o2_down is not None and o2_up > 0:
            scores['catalyst'] = max(0, round(100 - (o2_down / o2_up) * 100, 1))
        if 'fuel_trim' in scores and 'lambda' in scores:
            scores['combustion'] = round(0.5 * scores['fuel_trim'] + 0.5 * scores['lambda'], 1)
        elif 'lambda' in scores:
            scores['combustion'] = scores['lambda']
        if 'catalyst' in scores and 'lambda' in scores:
            scores['aftertreatment'] = round(0.6 * scores['catalyst'] + 0.4 * scores['lambda'], 1)
        if 'combustion' in scores and 'aftertreatment' in scores:
            scores['final'] = round(0.6 * scores['combustion'] + 0.4 * scores['aftertreatment'], 1)
        elif 'combustion' in scores:
            scores['final'] = scores['combustion']

    else:  # diesel
        sub = []
        if load is not None:
            scores['load_score'] = max(0, round(100 - load, 1))
            sub.append((scores['load_score'], 0.4))
        if rpm is not None:
            if   rpm < 1000: rs = 95
            elif rpm < 2000: rs = 85
            elif rpm < 3000: rs = 70
            elif rpm < 4000: rs = 50
            else:            rs = 30
            scores['rpm_score'] = rs
            sub.append((rs, 0.3))
        if coolant is not None:
            if   coolant >= 80: ws = 100
            elif coolant >= 60: ws = 80
            elif coolant >= 40: ws = 60
            elif coolant >= 20: ws = 40
            else:               ws = 20
            scores['warmup_score'] = ws
            sub.append((ws, 0.3))
        if sub:
            total_w = sum(w for _, w in sub)
            scores['final'] = round(sum(s * w for s, w in sub) / total_w, 1)

    return scores

def rating(score):
    if score is None:  return "NO DATA"
    if score >= 80:    return "CLEAN    🟢"
    if score >= 60:    return "MODERATE 🟡"
    if score >= 40:    return "POOR     🟠"
    return                    "CRITICAL 🔴"

def read_loop(ser, vehicle_type):
    while True:
        try:
            rpm     = decode_rpm(send_cmd(ser, '010C'))
            speed   = decode_speed(send_cmd(ser, '010D'))
            coolant = decode_coolant(send_cmd(ser, '0105'))
            load    = decode_load(send_cmd(ser, '0104'))
            stft    = decode_stft(send_cmd(ser, '0106'))
            ltft    = decode_ltft(send_cmd(ser, '0107'))
            lam     = decode_lambda(send_cmd(ser, '0124'))
            o2_up_v, _ = decode_o2_upstream(send_cmd(ser, '0114'))
            o2_down = decode_o2_downstream(send_cmd(ser, '0115'))

            scores = calc_pollution_score(
                stft, ltft, lam, o2_up_v, o2_down,
                load, rpm, coolant, vehicle_type)

            print("\033[2J\033[H", end="")
            print("=" * 45)
            print("  CARBON EMISSION TRACKER — LIVE")
            print("=" * 45)
            print(f"  RPM          : {rpm or '---'}")
            print(f"  Speed        : {str(speed or '---')} km/h")
            print(f"  Coolant Temp : {str(coolant or '---')} C")
            print(f"  Engine Load  : {str(load or '---')} %")
            print(f"  STFT         : {str(stft or '---')} %")
            print(f"  LTFT         : {str(ltft or '---')} %")
            print(f"  Lambda       : {lam or '---'}")
            print(f"  O2 Upstream  : {str(o2_up_v or '---')} V")
            print(f"  O2 Downstream: {str(o2_down or '---')} V")
            print("-" * 45)
            if vehicle_type == 'petrol':
                print(f"  Fuel Trim    : {scores.get('fuel_trim', 'N/A')}")
                print(f"  Lambda Score : {scores.get('lambda', 'N/A')}")
                print(f"  Catalyst     : {scores.get('catalyst', 'N/A')}")
                print(f"  Combustion   : {scores.get('combustion', 'N/A')}")
                print(f"  Aftertreat   : {scores.get('aftertreatment', 'N/A')}")
            else:
                print(f"  Load Score   : {scores.get('load_score', 'N/A')}")
                print(f"  RPM Score    : {scores.get('rpm_score', 'N/A')}")
                print(f"  Warmup Score : {scores.get('warmup_score', 'N/A')}")
            print("=" * 45)
            final = scores.get('final')
            print(f"  SCORE : {final or 'N/A'}  —  {rating(final)}")
            print("=" * 45)
            print(f"  {vehicle_type.upper()}  |  Ctrl+C to stop")
            time.sleep(1)

        except Exception as e:
            print(f"[Read error: {e}]")
            raise

# ── Entry point ───────────────────────────────────────────
print("Starting Carbon Emission Tracker...")
print("  1 = Petrol")
print("  2 = Diesel")
choice = input("Enter 1 or 2: ").strip()
vehicle_type = 'diesel' if choice == '2' else 'petrol'
print(f"Vehicle: {vehicle_type.upper()}")

ser = None
while True:
    try:
        if ser is None or not ser.is_open:
            print("\n[Connecting to OBD2...]")
            rfcomm_connect()
            ser = open_serial()
            setup_elm(ser)
            print("[Connected! Reading data...]\n")
        read_loop(ser, vehicle_type)
    except KeyboardInterrupt:
        print("\nStopped.")
        if ser: ser.close()
        sys.exit(0)
    except Exception as e:
        print(f"[Connection lost: {e}]")
        print("[Reconnecting in 5 seconds...]")
        try:
            if ser: ser.close()
        except: pass
        ser = None
        time.sleep(5)


