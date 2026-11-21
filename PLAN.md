# Ev Ağı + Samsung 65Q70B + Plex/Zurg İyileştirme Planı

Hedef: 1000 Mbps hattı evin her yerinde verimli kullanmak, TV'de 4K remux'ları takılmadan oynatmak.

---

## 0. Akşam yanımda olsun (bilgi toplama — 10 dk)

- [ ] Modem/router marka-model (ISP modemi mi, ayrı router mı, mesh var mı?)
- [ ] Router ile TV arası: kaç oda / kaç duvar / kaç metre?
- [ ] TV odasına Ethernet kablosu çekilebilir mi?
- [ ] Plex Server hangi PC'de, o PC kabloyla mı bağlı, Wi-Fi ile mi?
- [ ] Zurg + rclone config dosyaları (`config.yml`, rclone mount komutu)
- [ ] Takılan bir filmin adı/dosya bilgisi (remux mu, Dolby Vision mı, ses DTS / TrueHD mi, altyazı PGS mi?)

## 1. Ölçüm (önce ölç, sonra değiştir)

- [ ] PC kablolu → speedtest (hat gerçekten ~940 Mbps mi?)
- [ ] Telefon router yanında 5 GHz → speedtest
- [ ] Telefon TV'nin önünde 5 GHz → speedtest
- [ ] TV: Ayarlar › Genel › Ağ › Ağ Durumu → hangi bant (2.4/5 GHz), sinyal gücü
- [ ] TV'de tarayıcıdan fast.com
- [ ] Android telefonda "WiFi Analyzer" ile kanal yoğunluğu (komşu ağlar)

## 2. Router / genel Wi-Fi

