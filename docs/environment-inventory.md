# Verification Report

Son doğrulama: 2026-07-28, Windows 11 x64, Europe/Istanbul.

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

Gerçek credential'lar yalnız ignored environment dosyalarında tutulur. Supabase migration
ve runtime rolleri ayrıdır; mobil bundle'a database credential eklenmez.

## Otomatik kalite kanıtı

- Frozen dependency install başarılı.
- Format check, ESLint ve TypeScript typecheck başarılı.
- Prisma validate/generate başarılı.
- İki migration boş PostgreSQL 17 database'ine baştan uygulanıp `migrate status` temiz
  doğrulandı; geçici database daha sonra silindi.
- Aynı iki migration Supabase development projesinde uygulanmış ve status günceldir.
- Least-privilege runtime rolü yeni NFC card/top-up tablolarını okuyabiliyor.
- Backend unit: **17/17**.
- Mobile unit/service: **31/31**.
- PostgreSQL integration: **12/12**.
- Gerçek paralel HTTP concurrency: **6/6**.
- Toplam otomatik test: **66/66**.
- NestJS production build ve Expo Android export başarılı.
- Expo Doctor: **20/20**.
- Android arm64 release bundle başarılı.
- APK package `com.hepantalya.wallet`, version `1.0.0`/code `1`, min SDK 24, target SDK 36.
- APK v2 imzası ve SHA-256 bütünlüğü doğrulandı.
- Exact Node 24.18.0 multi-stage Docker image temiz build edildi.
- Backend container non-root çalışıyor ve `/api/health` database `up` döndürüyor.

Concurrency suite; aynı session için farklı/same key yarışlarını, NFC/QR yarışını, aynı
wallet'ın iki session'ını, yetersiz toplam bakiyeyi ve idempotency payload conflict'ini
kapsar. Her senaryoda balance, session, Transaction, PaymentAttempt ve IdempotencyRecord
sonucu doğrulanır.

## Önceki fiziksel NFC/QR kanıtı

- Fiziksel kart NFC-A, MIFARE Ultralight ve NDEF olarak okundu.
- Kullanıcının açık izniyle eski URI record, yalnız canonical test User UUID içeren tek NFC
  Forum Text record ile değiştirildi.
- Kart formatlanmadı, silinmedi, salt-okunur yapılmadı ve UID değiştirilmedi.
- Record TNF/type/payload ve strict UUID parser sonucu kart uzaklaştırılıp yeniden
  okutularak doğrulandı.
- Gerçek 50 TRY NFC ödemesinde payer 100.00 → 50.00, merchant 0.00 → 50.00, session PAID,
  tek SUCCESS Transaction ve tek SUCCESS PaymentAttempt doğrulandı.
- Sonuç ekranındaki ikinci kart temasında yeni reader event veya ikinci çekim oluşmadı.
- Fiziksel Android kamera ile yalnız session UUID içeren QR okundu.
- Gerçek 5 TRY QR ödemesinde payer 50.00 → 45.00, merchant 50.00 → 55.00, session PAID ve
  tek QR SUCCESS Transaction doğrulandı.

## Bu release için fiziksel kabul

Final `1.0.0` APK fiziksel cihaza kurulmuştur. Aşağıdaki maddeler final UI kabul turunda
yeniden doğrulanır ve yalnız kanıtlandıktan sonra işaretlenir:

- [x] Temiz açılış Türkçe
- [x] Türkçe/English geçişi ve uygulama restart sonrasında kalıcılık
- [x] PERSONAL kayıt integration testi ve fiziksel cihaz login
- [x] BUSINESS kayıt integration testi ve fiziksel cihaz login
- [x] Mock top-up validation ve anlık bakiye
- [x] NFC kart eşleme
- [x] Gerçek NFC ödeme ve ikinci okutmanın çift çekmemesi
- [x] Merchant yeni bakiyesinin sonuç ekranında görünmesi
- [x] QR tarama/onay ve user yeni bakiyesi

Final cihaz turunda mock form `Ege XXX / 1111 1111 1111 1111 / 01/11 / 111`
değerlerini kabul etti; `-1` tutarını reddetti. `50.25 TRY` yükleme sonrası sonuç ve ana
sayfa aynı bakiyeyi gösterdi. Database kaydı yalnız kartın son dört hanesini ve kart sahibi
adını içerdi; tam kart/CVV sütunu bulunmadığı doğrulandı.

Fiziksel kart açık mobil onayından sonra release USER hesabına yazılıp doğrulandı. Backend
yalnız 64 karakterlik tag UID hash'i sakladı. Gerçek `10.00 TRY` NFC ödemesi sonrası payer
`50.25 → 40.25`, merchant `0.00 → 10.00`, session `PAID`, Transaction `SUCCESS/NFC`,
Transaction sayısı 1 ve PaymentAttempt sayısı 1 oldu. Result screen merchant bakiyesini
anında `10.00 TRY` gösterdi. Reader sonuç ekranından önce kapandı; ikinci temastan sonra
session/sayaç/bakiyeler değişmedi.

Final fiziksel QR turunda Android kamera yalnız session UUID içeren QR payload'ını okudu.
Kullanıcı ekranında merchant adı ve `5.00 TRY` tutarını görerek açık onay verdi. Sonuç
ekranı user bakiyesini anında `40.25 → 35.25 TRY` gösterdi. PostgreSQL doğrulamasında
merchant bakiyesi `10.00 → 15.00 TRY`, session `PAID`, Transaction `SUCCESS/QR`,
Transaction sayısı 1 ve PaymentAttempt sayısı 1 olarak kaydedildi.

## Bilinen sınırlar

- Release asset, local fiziksel kabul için üretilen preview APK'dır ve USB
  `adb reverse tcp:3000 tcp:3000` üzerinden local backend'e bağlanır.
- Google Play yayını için production HTTPS backend URL'si ve store-managed release signing
  ile EAS production AAB üretilmelidir.
- Statik User UUID içeren NFC kart klonlanabilir; case kriptografik kart kimliğini çözmez.
- Mock top-up gerçek ödeme kuruluşu veya banka provizyonu değildir.

## Dependency audit notu

`pnpm audit --prod --audit-level high`, Expo/React Native/Jest araç zincirinin transitif
`minimatch → brace-expansion` yolunda `GHSA-mh99-v99m-4gvg` uyarısını raporlamaktadır.
Kod yolu production API'de veya uygulamanın kullanıcı girdisini işleyen runtime akışında
çalışmaz; bundler/test araçlarındadır. Eski `minimatch` major'larını uyumsuz bir
`brace-expansion` major'ına zorlayan global override uygulanmamıştır. Expo/React Native
uyumlu upstream güncellemesi çıktığında lockfile güncellenip audit yeniden çalıştırılmalıdır.
