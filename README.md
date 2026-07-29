# HepAntalya Wallet

HepAntalya; Antalya'daki bireysel kullanıcıların, QR ve fiziksel NFC kartıyla ödeme
yapabildiği, işletmelerin ise aynı uygulama içinden ödeme alabildiği uçtan uca bir mobil
cüzdan uygulamasıdır.

Backend NestJS ve Prisma ile geliştirilir, finansal source of truth Supabase PostgreSQL'dir.
Mobil uygulama React Native Expo Development Build kullanır ve finans tablolarına doğrudan yazmaz.

## Production

- Public API: `https://http--hepantalya-api--wxsy4676lspg.code.run/api`
- Health: `https://http--hepantalya-api--wxsy4676lspg.code.run/api/health`
- Container: `ghcr.io/egee145/hepantalya-wallet-api:1.2.0`
- Android release:
  [HepAntalya-v1.2.0-production.apk](https://github.com/egee145/hepantalya-wallet/releases/download/v1.2.0/HepAntalya-v1.2.0-production.apk)

Production APK public HTTPS API ve Supabase PostgreSQL ile çalışır. Uygulamayı kuran kullanıcı için
Node.js, Docker, ADB reverse, aynı Wi-Fi ağı veya geliştirici bilgisayarı gerekmez. Android güvenlik
ayarı nedeniyle GitHub'dan indirilen APK'nın kurulmasına bir defaya mahsus izin verilmesi gerekebilir.
NFC özelliği NFC destekli ve NFC'si açık fiziksel Android cihaz gerektirir.

## Öne çıkan özellikler

- Tek uygulamada **Bireysel** ve **Kurumsal** hesap oluşturma/giriş akışları
- Modern, erişilebilir ve role göre özelleşen mobil arayüz
- Bireysel cüzdan bakiyesi, işlem geçmişi ve anlık bakiye yenileme
- Kullanıcı onayıyla fiziksel NFC kartını hesaba tanımlama veya başka hesaptan devralma
- Kart devrinde eski sahibine kalıcı uygulama içi uyarı ve cihaz push bildirimi
- Uygulama kapalıyken NFC kart ödemesi için tutarlı push bildirimi; dokununca işlem geçmişini açma
- Merchant tarafında ortak Payment Session üzerinden NFC veya QR ile ödeme alma
- Kullanıcı tarafında kamera ile QR tarama, detay görüntüleme ve açık ödeme onayı
- Gerçek ödeme kuruluşuna bağlanmayan, açıkça **demo** olarak işaretlenmiş mock bakiye yükleme
- Decimal para modeli, atomik transfer, idempotency ve gerçek concurrency koruması
- Varsayılan Türkçe arayüz ve Ayarlar'dan Türkçe/İngilizce dil seçimi
- JWT access/refresh rotation, role authorization, rate limiting ve güvenli log redaction
- Docker, Supabase migration, GitHub Actions ve fiziksel Android kabul akışları

> Mock bakiye yükleme yalnız case/demo amacıyla geliştirilmiştir. Kart biçimi ve tutar
> doğrulanır; gerçek provizyon yapılmaz. Tam kart numarası ve CVV veritabanında veya loglarda
> saklanmaz.

## Mobil deneyim

| Varsayılan Türkçe                                                                          | Kalıcı English seçeneği                                                                     |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| <img src="docs/screenshots/login-tr.png" alt="HepAntalya Türkçe giriş ekranı" width="320"> | <img src="docs/screenshots/login-en.png" alt="HepAntalya English login screen" width="320"> |

| Bireysel cüzdan                                                                                       | Mock top-up sonucu                                                                                     |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| <img src="docs/screenshots/wallet-home.png" alt="HepAntalya bireysel cüzdan ana sayfası" width="320"> | <img src="docs/screenshots/topup-success.png" alt="HepAntalya mock bakiye yükleme sonucu" width="320"> |

| Fiziksel Android kamera ile gerçek QR ödeme kabulü                                                      |
| ------------------------------------------------------------------------------------------------------- |
| <img src="docs/screenshots/qr-payment-success.png" alt="HepAntalya QR ödeme başarı sonucu" width="320"> |

## Mimari

```text
mobile (Expo)
  ├─ PERSONAL / USER ── QR payment, NFC card, top-up, history
  └─ BUSINESS / MERCHANT ── session, QR display, NFC receive, history
                 │
                 ▼ JWT + REST / authenticated WebSocket
backend (NestJS modular monolith)
  ├─ auth / users / merchant / wallet
  ├─ payment session / execution / idempotency / gateway
  └─ Prisma interactive transactions
                 │
                 ▼
Supabase PostgreSQL / local PostgreSQL 17
```

Para alanları PostgreSQL `NUMERIC(18,2)` ve Prisma Decimal kullanır. NFC ve QR ödemeleri
aynı `PaymentExecutionService` içinde Serializable transaction, session/wallet lock,
koşullu debit ve unique constraint ile korunur.

Repository:

```text
backend/                  NestJS API ve Prisma
mobile/                   Expo Android/iOS uygulaması
backend/prisma/migrations Versionlanmış database migration'ları
docs/                     Kararlar, gereksinim matrisi ve doğrulama kanıtları
.github/workflows/ci.yml  Tekrarlanabilir kalite kapıları
docker-compose.yml        Local backend ve PostgreSQL 17
```

## Ön koşullar

- Node.js `24.18.0`
- pnpm `11.9.0`
- Docker Desktop veya PostgreSQL 17
- Native Android için Android Studio, JDK 21 ve Android SDK 36
- Gerçek NFC kabulü için NFC destekli fiziksel Android cihaz

## Hızlı başlangıç

```powershell
pnpm install --frozen-lockfile
Copy-Item backend/.env.example backend/.env
Copy-Item mobile/.env.example mobile/.env
docker compose up -d postgres-dev
pnpm prisma:generate
pnpm --filter @hepantalya/backend prisma:migrate:deploy
pnpm --filter @hepantalya/backend start:dev
```

Başka bir terminalde:

```powershell
pnpm --filter @hepantalya/mobile start:dev-client
```

Migration için `DIRECT_URL`, runtime için least-privilege `DATABASE_URL` kullanılır.
Gerçek `.env` dosyaları ve credential'lar Git'e eklenmez.

### Docker ile backend

```powershell
docker compose up --build postgres-dev backend
Invoke-RestMethod http://127.0.0.1:3000/api/health
```

Portlar backend `3000`, development PostgreSQL `5433`, test PostgreSQL `5434` şeklindedir.
Migration container başlangıcında otomatik çalıştırılmaz; release job önce
`prisma migrate deploy`, sonra backend rollout yapmalıdır.

## Mobil ortamlar

Temel public değişkenler:

```text
EXPO_PUBLIC_API_BASE_URL
EXPO_PUBLIC_WS_BASE_URL
EXPO_PUBLIC_APP_ENV
EXPO_PUBLIC_ENABLE_NFC_DIAGNOSTICS
EXPO_PUBLIC_USE_MOCK_NFC
EXPO_PUBLIC_EAS_PROJECT_ID
```

`EXPO_PUBLIC_*` değerleri mobil bundle içinde görülebilir; bu değişkenlere secret yazılmaz.
Production profile HTTPS API/WS URL'si ister, NFC diagnostics ve mock adapter'ı reddeder.

Android Emulator yerel backend'e `10.0.2.2` ile ulaşır. USB cihaz:

```powershell
adb devices -l
adb reverse tcp:3000 tcp:3000
adb reverse tcp:8081 tcp:8081
pnpm --filter @hepantalya/mobile android
```

Expo Go native NFC modülünü içermez; Development Build kullanılmalıdır. Android Emulator
fiziksel bir NFC okuyucuyu cihaza bağlanmadan NFC okuyamaz, bağlansa da sonuçlar kararlı olmayabilir.

Uygulama QR ekranı ilk açıldığında Android kamera iznini kendisi ister. İzin kalıcı olarak
reddedilmişse uygulama ayarlarına yönlendirir. NFC kapalıysa ham native hata göstermek yerine
NFC'nin kapalı olduğunu açıklar ve doğrudan Android NFC ayarlarını açan bir düğme sunar.
Kart tanımlama sırasında okutulan tag salt okunur veya yazılabilir NDEF kart değilse kullanıcıya
uygun ve anlaşılır uyarı gösterilir; kart silinmez, formatlanmaz veya read-only yapılmaz.
Başka bir hesaba bağlı kart önce yalnız okunur; kullanıcıya bakiyelerin değişmeyeceğini açıklayan
ayrı bir devir onayı gösterilmeden kart içeriği veya backend sahipliği değiştirilmez.

## Hesap akışları

### Bireysel

`PERSONAL` kayıt backend tarafından `USER` rolüne dönüştürülür; User ve wallet tek database
transaction'ında oluşur. Kullanıcı:

- bakiyesini ve geçmişini görür,
- demo formuyla mock bakiye yükler,
- açık onay sonrası NFC kartına kendi canonical User UUID'sini yazar ve kartı hesabına bağlar,
- başka hesaba bağlı bir kartı ayrı uyarı ve onay sonrasında, bakiyeleri değiştirmeden devralır,
- merchant QR kodunu tarayıp onaylayarak ödeme yapar.

### Kurumsal

`BUSINESS` kayıt backend tarafından `MERCHANT` rolüne dönüştürülür; User, merchant wallet ve
Merchant kaydı tek transaction'da oluşur. Merchant:

- tutar girip 120 saniyelik Payment Session açar,
- yalnız session UUID içeren QR gösterir,
- aynı session için gerçek NFC kartını dinler,
- ödeme sonucunu ve yeni bakiyeyi anında görür.

Client doğrudan rol seçemez; yalnız ürün seviyesindeki `PERSONAL` veya `BUSINESS` account
type gönderir. Giriş ekranında yanlış hesap türü seçilirse backend rol eşleşmesini reddeder.

## Mock bakiye yükleme

Endpoint:

```http
POST /api/wallet/top-up/mock
Authorization: Bearer <USER access token>
Idempotency-Key: <UUID>
Content-Type: application/json
```

Demo formu `XXX`, `1111 1111 1111 1111`, `01/11`, `111` gibi biçimsel olarak geçerli
test verisini kabul eder. Gerçek banka provizyonu veya Luhn kontrolü yapmaz. Şunları reddeder:

- sıfır, negatif veya maksimum üzeri tutar,
- tutar alanında yazı, `NaN`, `Infinity`,
- ikiden fazla ondalık,
- 13–19 hane dışında kart numarası,
- geçersiz `AA/YY` biçimi,
- 3/4 hane dışında CVV.

İşlem atomik, idempotent ve audit kayıtlıdır. Veritabanına yalnız kartın son dört hanesi ile
kart üzerindeki isim kaydedilir; tam kart ve CVV response'a, loga veya database'e yazılmaz.

## NFC kart eşleme ve ödeme

Kart tanımlama yalnız kullanıcı uygulamadaki açık onay penceresini kabul ettikten sonra
başlatılır. Uygulama:

1. kartı değiştirmeden okuyup tag sahipliğini backend'den kontrol eder,
2. kart başka bir hesaba bağlıysa bakiyelerin değişmeyeceğini belirten ayrı devir onayı ister,
3. onaydan sonra aynı fiziksel kartı tekrar doğrular,
4. kullanıcının canonical UUID'sini tek NFC Forum Text record olarak yazar,
5. sonucu aynı anda yeniden okuyup doğrular,
6. fiziksel tag UID'sinin yalnız SHA-256 hash'ini backend'e kaydeder.

Kart formatlanmaz, silinmez, salt-okunur yapılmaz. Mevcut NDEF kaydı yeni User UUID record'u
ile değiştirilir. Devir backend'de Serializable transaction ile atomiktir: eski kullanıcının
kart eşlemesi kaldırılır, kart yeni kullanıcıya geçer; iki kullanıcının wallet bakiyesi ve finansal
geçmişi değişmez. Bir fiziksel tag aynı anda yalnız bir kullanıcıya bağlıdır.

Devir commit edildiğinde eski sahip için kalıcı bir `UserNotification` oluşturulur. Uygulama
açıldığında uyarı gösterilir; kullanıcı kapattığında dismiss hem cihazda hem backend'de saklanır ve
aynı uyarı yeniden gösterilmez. Aktif push token varsa cihaz bildirimi de commit sonrasında gönderilir.

Ödemede kartın User UUID payload'ı ve kayıtlı tag hash'i birlikte doğrulanır. Tag UID tek
başına ödeme kimliği değildir. Statik UUID kartının kopyalanabilir olduğu bilinen bir v1
güvenlik sınırıdır; production hardening için PIN/biometric veya kriptografik güvenlik önlemleri olan kart gerekir.

Başarılı NFC ödemesinde finansal transaction ile aynı atomik sınırda tek bir bildirim/outbox kaydı
oluşur. Harici Expo Push çağrısı commit sonrasında yapılır; push servisindeki hata ödemeyi geri almaz.
Bildirim dokunma verisi yalnız uygulama içi `UserHistory` route'u ve transaction kimliği taşır.

## QR ödeme

Merchant QR payload'ı yalnız Payment Session UUID'sidir; amount, Merchant/User ID, JWT veya
JSON taşımaz. Kullanıcı `expo-camera` ile QR'ı tarar, merchant ve tutarı backend'den yeniden
alır, uygun görürse açıkça onaylar. Payer User ID JWT subject'inden çözülür.

## API özeti

Bütün yollar `/api` prefix'i altındadır:

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
POST /admin/merchants
GET  /users/me
GET  /users/:id
GET  /wallet/me
GET  /wallet/history
GET  /wallet/card
POST /wallet/card/inspect
POST /wallet/card
GET  /wallet/top-ups
POST /wallet/top-up/mock
POST /wallet/deposit
GET  /merchant/me
GET  /merchant/transactions
POST /payments/session
GET  /payments/session/:id
POST /payments/session/:id/cancel
POST /payments/nfc
POST /payments/qr
POST /notifications/devices
DELETE /notifications/devices
GET  /notifications/unread
POST /notifications/:id/dismiss
GET  /health
```

Finansal mutation'lar UUID `Idempotency-Key` ister. NFC payment body
`paymentSessionId`, karttan okunan `userId` ve `tagUid` taşır; merchant JWT'den, tutar
session'dan alınır. QR payer JWT subject'inden alınır.

## Supabase ve Prisma

- Supabase yalnız yönetilen PostgreSQL sağlayıcısıdır; Supabase Auth kullanılmaz.
- `wallet_app` şeması versionlanmış Prisma migration'larıyla yönetilir.
- Mobil uygulamaya database credential verilmez.
- `DIRECT_URL` migration rolü, `DATABASE_URL` runtime rolü içindir.
- Remote bağlantıda TLS doğrulaması zorunludur.
- Paylaşılan database üzerinde `db push` veya destructive reset kullanılmaz.
- Transaction ledger database trigger'ıyla UPDATE/DELETE işlemlerine kapalıdır.

## Kalite kapıları

```powershell
pnpm install --frozen-lockfile
pnpm format:check
pnpm prisma:validate
pnpm prisma:generate
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm test:concurrency
pnpm build
pnpm mobile:doctor
pnpm mobile:export
```

Integration ve concurrency testleri adı `test` içeren ayrı bir PostgreSQL database ister:

```powershell
$env:TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5434/hepantalya_test?schema=wallet_app'
pnpm test:integration
pnpm test:concurrency
```

Test harness development/production database'i üzerinde yanlışlıkla işlem yapmamak için database
adında `test` sözcüğünü zorunlu tutar. Mevcut suite 80 test içerir:

- 20 backend unit
- 41 mobile unit/service
- 13 gerçek PostgreSQL integration
- 6 gerçek paralel HTTP concurrency

## APK ve store build

Local cihaz için release bundle:

```powershell
$env:EXPO_PUBLIC_APP_ENV='preview'
$env:EXPO_PUBLIC_API_BASE_URL='http://127.0.0.1:3000/api'
$env:EXPO_PUBLIC_WS_BASE_URL='http://127.0.0.1:3000/payments'
pnpm --filter @hepantalya/mobile exec expo prebuild --clean --platform android --no-install
Set-Location mobile/android
./gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a
```

Bu preview paket USB `adb reverse tcp:3000 tcp:3000` ile local backend'i kullanır. Store
yayını için HTTPS backend URL'leri tanımlanmalı ve EAS production profile ile imzalı AAB
üretilmelidir:

```powershell
eas build --platform android --profile production
```

Production signing key, Firebase service-account anahtarı ve deployment secret'ları repository'ye
eklenmez. `google-services.json` gizli anahtar içermez; Android uygulama kimliğini FCM projesine
bağlayan native build girdisidir.

## Security

- Helmet, explicit CORS allowlist, body limit ve auth/payment rate limitleri
- DTO whitelist ve bilinmeyen alan reddi
- Argon2id password hash
- Kısa ömürlü JWT access token, hash'li refresh rotation/reuse detection
- Parameter-bound raw SQL
- Request ID, structured logging ve secret/card/CVV redaction
- Immutable ledger, negatif bakiye check constraint'i ve session başına tek SUCCESS

Detaylı kararlar [architecture decisions](docs/architecture/decisions.md), güncel test/cihaz
kanıtları [verification report](docs/environment-inventory.md) ve kapsam eşlemesi
[requirements matrix](docs/requirements-matrix.md) içinde bulunur.
