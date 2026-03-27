# SemesterApp 📅

Lokalt semesterönskeverktyg – körs på ditt jobbsnätverk via Docker Compose.  
Lämplig att installera på en **Raspberry Pi** (arm64) eller valfri Linux-server.

## Funktioner
- 📅 **Kalender-grid** för Juni, Juli, Augusti – välj år via dropdown
- 👤 **Lägg till eget namn** (ingen inloggning) – inga dubletter via `UNIQUE`-constraint
- ✅ **Toggla ledigt** – klicka på en dag för att markera/avmarkera semester
- 🗓 **ISO-veckonummer** visas i header
- 🎉 **Svenska röda dagar** markeras automatiskt (inkl. rörliga helgdagar)
- 🌸 **Midsommarafton** behandlas som röd dag (fredagen 19–25 juni)
- 🟰 **Helger** (lördag/söndag) markeras visuellt

---

## Snabbstart med Docker Compose

### Förutsättningar
- [Docker](https://docs.docker.com/get-docker/) + [Docker Compose](https://docs.docker.com/compose/install/) installerat

### 1. Klona / ladda ner repot

```bash
git clone https://github.com/lavemange/Semesterapp.git
cd Semesterapp
```

### 2. Konfigurera miljövariabler (valfritt)

```bash
cp .env.example .env
# Redigera .env om du vill byta lösenord eller port
```

### 3. Bygg och starta

```bash
docker compose up --build -d
```

> Första bygget tar 2–5 minuter (Nuxt kompileras).

### 4. Öppna appen

```
http://localhost:3000
```

Alla på samma Wi-Fi kan nå appen via serverns IP:

```
http://<SERVER-IP>:3000
```

### 5. Stoppa

```bash
docker compose down
```

Data sparas i Docker-volymen `mysql_data` och finns kvar vid omstart.

---

## Installation på Raspberry Pi

### Förutsättningar
- Raspberry Pi 4 eller 5 (rekommenderas), 2 GB RAM+
- **64-bit Raspberry Pi OS** (Bookworm eller liknande)
- Fast intern IP-adress (sätt statisk DHCP-lease i routern, se nedan)

### 1. Installera Docker på Pi:n

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Klona och starta (samma steg som ovan)

```bash
git clone https://github.com/lavemange/Semesterapp.git
cd Semesterapp
cp .env.example .env
docker compose up --build -d
```

### 3. Autostart vid omstart

Docker Compose-tjänsterna startar om automatiskt (``restart: unless-stopped``).  
För att säkerställa att Docker-daemon startar vid boot:

```bash
sudo systemctl enable docker
```

---

## Lokalt domännamn istället för IP

Istället för ``http://192.168.x.x:3000`` kan du använda ett snyggt domännamn på ditt lokala nät.

### Alternativ A – UniFi / Dream Router (Local DNS Records)

1. Logga in på din **UniFi Network Controller** (eller Dream Router UI).
2. Gå till **Settings → Networks** (eller **DNS**).
3. Under **Local DNS Records**, lägg till:
   - **Hostname:** ``semester.lan``
   - **IP:** Pi:ns statiska IP (t.ex. ``192.168.1.10``)
4. Spara. Nu kan alla på Wi-Fi surfa till ``http://semester.lan:3000``.

> **Sätt statisk DHCP-lease:** I UniFi → Clients → din Pi → "Fixed IP Address".

### Alternativ B – Pi-hole eller AdGuard Home (om du inte har UniFi DNS)

Installera Pi-hole på Pi:n och låt routern dela ut Pi-hole som DNS-server via DHCP:

```bash
curl -sSL https://install.pi-hole.net | bash
```

Lägg sedan till en **Local DNS Record** i Pi-hole:
- Domain: ``semester.lan``
- IP: ``127.0.0.1`` (eller Pi:ns IP om Pi-hole körs på annan maskin)

### Alternativ C – mDNS / Bonjour (enklast, men inte alltid pålitligt)

Sätt Pi:ns hostname:

```bash
sudo hostnamectl set-hostname semester
```

Sedan *kan* klienter nå den via ``http://semester.local`` (fungerar bäst på macOS/iOS).

---

## Arkitektur

```
┌─────────────────────────────────────────────┐
│  Docker Compose                             │
│                                             │
│  ┌──────────┐     ┌──────────┐              │
│  │  Nuxt 3  │────▶│ Express  │────▶ MySQL   │
│  │ :3000    │     │  :3001   │      :3306   │
│  └──────────┘     └──────────┘              │
└─────────────────────────────────────────────┘
```

- **Frontend (Nuxt 3)** på port 3000 – serverar UI och proxar `/api/*`-anrop till backend
- **Backend (Express)** på port 3001 – REST API (employees + requests)
- **MySQL 8** – data lagras i Docker-volym

### API-endpoints

| Method | Path | Beskrivning |
|--------|------|-------------|
| GET | `/api/employees` | Hämta alla anställda |
| POST | `/api/employees` | Skapa anställd (om inte finns) |
| GET | `/api/requests?from=&to=` | Hämta semesterönskemål för period |
| POST | `/api/requests/toggle` | Toggla en dag för en anställd |

---

## Miljövariabler (`.env`)

| Variabel | Standard | Beskrivning |
|----------|---------|-------------|
| `MYSQL_ROOT_PASSWORD` | `rootpassword` | MySQL root-lösenord |
| `MYSQL_DATABASE` | `semesterapp` | Databasnamn |
| `MYSQL_USER` | `semesterapp` | DB-användare |
| `MYSQL_PASSWORD` | `semesterpassword` | DB-lösenord |
| `CORS_ORIGIN` | `*` | Tillåtna CORS-origins till backend |

---

## Uppdatera appen

```bash
git pull
docker compose up --build -d
```

## Säkerhetskopiering av data

```bash
# Exportera databasen
docker compose exec mysql mysqldump -u semesterapp -psemesterpassword semesterapp > backup.sql

# Återställ
docker compose exec -T mysql mysql -u semesterapp -psemesterpassword semesterapp < backup.sql
```
