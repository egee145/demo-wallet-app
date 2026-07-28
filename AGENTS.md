# AGENTS.md — HepAntalya Wallet & NFC Payment

## 1. Amaç ve kapsam

Bu repository HepAntalya dijital cüzdan, merchant wallet, Payment Session, NFC kart ve
QR ödeme altyapısını içerir. Bu dosya repository'nin tamamında geçerlidir.

Her görevde önce bu dosyayı, repository yapısını, gerçek `package.json` script'lerini,
`git status` çıktısını ve ilgili testleri incele. Yalnız kullanıcı tarafından belirtilen
aşamayı uygula; mevcut kullanıcı değişikliklerini koru ve ilgisiz refactor yapma.

## 2. Zorunlu teknoloji yığını

Backend:

- NestJS
- TypeScript
- Prisma ORM
- Supabase PostgreSQL
- NestJS JWT authentication
- REST API

Mobile:

- React Native
- Expo Development Build
- React Navigation
- `react-native-nfc-manager`
- `react-native-qrcode-svg`
- Expo SDK ile uyumlu `expo-camera`
- TypeScript

Test ve altyapı:

- Jest ve Supertest
- Unit, PostgreSQL integration ve gerçek paralel HTTP concurrency testleri
- Mobile component/service testleri
- Fiziksel Android NFC kabul testi
- Docker, environment validation, structured logging, Helmet, CORS ve rate limiting

Prisma/Supabase yerine başka ORM veya ana database; Expo yerine Flutter/native Kotlin;
modüler monolith yerine mikroservis, CQRS veya event sourcing ekleme.

## 3. Repository ve modül yapısı

```text
/
  backend/
  mobile/
  docker-compose.yml
  README.md
  AGENTS.md
```

Backend hedefi:

```text
backend/src/
  auth/
  users/
  wallet/
  merchant/
  payment/
    session/
    execution/
    idempotency/
    gateway/
  transaction/
  common/
  config/
  database/
  health/
```

Mobile hedefi:

```text
mobile/src/
  navigation/
  screens/
  services/api/
  services/auth/
  services/nfc/
  services/qr/
  services/storage/
  state/
  domain/
```

Mevcut yapı farklıysa gereksiz yeniden düzenleme yapma. Yeni katman veya dependency
yalnız mevcut aşamanın kabul kriteri için gerekliyse eklenebilir.

## 4. NestJS mimari kuralları

- Modüler monolith kullan.
- Controller'ları ince tut; bakiye, locking, idempotency ve transaction business
  logic'ini controller'a yazma.
- NFC ve QR controller'ları ortak `PaymentExecutionService` kullanmalıdır.
- DTO whitelist ve `forbidNonWhitelisted` zorunludur; finansal DTO'larda implicit
  numeric conversion kapalıdır.
- Domain hatalarını merkezi HTTP hata modeline dönüştür.
- Merchant ID JWT kullanıcısının Merchant ilişkisinden, QR payer User ID JWT
  subject'inden alınır.
- NFC User ID güvenilmeyen kart girdisidir.
- HTTP/WebSocket/harici servis çağrısını database transaction içinde çalıştırma.
- WebSocket yalnız başarılı commit sonrasında gönderilir.

## 5. Prisma migration ve database constraint kuralları

- Database source of truth versionlanmış Prisma migration dosyalarıdır.
- Paylaşılan/production database üzerinde `db push`, destructive reset veya elle schema
  değişikliği yapma.
- Eski migration'ı değiştirme; forward migration üret.
- Prisma'nın ifade edemediği check constraint, partial index ve trigger'ları migration
  içindeki kontrollü SQL ile ekle.
- Runtime raw SQL parameter-bound/tagged olmalıdır.
- Migration için `DIRECT_URL`, runtime için `DATABASE_URL` kullan.
- Supabase'in `auth` ve `storage` şemalarını Prisma tarafından yönetme.
- Finansal foreign key'lerde cascade delete kullanma.
- Transaction ledger UPDATE/DELETE edilemez olmalıdır.
- UUID PK, owner uniqueness, `balance >= 0`, TRY currency, positive session amount,
  session başına tek SUCCESS Transaction ve idempotency composite unique constraint
  database seviyesinde korunmalıdır.

## 6. Para ve wallet kuralları

- Float/Double ile finansal aritmetik yapma.
- PostgreSQL `NUMERIC(18,2)` ve Prisma Decimal kullan.
- Tutar pozitif, finite, en fazla iki ondalık ve izin verilen maksimum içinde olmalıdır.
- String, NaN, Infinity, sıfır, negatif ve ikiden fazla ondalıklı tutarı reddet.
- Arithmetic Prisma Decimal veya PostgreSQL NUMERIC üzerinde yapılır.
- Wallet hiçbir zaman negatif olamaz.
- USER ve wallet aynı transaction'da oluşturulur.
- Public BUSINESS kaydı ve ADMIN merchant provision işlemi MERCHANT User, merchant wallet
  ve Merchant kaydını aynı transaction'da oluşturur.