- [ ] Firmware güncelle
- [ ] 5 GHz: 80 MHz kanal genişliği (Wi-Fi 6 router'da 160 MHz opsiyonel), boş kanal seç (36-48 veya DFS 52-64 / 100+)
- [ ] 2.4 GHz: 20 MHz, kanal 1 / 6 / 11'den en boş olanı
- [ ] TV için 5 GHz'e sabitle (gerekirse ayrı SSID: `Ev-5G`)
- [ ] Güvenlik: WPA2-AES veya WPA2/WPA3, WPS kapalı, admin şifresi değiştir
- [ ] ISP modemi + ayrı router varsa: çift Wi-Fi / çift NAT kontrolü (modem bridge modda olsun)
- [ ] Gerekirse: mesh (tercihen kablolu backhaul) veya TV odasına AP

### Mevcut donanım
- Superonline Fiber 1000 Mbps, ZTE Wi-Fi 6 modem (arayüz genelde `192.168.1.1`; bazı ayarlar ISP tarafından kilitli olabilir)
- Kablo çekilemiyor → **Powerline** değerlendiriliyor

### Powerline (elektrik hattı üzerinden internet)
- 2 adaptör: biri modemin yanında prize + Ethernet ile modeme, diğeri PC'nin yanında prize + Ethernet ile PC'ye
- Alınacaklar: **Gigabit Ethernet portlu**, tercihen **prizli (passthrough)** model
  - TP-Link TL-PA8010P KIT (AV1300) — iyi fiyat/performans
  - TP-Link TL-PA7017P KIT (AV1000)
  - Devolo Magic 2 LAN (G.hn) — daha pahalı, genelde daha stabil
  - AV600 / 100 Mbps portlu modellerden kaçın
- Kurallar: doğrudan duvar prizine (uzatma/akım korumalı priz YOK), mümkünse aynı sigorta hattında
- Gerçekçi beklenti: 150-500 Mbps, ama asıl kazanç **stabil gecikme**
- İade imkânı olan yerden al — sonuç evin elektrik tesisatına bağlı
- Test: PC'de Wi-Fi vs powerline → hız + ping dalgalanması + takılan film
- **Modem durumu:** dolap üstünde, banyodaki prizden çekilen uzatma ile elektrik alıyor.
  - Çözüm: prizli adaptörü **banyodaki duvar prizine** tak → uzatmayı adaptörün prizine tak → uzatmanın yanından ince (yassı) CAT6 kabloyu modeme götür
  - Banyo hattı ayrı sigorta / kaçak akım rölesi üzerinde olabilir → hız düşebilir, iadeli al ve test et
  - Adaptör ıslanacak bölgeden uzak olmalı
  - Alternatif: harici TV cihazı (Stremio/Infuse) ile PC'yi aradan çıkarmak → powerline'a gerek kalmayabilir

## 3. Samsung 65Q70B — kritik kısıtlar

| Kısıt | Etkisi |
|---|---|
| Ethernet portu **100 Mbps** | Kablo bile olsa ~94 Mbps tavan; 4K remux tepe noktaları aşabilir |
| Wi-Fi 5 (802.11ac) | İyi 5 GHz sinyalde 200-400 Mbps → Ethernet'ten **daha hızlı** olabilir |
| **DTS / DTS-HD desteklemez** | Plex sesi transcode eder → takılma sebebi |
| **Dolby Vision desteklemez** (sadece HDR10/HDR10+) | DV profil 5 dosyalarda yanlış renk / video transcode |
| PGS (görüntü tabanlı) altyazı | Altyazı videoya "yakılır" → 4K video transcode → takılma |
| 24p içerik / 60 Hz | Kasma (judder) hissi, buffer sorunu değil — görüntü ayarı |

- [ ] TV'de: Auto Motion Plus → Özel, Judder Reduction ~3-5 dene (veya Film modu)
- [ ] TV'de "Wi-Fi ile aç / Mobil ile aç" gereksizse kapat; yazılımı güncelle

## 4. Plex Server ayarları (Zurg/debrid için çok önemli)

Kütüphane & Planlanmış Görevler:
- [ ] **Video önizleme küçük resimleri üret → KAPAT** (debrid'den tüm dosyayı indirir!)
- [ ] Intro / Credits / Chapter thumbnail tespiti → KAPAT
- [ ] Ses seviyesi analizi (loudness) → KAPAT
- [ ] Otomatik / periyodik tarama → kapat veya seyrek; Zurg `on_library_update` ile kısmi tarama
- [ ] "Partial / değişiklik algılandığında tara" → zurg ile sorun çıkarıyorsa kapat

Transcoder:
- [ ] Donanım hızlandırma açık (Plex Pass + GPU varsa)
- [ ] Transcoder geçici klasörü SSD'de

Plex TV uygulaması:
- [ ] Video kalitesi: Orijinal / Maksimum
- [ ] "Otomatik kalite ayarla" kapalı
- [ ] Direct Play / Direct Stream açık
- [ ] Altyazı: SRT tercih et, PGS'den kaçın

Teşhis: oynatırken **Plex Web › Dashboard** → "Direct Play" mi "Transcode" mu? Transcode ise sebebi (ses/altyazı/codec) orada yazar.

> Durum: Dashboard'da **Direct Play** görüldü → transcode sebebi elendi. Darboğaz: TV Wi-Fi'si, zurg/rclone okuma hızı, debrid hızı veya 24p kasması.

> Durum: Modem evin ortasında, TV yakın odada. PC ayrı odada ~700 Mbps görüyor (**Wi-Fi** — evde her şey Wi-Fi'de; TV 5 GHz'e bağlı). Plex PC Wi-Fi'de → çift Wi-Fi atlaması (debrid→PC→TV aynı yayın süresini paylaşır). Öncelik: PC'yi kabloya almak.. Kapsama iyi görünüyor → şüphe zurg/rclone/debrid ve 24p kasmasına kayıyor.

**Ayırıcı test (akşam ilk iş):**
1. Takılma türü: dönen yükleme simgesi (buffer) mi, yoksa görüntü akarken mikro kasma mı? Mikro kasma → TV görüntü ayarı (§3).
2. Takılan filmin bitrate'i (Plex › Bilgi) vs TV önündeki 5 GHz hızı.
3. Aynı filmi PC'ye **indirip** yerel kütüphaneden oynat:
   - Yerelde akıcı → sorun zurg/rclone/debrid (§5)
   - Yerelde de takılıyor → sorun Wi-Fi/TV (§2-3)

## 5. Zurg + rclone ayarları (akşam config'e bakacağız)

Başlangıç önerisi (rclone mount):

```
--vfs-cache-mode full
--vfs-cache-max-size 100G        # SSD'de yer varsa
--vfs-read-chunk-size 64M
--vfs-read-chunk-size-limit 2G
--vfs-read-ahead 2G
--buffer-size 64M
--dir-cache-time 10s
--poll-interval 0                # zurg ile
```

- [ ] Plex Server PC'si **kablolu** olmalı (debrid → PC → TV; iki Wi-Fi atlaması olmasın)
- [ ] Debrid sunucusuna ping/indirme hızı test (RD/AD bazen yavaş node veriyor)

## 6. "TV için ayrı cihaz/uygulama" seçenekleri

| Seçenek | Artı | Eksi |
|---|---|---|
| **Nvidia Shield TV Pro** | Gigabit Ethernet, her formatı direkt oynatır, ses passthrough, Plex/Kodi/Stremio | Pahalı, eski çip |
| **Apple TV 4K (128 GB, Ethernet'li)** | Gigabit, Wi-Fi 6, Infuse uygulaması mükemmel (Plex/WebDAV/zurg), DV→HDR10 dönüştürür | DTS passthrough yok (PCM'e çevirir — sorun değil) |
| Google TV Streamer | Ucuz, Ethernet | Shield kadar format desteği yok |
| Stremio + Torrentio + RD (cihaz üzerinde) | PC/Plex sunucusu gerekmez, RD'den direkt akış | Kütüphane yönetimi yok |

Kısa yorum: TV'nin kendi uygulamasıyla DTS, DV ve PGS hep sorun çıkaracak. Asıl kalıcı çözüm ~bir harici kutu. **Önce bedava ayarları deneyelim**, yetmezse kutu.

## 6b. Stremio iyileştirme (mevcut: Stremio + Torrentio)

Sorunlar: klasörleme/arayüz zayıf, AllDebrid çalışmıyor.

AllDebrid teşhis (akşam):
- [ ] Hata mesajını not al
- [ ] AllDebrid hesabı aktif mi, e-postada "yeni konum / IP onayı" var mı?
- [ ] AllDebrid'in datacenter IP'lerini engellediği biliniyor (2024 raporu) → Torrentio sunucusu üzerinden reddediliyor olabilir
- [ ] VPN kapalı dene; yeni API key ile Torrentio'yu yeniden yapılandır
- [ ] Olmazsa: AIOStreams / Comet / MediaFusion gibi alternatif eklentiler, ya da PC'de self-host (ev IP'si = engel yok)

Arayüz:
- [ ] Katalog: TMDB eklentisi (Türkçe), Trakt entegrasyonu (izleme listesi / devam et)
- [ ] Akış listesi: AIOStreams ile tek liste, kalite/boyut/debrid'e göre sıralı, düzgün etiketli
- [ ] Daha güzel arayüz isteniyorsa (harici cihazda): Kodi + Fen Light / Umbrella, veya Apple TV + Infuse (Plex kütüphanesi)

## 7. PC'den TV'ye yansıtma

- Smart View / Miracast, Wi-Fi Direct kullanır ve Wi-Fi ile yarışır → film için Plex/DLNA tercih et
- Oyun / masaüstü için: Moonlight + Sunshine (harici kutuda en iyi), PC kablolu olmalı

---

## Akşam sırası

1. Bilgi topla (§0) → 2. Ölç (§1) → 3. Router (§2) → 4. Plex Dashboard'da takılan filmi teşhis (§4) → 5. Plex + rclone ayarları (§4-5) → 6. Tekrar ölç → 7. Gerekiyorsa cihaz kararı (§6)

## 8. Kendi Stremio eklentimiz: "Debrid Kitaplığım" (yarım kaldı)

Amaç: RD + AD dosyalarını Stremio'da afişli, Türkçe "Filmlerim / Dizilerim" satırlarında göstermek; film debrid'den doğrudan TV'ye akar.

- [x] `addon/src/parse.js`: dosya adından film/dizi, yıl, sezon/bölüm, kalite
- [x] `addon/src/providers/realdebrid.js`: RD kütüphanesi + oynatma linki
- [ ] AllDebrid sağlayıcısı
- [ ] TMDB (afiş, Türkçe başlık/özet) + önbellek
- [ ] Stremio sunucusu (manifest / catalog / meta / stream / play)
- [ ] Kurulum: Node.js, TMDB anahtarı, HTTPS (Cloudflare Tunnel veya Tailscale Funnel)

### Güncelleme: ihtiyaç sadeleşti
Videolar genelde afişsiz, sıradan dosyalar → TMDB/afiş gerekmiyor.
İstenen: klasörleri menü gibi görmek + seçilenleri ayrı liste/playlist yapmak.

1. [ ] Önce mevcut çözümü dene: Torrentio debrid kataloğundaki bir öğeyi aç → "Kütüphaneye ekle" → Library sekmesinde liste olarak görünüyor mu?
2. [ ] Yetmezse sade eklenti: RD + AD tek katalog "Klasörlerim" (yeniden eskiye, arama, RD/AD filtresi), klasör açınca dosya listesi, birden fazla isimli liste (Favoriler, İzlenecekler…). TMDB yok, ücretsiz bulutta çalışır.
