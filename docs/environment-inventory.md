# Verification Report

Son doğrulama: 2026-07-29, Windows 11 x64, Europe/Istanbul.

## Araç zinciri

| Araç          | Doğrulanan sürüm/durum                      |
| ------------- | ------------------------------------------- |
| Git           | 2.55.0.windows.3                            |
| Node.js       | 24.18.0                                     |
| pnpm          | 11.9.0                                      |
| PostgreSQL    | Local/Docker 17 ve Supabase PostgreSQL 17.6 |
| Prisma        | 7.9.1 + `@prisma/adapter-pg`                |
| Java          | Android Studio JBR 21.0.7                   |
| Android SDK   | Platform/build-tools 36                     |
| Expo          | SDK 57, Expo Doctor 20/20                   |
| Android cihaz | Fiziksel TECNO CK7n, Android 14/API 34      |
| Docker        | Docker Desktop Linux engine ve Compose      |

Gerçek credential'lar yalnız ignored environment dosyalarında veya platform secret store'larında
tutulur. Supabase migration ve runtime rolleri ayrıdır; mobil bundle'a database credential
eklenmez.

## Production ortamı

- Public API:
  `https://http--hepantalya-api--wxsy4676lspg.code.run/api`
- Public health:
  `https://http--hepantalya-api--wxsy4676lspg.code.run/api/health`
- WebSocket namespace:
  `https://http--hepantalya-api--wxsy4676lspg.code.run/payments`
- Database: Supabase PostgreSQL, `wallet_app` şeması
- Runtime database rolü: least-privilege `wallet_backend`
- Backend container:
  `ghcr.io/egee145/hepantalya-wallet-api:1.2.0`
- Northflank container planı: `nf-compute-20`, tek instance

Public health kontrolü HTTP 200, `database: up`, geçerli TLS, HSTS, Helmet güvenlik
başlıkları, request ID ve rate-limit başlıkları döndürdü. Authenticated production
WebSocket bağlantısı gerçek bir WAITING session room'una katıldı; test session'ı daha sonra
CANCELLED durumuna getirildi. APK hiçbir ADB reverse, geliştirici bilgisayarı veya yerel ağ
bağımlılığı olmadan bu public endpoint'leri kullanır.

## Otomatik kalite kanıtı

- Frozen dependency install başarılı.
- Format check, ESLint ve TypeScript typecheck başarılı.
- Prisma validate/generate başarılı.
- Üç migration boş PostgreSQL 17 test database'ine uygulanıyor.
- Aynı üç migration Supabase production projesinde uygulanmış ve migration status günceldir.
- Backend unit: **20/20**.
- Mobile unit/service: **41/41**.
- PostgreSQL integration: **13/13**.
- Gerçek paralel HTTP concurrency: **6/6**.
- Toplam otomatik test: **80/80**.
- NestJS production build ve Expo Android export başarılı.
- Expo Doctor: **20/20**.
- Exact Node 24.18.0 multi-stage Docker image temiz build edildi.
- Backend container non-root `node` kullanıcısıyla çalışıyor ve healthcheck içeriyor.

Concurrency suite; aynı session için farklı/same key yarışlarını, NFC/QR yarışını, aynı
wallet'ın iki session'ını, yetersiz toplam bakiyeyi ve idempotency payload conflict'ini
kapsar. Her senaryoda balance, session, Transaction, PaymentAttempt ve IdempotencyRecord
sonucu doğrulanır.

## APK bütünlüğü

| Alan             | Değer                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| Dosya            | `HepAntalya-v1.2.0-production.apk`                                                                |
| Package          | `com.hepantalya.wallet`                                                                           |
| Version          | `1.2.0` / code `3`                                                                                |
| Min / target SDK | 24 / 36                                                                                           |
| Boyut            | 44,919,337 byte                                                                                   |
| SHA-256          | `CE19D5027084883A53F07059AA321FCB2658D2F8DA7A712C48E29A2807BF1363`                                |
| Signing          | APK Signature Scheme v2, RSA 4096                                                                 |
| Cert SHA-256     | `D4:B7:82:F3:ED:D0:06:71:CC:8D:EC:39:17:93:12:BE:28:65:5C:8D:F5:37:11:08:25:9A:3D:A0:1B:06:D3:D6` |