- Debit lock ve `balance >= amount` koşullu update ile atomik olmalıdır.
- Client balance değerine güvenme.
- Gerçek deposit yalnız ADMIN, idempotent ve audit kayıtlıdır. USER mock top-up ayrı
  endpoint/model kullanır; gerçek ödeme kuruluşuna bağlanmaz ve tam kart/CVV saklamaz.

## 7. Atomic payment, session, idempotency ve concurrency

NFC ve QR aynı Payment Session ve ortak execution servisini kullanır.

Tek transaction içinde:

1. Idempotency kontrolü.
2. Payment Session lock ve state/expiry/ownership kontrolü.
3. User ve wallet doğrulaması.
4. Wallet'ların deterministik UUID sırasıyla kilitlenmesi.
5. Koşullu debit ve merchant credit.
6. SUCCESS Transaction.
7. Session `PAID`.
8. PaymentAttempt ve idempotency response.
9. Commit.

Hata halinde hiçbir kısmi balance/session/Transaction kalmamalıdır.

Session status yalnız `WAITING`, `PAID`, `EXPIRED`, `CANCELLED`; varsayılan TTL 120
saniyedir. Aynı session yalnız bir defa ödenebilir.

`Idempotency-Key` NFC, QR, USER mock top-up, ADMIN deposit ve session creation için UUID
olmalıdır.
Aynı actor/scope/key ve aynı payload aynı response'u; farklı payload 409 döndürür.
Network timeout retry'ında aynı key korunur.

Varsayılan concurrency yaklaşımı Prisma interactive transaction, Serializable isolation,
session lock, deterministik wallet lock, conditional update ve unique constraint'tir.
Kilit sırası idempotency, session, UUID sıralı wallet'lardır. Retry yalnız serialization
failure/deadlock için sınırlı sayıda ve aynı idempotency key ile yapılır.

## 8. JWT ve authorization

Roller yalnız `USER`, `MERCHANT`, `ADMIN`:

- Public register yalnız `PERSONAL` veya `BUSINESS` account type kabul eder; client doğrudan
  role seçemez. PERSONAL → USER, BUSINESS → MERCHANT mapping'i backend tarafından yapılır.
- Merchant public BUSINESS kaydıyla veya ADMIN provision akışıyla oluşturulabilir.
- Merchant endpoint'i MERCHANT rolü ve aktif Merchant kaydı gerektirir.
- `GET /users/:id` yalnız aktif MERCHANT'a açıktır.
- Gerçek deposit yalnız ADMIN'e açıktır. USER mock top-up test amaçlıdır, gerçek kart
  doğrulaması/çekimi yapmaz ve açıkça mock olarak gösterilir.
- User/Merchant active kontrolünü yalnız token claim'ine bırakma.
- Password yalnız hash'li saklanır.
- Access token kısa ömürlüdür; refresh token hash'li, rotate edilen ve reuse-detected
  olmalıdır.
- Password, token veya Authorization header loglanmaz.

## 9. Mobile, Expo, NFC ve QR

- Mobile finans tablolarına veya Supabase'e doğrudan write yapamaz.
- Mobile bundle'a DB/JWT secret koyma.
- Token'ları SecureStore'da sakla.
- Finansal POST için yeni key üreten generic auto-retry kullanma.
- NFC kodunu screen'e gömme; `NfcReaderPort`, real adapter ve dev/test-only mock adapter
  kullan.
- Production'da mock User ID, test ödeme butonu ve diagnostics route'u bulunmamalıdır.
- Reader success/cancel/expiry/blur/background durumlarında kapatılmalı; duplicate listener
  ve tag read engellenmelidir.
- UID yalnız diagnostics içindir, User ID değildir.

Android Emulator gerçek NFC kartı okuyamaz. Emulator mock/UI testidir; gerçek NFC kabulü
Expo Development Build yüklü fiziksel Android cihazda yapılmalıdır.

Önce `adb devices -l` ile fiziksel cihazı emulator'dan ayır. Fiziksel cihaz yoksa gerçek
NFC başarısı iddia etme. Kullanıcıya telefon, USB debugging, NFC ve kartı ne zaman
okutacağı konusunda açık talimat ver.

Kullanıcıdan açık izin almadan fiziksel karta veri yazma, kartı silme, formatlama,
read-only yapma veya içeriğini değiştirme. Kart formatı bilinmiyorsa önce diagnostics
bulgularını raporla.

