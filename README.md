# Bakos emlékverseny MVP

Többjátékos, session-alapú definíciós társasjáték Node.js + Express + Socket.IO + Redis alapon.

## NUC telepítés és frissítés

Előfeltétel: Docker, Git, Bash, működő k3s, `redis-service` és ingress.

```bash
cd ~/codes/bakos-game-mvp
git pull --ff-only
KUBECTL='sudo k3s kubectl' ./update.sh --target nuc --dry-run
KUBECTL='sudo k3s kubectl' ./update.sh --target nuc
```

Erőforrások: `bakos-game` Deployment, `bakos-game-service:8105`; publikus útvonal `/bakos/`, Socket.IO útvonal `/bakos/socket.io`. A frissítés előtti manifestek: `~/.local/state/nicqx-apps/nuc/bakos-game/`.

Ellenőrzés:

```bash
sudo k3s kubectl get pod,service -n default -l app=bakos-game -o wide
sudo k3s kubectl logs deployment/bakos-game -n default --tail=50
curl -fsSI https://pmqxyz.hopto.org/bakos/ | head -n 1
curl -fsS 'https://pmqxyz.hopto.org/bakos/socket.io/?EIO=4&transport=polling'
```

## Migráció, rollback és eltávolítás

A konténer állapotmentes; a játékmenetek a közös Redisben vannak (3 órás TTL). Az új gépen előbb a `redis` repo eljárásával migráld az adatokat, majd futtasd ezt az update-et. Külön PVC nincs.

```bash
# ideiglenes leállítás / indítás
sudo k3s kubectl scale deployment/bakos-game -n default --replicas=0
sudo k3s kubectl scale deployment/bakos-game -n default --replicas=1

# rollback a frissítéskor kiírt mentésből
sudo k3s kubectl apply -f /teljes/ut/korabbi-manifest.yaml
sudo k3s kubectl rollout status deployment/bakos-game -n default --timeout=180s

# eltávolítás; Redis-adatot és ingress-szabályt nem töröl
sudo k3s kubectl delete deployment/bakos-game service/bakos-game-service -n default
```

## Funkciók

- 5 számjegyű session kód
- névvel csatlakozás
- lobby lezárása / játék indítása hosttal
- automatikus körgazda-sorrend
- szó + valódi definíció megadása
- kamu definíciók beküldése
- közös, Redisben tárolt kevert sorrend
- saját válaszra nem lehet szavazni
- körgazda nem szavaz
- pontozás
- `(közel) jó válasz` bónusz
- következő kör
- ponttábla
- 3 órás Redis TTL
- TTL hosszabbító gomb
- kilépés
- bármelyik játékos eltávolíthat másik játékost
- böngészőalapú felolvasás
- többnyelvű kezelőfelület: magyar / angol / német
- mobilos szövegmező-megőrzés automatikus frissítéseknél
- körgazdának backendből adott 5 random szójavaslat valódi definícióval
- Kubernetes Deployment + Service + Ingress

## Lokális futtatás Docker nélkül

Redis kell hozzá. Példa:

```bash
export REDIS_URL=redis://localhost:6379
export PORT=8105
npm install
npm start
```

Megnyitás:

```text
http://localhost:8105/bakos/
```

## Raspberry Pi / k3s build és import

A projekt gyökerében:

```bash
docker build --no-cache -t bakos-game:1.0.0 .
docker save bakos-game:1.0.0 -o bakos-game_1_0_0.tar
sudo k3s ctr images import bakos-game_1_0_0.tar
```

Telepítés:

```bash
kubectl apply -f k8s/bakos-game.yaml
kubectl apply -f k8s/bakos-ingress.yaml
```

Ellenőrzés:

```bash
kubectl get pods -l app=bakos-game
kubectl get svc bakos-game-service
kubectl get ingress bakos-game-ingress
kubectl logs deployment/bakos-game
```

Elérés:

```text
https://pmqxyz.hopto.org/bakos/
```

## Landing page integráció

A `landing-page-snippet.html` fájlban van egy egyszerű beilleszthető blokk:

```html
<section class="game-card">
  <h2>Bakos emlékverseny</h2>
  <p>Kamu definíciók, valódi idegen szavak és sok nevetés.</p>
  <a class="button" href="/bakos/">Új / belépés</a>
</section>
```

## Többnyelvű felület

A felület nyelve a jobb felső nyelvválasztóval állítható. Jelenleg támogatott:

- Magyar
- English
- Deutsch

A választás böngészőnként `localStorage`-ben tárolódik. Csak a kezelőfelület fordul; a játékosok által beírt szavak, definíciók, kamu válaszok és nevek érintetlenek maradnak.

A böngészőalapú felolvasás a kiválasztott felületi nyelvhez próbál hangot választani. Ha nincs ilyen hang, a böngésző alapértelmezett hangját használja.


## Szójavaslatok

A körgazda a szóbeviteli képernyőn 5 véletlen szójavaslatot kap valódi definícióval. A javaslatok a backendből érkeznek, ezért a többi játékos böngészője nem kapja meg előre a valódi definíciókat.

A körgazda használhatja a `Újabb 5 szó` gombot, vagy bármikor írhat saját szót és saját definíciót.

## Mobilos beírásvédelem

A frontend a még be nem küldött mezők tartalmát lokálisan megőrzi. Így ha a Socket.IO állapotfrissítés újrarajzolja a felületet, a `Szó`, `Valódi definíció` és `Kamu definíció` mezők tartalma nem tűnik el gépelés közben.

## Fontos env változók

| Név | Alapérték | Jelentés |
|---|---:|---|
| `PORT` | `8105` | App port |
| `BASE_PATH` | `/bakos` | Ingress alatti útvonal |
| `REDIS_URL` | `redis://redis-service:6379` | Redis kapcsolat |
| `SESSION_TIMEOUT` | `10800` | Session TTL másodpercben |
| `MIN_PLAYERS` | `3` | Minimum aktív játékosszám |
| `MAX_PLAYERS` | `20` | Maximum aktív játékosszám |
| `ENABLE_SOCKET_REDIS_ADAPTER` | `false` | Több podos Socket.IO adapter |

## Több podos működés később

MVP-ben `replicas: 1` van beállítva.

Ha később több replica kell:

1. `replicas` értékét növelni kell.
2. `ENABLE_SOCKET_REDIS_ADAPTER=true` legyen.
3. Redisnek stabilan elérhetőnek kell lennie.
4. Érdemes ellenőrizni Traefik WebSocket működést `/bakos/socket.io` alatt.

## Jogi/szótár megjegyzés

A játék nem tartalmaz beépített Bakos-szótár adatbázist. A körgazda kézzel is megadhatja a szót és a valódi definíciót. Az MVP tartalmaz egy kisebb, általános idegen szavas szójavaslat-listát, amely nem Bakos-szótárból származik.


## Build note

The Dockerfile supports both builds with and without `package-lock.json`. If a lockfile exists it uses `npm ci`; otherwise it uses `npm install --omit=dev --no-audit --no-fund`.
