# Debrid Kitaplığım (Stremio eklentisi)

Real-Debrid ve AllDebrid'deki klasörlerinizi Stremio'da **📁 Klasörlerim** satırında gösterir; klasöre girince videolar listelenir, tek tıkla debrid'den **doğrudan** oynar. Telefondan yönetilen **playlistler** her biri ayrı satır olarak görünür (⭐ Favoriler, ⭐ İzlenecekler…).

## Gerekenler (hepsi ücretsiz)

| Ne | Nereden |
|---|---|
| Real-Debrid API token | real-debrid.com/apitoken |
| AllDebrid API key | alldebrid.com › Hesabım › Apikey Manager (yeni bir tane oluşturun) |
| Upstash Redis (playlistler kalıcı olsun diye) | upstash.com › GitHub ile giriş › Create Database › "REST API" bölümündeki URL + Token |
| Render hesabı | render.com › GitHub ile giriş |

## Render'a kurulum (~10 dk)

1. Render › **New › Web Service** › bu GitHub reposunu seçin
2. Ayarlar:
   - **Branch:** eklentinin olduğu branch
   - **Root Directory:** `addon`
   - **Runtime:** Node
   - **Build Command:** `true`
   - **Start Command:** `node src/server.js`
   - **Instance Type:** Free
3. **Environment Variables:**

   | Anahtar | Değer |
   |---|---|
   | `ADDON_SECRET` | Uzun, rastgele bir metin (ör. `kitaplik-8f3k2m9x7q`) — adresinizi gizli tutar |
   | `RD_TOKEN` | Real-Debrid token |
   | `AD_KEY` | AllDebrid key |
   | `UPSTASH_REDIS_REST_URL` | Upstash REST URL |
   | `UPSTASH_REDIS_REST_TOKEN` | Upstash REST Token |

4. **Deploy** › birkaç dakika sonra `https://<isim>.onrender.com` adresi verilir.

## Kullanım

- **Yönetim sayfası (telefon tarayıcısı):** `https://<isim>.onrender.com/<ADDON_SECRET>/`
  - Playlist oluştur, üstten listeyi seç, klasör veya videonun yanındaki ➕ ile ekle
  - Sayfanın altındaki **"Stremio'da aç ve kur"** linkiyle eklentiyi kurun
- **Stremio (TV / telefon / PC):** ana sayfada 📁 Klasörlerim ve ⭐ playlist satırları
- Yeni playlist ekledikten sonra satır TV'de görünmezse eklentiyi yönetim sayfasındaki linkten bir kez yeniden kurun

## Bilinmesi gerekenler

- Render ücretsiz sürümü 15 dk kullanılmayınca uyur; ilk açılış ~30 sn sürebilir. Oynatma hızını etkilemez.
- Video, debrid'den doğrudan cihaza akar; sunucu yalnızca linki verir.
- AllDebrid bulut sunucularını engellerse yönetim sayfasının üstünde uyarı çıkar. O durumda eklenti PC'de çalıştırılabilir:
  `ADDON_SECRET=... RD_TOKEN=... AD_KEY=... node src/server.js`
- `ADDON_SECRET`'i ve yönetim sayfası adresini kimseyle paylaşmayın.
- Alternatif: Hugging Face Spaces (Docker) — klasördeki `Dockerfile` hazır, anahtarlar "Secrets" bölümüne girilir.

## Geliştirme

```
npm test   # sahte RD/AD API'leriyle uçtan uca test
```