Merchant QR payload yalnız Payment Session UUID içermelidir. Amount, Merchant/User ID,
JWT veya JSON ekleme. User QR'ı `expo-camera` ile tarar, session detayını backend'den
alır ve açık onaydan sonra öder. Payer User ID JWT'den gelir.

## 10. Test kuralları

Unit test kapsamı en az auth/refresh, Decimal validator, NFC/QR parser, session lifecycle,
idempotency, retry classifier, payment state machine ve cleanup davranışlarını içerir.

Integration testleri gerçek PostgreSQL üzerinde USER+wallet, merchant provision,
session lifecycle, NFC/QR ödeme, decimal, inactive/missing actor, idempotency, rollback,
constraint, USER mock top-up ve ADMIN deposit davranışlarını doğrular.

Concurrency testleri gerçek paralel HTTP istekleri kullanır. Aynı session için farklı ve
aynı key yarışları, NFC/QR yarışı, aynı wallet'ın farklı session'ları ve yetersiz toplam
bakiye senaryolarını test eder. Her test sonunda balance, session, Transaction,
PaymentAttempt ve IdempotencyRecord sayıları doğrulanır.

Gerçek NFC kabul testi otomatik/emulator testi gibi gösterilemez. Fiziksel cihaz, gerçek
kart, gerçek Payment Session ve ikinci okutmanın çekim yapmadığı kanıtlanmalıdır.

## 11. Security, environment ve secrets

- Environment başlangıçta validate edilir; production eksik secret ile fail-fast olur.
- `.env` ve gerçek credential commit edilmez.
- `.env.example` yalnız isim ve açıklama taşır.
- `EXPO_PUBLIC_*` içine secret konmaz.
- Helmet, explicit CORS allowlist, DTO whitelist, body limit ve rate limiting uygulanır.
- Raw SQL parameter-bound olmalıdır.
- Password, passwordHash, token, Authorization, DB password ve Supabase secret loglanmaz.
- Idempotency key'in tamamı loglanmaz; User ID gerektiğinde maskelenir.
- Static User UUID kartı klonlanabilir; case bu riski kriptografik olarak çözmez.

## 12. Git, kapsam ve script kuralları

- Görev öncesi `git status` ve ilgili diff'i incele.
- Kullanıcının mevcut değişikliklerini koru.
- `git reset --hard`, destructive clean veya toplu checkout kullanma.
- İlgisiz refactor, dependency upgrade, schema, endpoint veya UI ekleme.
- Her görev yalnız belirtilen aşamayı uygular.
- Kapsam dışı problemi raporla; açık yetki olmadan düzeltme.

Komut isimlerini tahmin etme. Root ve ilgili package `package.json` script'lerini ve
lockfile'ı önce incele. Yalnız gerçekten mevcut script'leri çalıştır. Script henüz yoksa
varmış veya çalıştırılmış gibi raporlama. Scaffold/test/Prisma/native kurulumlarından sonra
bu bölüm gerçek komutlarla güncellenmelidir.

Mevcut root kalite komutları:

```text
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm test:concurrency
pnpm build
pnpm prisma:validate
pnpm prisma:generate
pnpm prisma:migrate:status
pnpm mobile:doctor
pnpm mobile:test
pnpm mobile:export
```

Integration/concurrency ve migration status komutları gerçek PostgreSQL bağlantısı
gerektirir. Native Android build için mevcut script `pnpm --filter
@hepantalya/mobile android` bir cihaz seçerek `expo run:android --device` çalıştırır;
CI/native assemble script'i henüz eklenmemiştir ve varmış gibi raporlanmamalıdır.

## 13. Definition of Done

Bir görev yalnız:

- Belirtilen kapsam uygulanmış,
- İlgisiz refactor yapılmamış,
- Gerekli migration/constraint ve testler eklenmiş,
- Gerçekte mevcut lint script'i geçmiş,
- Gerçekte mevcut typecheck script'i geçmiş,
- İlgili unit/integration/concurrency/mobile testleri geçmiş,
- Gerçekte mevcut build script'i geçmiş,
- Prisma değişikliğinde validate/generate/migration kontrolü geçmiş,
- Expo değişikliğinde doctor/build kontrolü geçmiş,
- Başarısız doğrulama gizlenmemiş,
- Secret veya hassas veri diff/log içine girmemiş,
- Git diff incelenmiş,
- Çalıştırılamayan kontroller ve dış blokajlar açıkça raporlanmış

ise tamamlanmış sayılır.

NFC aşamasında fiziksel Android kabul testi yapılmadıysa görev NFC açısından tamamlanmış
değildir. Kanıt bulunmayan özelliği tamamlanmış raporlama.
