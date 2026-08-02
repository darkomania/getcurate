# Curate

A customizable Chrome new tab page that turns your bookmark folders into a clean, organized start page. Your existing Chrome bookmarks become cards; loose bookmarks get their own section. Drag to reorder, switch themes, pick your search engine.

Türkçesi aşağıda / Turkish version below.

![Version](https://img.shields.io/badge/version-1.0.0-8fd6b4)
![Manifest](https://img.shields.io/badge/manifest-v3-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

- **Automatic** — reads your real Chrome bookmark folders; no manual setup
- **Folder cards** — each bookmark folder becomes a card with its links and favicons
- **Loose bookmarks** — bookmarks not in any folder appear in a separate 3-column section
- **Drag & drop** — reorder folder cards and bookmarks with live, animated repositioning (pointer-based, Trello-style)
- **Move between folders** — drag a bookmark into another folder; optionally make moves permanent (writes to real Chrome bookmarks)
- **Themes** — Green, Dark, Light, and System (auto-follows your OS light/dark mode)
- **Search** — Google, Bing, DuckDuckGo, Brave, or Ecosia; type a URL to go directly
- **Collapse folders** — minimize any card you don't need open
- **Nested folders** — subfolders show as collapsible accordions inside their parent card, at any depth
- **Scrollable folders** — folders with many links scroll inside the card, with a fade gradient and thin scrollbar; the link limit before scrolling is adjustable in settings
- **Hide folders** — keep archive/mobile folders out of the view
- **Right-click menu** — on a bookmark: open in new tab / new window / incognito, copy link, edit (name & URL), delete. On a folder: expand/collapse, open all in new tabs, open all as a tab group, rename, hide, delete.
- **Delete** — with a 5-second undo. Deletions are permanent (removed from Chrome) only when Permanent mode is on; otherwise they just hide from this page.
- **Custom avatar letter** — set the initial shown in the top-right circle

All settings and layout are saved locally and persist across sessions.

## Installation (from source)

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the project folder.
5. Open a new tab — your bookmarks appear.

## Privacy Policy

You can review the full privacy policy here: [PRIVACY_POLICY.md](PRIVACY_POLICY.md)

## Languages

The interface is available in English, Turkish, Spanish, German, French, and Portuguese. On first run it follows your browser language; you can switch it any time from the Language selector in settings.

## Syncing across devices

Your settings (theme, search engine, folder order, hidden/collapsed folders, link limit, avatar) are stored with `chrome.storage.sync`, so they follow you to any computer where you're signed into the same Google account with Chrome sync on.

Bookmark changes are different: with **Permanent mode off**, moves/edits/deletes are local to the current tab and are not synced (they reset on refresh). To have a bookmark change appear on your other computers, make it with **Permanent mode on** — it then writes to your real Chrome bookmarks, which Chrome itself syncs across devices.

## Permissions

| Permission | Why it's needed |
|-----------|-----------------|
| `bookmarks` | Read your bookmark folders and (optionally) move bookmarks |
| `favicon` | Show site icons next to each bookmark |
| `storage` | Save your settings and layout locally |
| `tabs` | Open bookmarks in new tabs/windows from the right-click menu |
| `tabGroups` | Open a folder as a named, colored tab group |

No data leaves your browser. There is no analytics, tracking, or external server.

## A note on the Google logo

The extension shows a static Google logo (colored on light theme, white on dark themes). It does **not** fetch the daily Google Doodle — there is no reliable public API for that, so a stable logo is used instead. You can turn the logo off in settings.

## Contributing

Contributions are welcome. Open an issue to discuss a change, or send a pull request. The code is plain HTML/CSS/JavaScript with no build step — edit the files and reload the unpacked extension.

## License

[MIT](LICENSE) © 2026 Curate

---

# Curate (Türkçe)

Chrome yer imi klasörlerinizi temiz ve düzenli bir başlangıç sayfasına dönüştüren, özelleştirilebilir bir yeni sekme eklentisi. Mevcut Chrome yer imleriniz kartlara dönüşür; klasörsüz yer imleri ayrı bir bölümde listelenir. Sürükleyerek sıralayın, tema değiştirin, arama motorunuzu seçin.

## Özellikler

- **Otomatik** — gerçek Chrome yer imi klasörlerinizi okur, elle kurulum gerektirmez
- **Klasör kartları** — her yer imi klasörü, linkleri ve faviconlarıyla bir kart olur
- **Klasörsüz yer imleri** — hiçbir klasörde olmayan yer imleri ayrı 3 sütunlu bölümde
- **Sürükle-bırak** — klasör kartlarını ve yer imlerini canlı, animasyonlu şekilde yeniden sıralayın (pointer tabanlı, Trello tarzı)
- **Klasörler arası taşıma** — bir yer imini başka klasöre sürükleyin; isterseniz taşımaları kalıcı yapın (gerçek Chrome yer imini değiştirir)
- **Temalar** — Yeşil, Koyu, Açık ve Sistem (işletim sisteminin karanlık/aydınlık moduna otomatik uyar)
- **Arama** — Google, Bing, DuckDuckGo, Brave veya Ecosia; URL yazınca doğrudan gider
- **Klasör daraltma** — açık tutmak istemediğiniz kartı minimize edin
- **İç içe klasörler** — alt klasörler, üst kartın içinde açılır-kapanır olarak, her derinlikte gösterilir
- **Kaydırılabilir klasörler** — çok linkli klasörler kart içinde kaydırılır; solma efekti ve ince kaydırma çubuğu ipucu verir. Kaydırmadan önce gösterilecek link sayısı ayarlardan değiştirilebilir
- **Klasör gizleme** — arşiv/mobil klasörlerini görünümden çıkarın
- **Sağ tık menüsü** — yer iminde: yeni sekmede / yeni pencerede / gizli pencerede aç, bağlantıyı kopyala, düzenle (ad ve URL), sil. Klasörde: aç/kapat, tümünü yeni sekmede aç, tümünü sekme grubu olarak aç, yeniden adlandır, gizle, sil.
- **Silme** — 5 saniyelik geri alma ile. Silmeler yalnızca Kalıcı mod açıkken gerçekten Chrome'dan silinir; aksi halde sadece bu sayfadan gizlenir.
- **Özel avatar harfi** — sağ üstteki dairede görünecek harfi belirleyin

Tüm ayarlar ve düzen yerel olarak kaydedilir, sekmeler arası korunur.

## Kurulum (kaynaktan)

1. Bu depoyu indirin veya klonlayın.
2. Chrome'da `chrome://extensions` adresini açın.
3. Sağ üstten **Geliştirici modu**'nu açın.
4. **Paketlenmemiş öğe yükle**'ye tıklayıp proje klasörünü seçin.
5. Yeni sekme açın — yer imleriniz görünür.

## Gizlilik Politikası

Tam gizlilik politikasına buradan ulaşabilirsiniz: [PRIVACY_POLICY.md](PRIVACY_POLICY.md)

## Diller

Arayüz İngilizce, Türkçe, İspanyolca, Almanca, Fransızca ve Portekizce olarak sunulur. İlk açılışta tarayıcı dilinizi kullanır; ayarlardaki Dil seçiminden istediğiniz zaman değiştirebilirsiniz.

## Cihazlar arası senkronizasyon

Ayarlarınız (tema, arama motoru, klasör sırası, gizli/kapalı klasörler, link limiti, avatar) `chrome.storage.sync` ile saklanır; böylece aynı Google hesabıyla ve Chrome senkronizasyonu açık şekilde giriş yaptığınız her bilgisayarda sizi takip eder.

Yer imi değişiklikleri farklıdır: **Kalıcı mod kapalıyken** taşıma/düzenleme/silme işlemleri yalnızca o sekmeye özeldir ve senkronize edilmez (yenileyince sıfırlanır). Bir yer imi değişikliğinin diğer bilgisayarlarınızda görünmesi için işlemi **Kalıcı mod açıkken** yapın — o zaman gerçek Chrome yer imlerinize yazılır ve Chrome bunları cihazlar arasında kendisi senkronize eder.

## İzinler

| İzin | Neden gerekli |
|------|---------------|
| `bookmarks` | Yer imi klasörlerinizi okumak ve (isteğe bağlı) yer imi taşımak |
| `favicon` | Her yer iminin yanında site simgesini göstermek |
| `storage` | Ayarlarınızı ve düzeninizi yerel olarak kaydetmek |
| `tabs` | Sağ tık menüsünden yer imlerini yeni sekme/pencerede açmak |
| `tabGroups` | Bir klasörü adlandırılmış, renkli bir sekme grubu olarak açmak |

Hiçbir veri tarayıcınızdan çıkmaz. Analitik, takip veya harici sunucu yoktur.

## Google logosu hakkında

Eklenti sabit bir Google logosu gösterir (açık temada renkli, koyu temalarda beyaz). Günlük Google Doodle'ını **çekmez** — bunun için güvenilir bir genel API olmadığından sabit logo kullanılır. Logoyu ayarlardan kapatabilirsiniz.

## Katkıda bulunma

Katkılar memnuniyetle karşılanır. Bir değişikliği tartışmak için issue açın ya da pull request gönderin. Kod, derleme adımı olmayan sade HTML/CSS/JavaScript'tir — dosyaları düzenleyip eklentiyi yeniden yükleyin.

## Lisans

[MIT](LICENSE) © 2026 Curate