Manifest kamera, NFC, bildirim ve internet izinlerini içerir; production manifest'inde
`usesCleartextTraffic=false` değeridir. Bundle public production API/WS URL'sini içerir ve
`localhost`, `127.0.0.1:3000` veya `10.0.2.2` endpoint'i içermez. Paket/version, gerçek
production imza sertifikası ve Firebase Android kaynakları APK üzerinde doğrulanmıştır.

## Fiziksel Android kabulü

- Temiz kurulum varsayılan Türkçe açıldı.
- Türkçe/English seçimi uygulama yeniden açıldığında kalıcı kaldı.
- PERSONAL ve BUSINESS login/navigation akışları çalıştı.
- Mock top-up geçerli demo kart formunu kabul etti; negatif tutarı reddetti ve bakiye anında
  yenilendi. Tam kart numarası ve CVV saklanmadı.
- Kullanıcının açık izniyle yazılabilir fiziksel NFC-A/MIFARE Ultralight NDEF karta canonical
  production test User UUID'si yazıldı ve yeniden okunarak doğrulandı.
- Kart formatlanmadı, silinmedi veya read-only yapılmadı; tag UID yalnız hash'lenmiş biçimde
  backend'e gönderildi.
- Public production API üzerinde gerçek **50.00 TRY NFC ödeme** tamamlandı. User bakiyesi
  50.00 azaldı, merchant bakiyesi 50.00 arttı, session PAID oldu ve tek SUCCESS/NFC
  Transaction oluştu.
- Kullanıcı aynı kartı fiziksel olarak ikinci kez temas ettirdi; ikinci çekim oluşmadı.
- Fiziksel Android kamera ile yalnız Payment Session UUID içeren QR okutuldu; merchant/tutar
  onayı ve anlık sonuç/bakiye ekranı çalıştı.
- NFC sistemden kapatıldığında uygulama generic hata yerine açık Türkçe uyarı gösterdi.
  “NFC ayarlarını aç” düğmesi Android `NfcSettingsActivity` ekranını açtı; NFC daha sonra
  tekrar etkinleştirildi.
- Kamera izni temiz kurulumda `granted=false` iken QR ekranı Android izin penceresini otomatik
  açtı. “Uygulamayı kullanırken” onayından sonra izin `granted=true` oldu ve kamera
  önizlemesi başladı.

Mevcut fiziksel kart yazılabilir olduğu için salt-okunur/yazılamaz kart yolu o kartı kalıcı
olarak değiştirmeden fiziksel olarak tetiklenemez. Production kodu NDEF status sonucunu
`NFC_TAG_READ_ONLY` veya `NFC_TAG_NOT_WRITABLE` olarak ayırır; localized hata mapping'i unit
test ile doğrulanmıştır. Bu senaryonun ayrıca fiziksel kabulü için ayrı, yazılamaz bir test
kartı gerekir.

## Bilinen sınırlar

- Northflank deployment tek instance ve küçük başlangıç compute planındadır. Teknik olarak
  public production yapılandırmasıdır; yüksek trafik, çoklu-instance HA veya sözleşmeli SLA
  için kapasite/plan yükseltmesi ve Socket.IO Redis adapter gerekir.
- APK GitHub Release üzerinden imzalı sideload paketidir. Google Play listesi ve Play
  App Signing bu teslimin dışında kalır.
- Statik User UUID içeren NFC kart klonlanabilir; v1 case kriptografik kart kimliğini çözmez.
- Mock top-up gerçek ödeme kuruluşu veya banka provizyonu değildir.
- iOS NFC kabulü yapılmamıştır; v1 fiziksel NFC kabul hedefi Android'dir.

## Dependency audit notu

`pnpm audit --prod --audit-level high`, Expo/React Native/Jest araç zincirinin transitif
`minimatch → brace-expansion` yolunda `GHSA-mh99-v99m-4gvg` uyarısını raporlamaktadır.
Kod yolu production API'de veya uygulamanın kullanıcı girdisini işleyen runtime akışında
çalışmaz; bundler/test araçlarındadır. Eski `minimatch` major'larını uyumsuz bir
`brace-expansion` major'ına zorlayan global override uygulanmamıştır. Expo/React Native
uyumlu upstream güncellemesi çıktığında lockfile güncellenip audit yeniden çalıştırılmalıdır.
