# GeoTerra Agent Server - Upute za pokretanje

## 📍 Gdje se nalaze fajlovi?

Ovi fajlovi su u tvom projektu:
- `docs/agent-server/agent_server.py`
- `docs/agent-server/start_agent.bat`
- `docs/agent-server/requirements.txt`

## 🚀 Kako pokrenuti?

### Korak 1: Kopiraj fajlove

Kopiraj **SVE** fajlove iz `docs/agent-server/` u `D:\agent-workspace\`:

```
D:\agent-workspace\
  ├── agent_server.py
  ├── start_agent.bat
  └── requirements.txt
```

### Korak 2: Instaliraj pakete

Otvori Command Prompt i upiši:

```bash
cd D:\agent-workspace
pip install -r requirements.txt
```

### Korak 3: Pokreni server

Možeš koristiti **BAT skriptu** (najlakše):

```bash
cd D:\agent-workspace
start_agent.bat
```

Ili **ručno**:

```bash
cd D:\agent-workspace
python agent_server.py
```

### Korak 4: Pokreni ngrok (DRUGI prozor!)

Otvori **novi** Command Prompt i upiši:

```bash
ngrok http 8432
```

### Korak 5: Kopiraj ngrok URL

Kad ngrok pokreneš, vidjet ćeš nešto kao:

```
Forwarding   https://abc123.ngrok.io -> http://localhost:8432
```

Kopiraj taj `https://abc123.ngrok.io` URL i javi Lovable supportu da ga postavi kao `AGENT_SERVER_URL` secret.

## ✅ Provjera

Server radi ako vidiš:

```
╔══════════════════════════════════════════════════════╗
║        GeoTerra Agent Server v1.0                    ║
╠══════════════════════════════════════════════════════╣
║  Workspace:  D:\agent-workspace                      ║
...
```

---

**Ostavi oba prozora (agent + ngrok) otvorena dok koristiš Stellana!**
