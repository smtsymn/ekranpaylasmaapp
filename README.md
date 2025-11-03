# ScreenShare Pro

Modern, responsive ve mobil uyumlu gerçek zamanlı ekran paylaşım uygulaması.

## 🚀 Özellikler

- **Modern UI/UX**: Dark tema ile profesyonel tasarım
- **Mobil Uyumlu**: Tüm cihazlarda mükemmel çalışır
- **Gerçek Zamanlı**: Düşük gecikme ile ekran paylaşımı
- **Ses Desteği**: Sistem sesini paylaşma özelliği
- **Kalite Kontrolü**: Video kalitesi ve FPS ayarları
- **İstatistikler**: FPS, gecikme ve bitrate takibi
- **Ayarlar**: Kullanıcı tercihlerini kaydetme
- **Bildirimler**: Kullanıcı dostu bildirim sistemi
- **Klavye Kısayolları**: Hızlı erişim için kısayollar

## 📱 Mobil Uyumluluk

- Responsive tasarım
- Touch-friendly arayüz
- Mobil tarayıcı optimizasyonu
- PWA desteği

## 🛠️ Teknolojiler

- **HTML5**: Semantic markup
- **CSS3**: Modern styling ve animasyonlar
- **JavaScript ES6+**: Class-based architecture
- **WebRTC**: Screen sharing API
- **Font Awesome**: İkonlar
- **Inter Font**: Modern tipografi

## 🚀 Kurulum

1. Dosyaları indirin
2. `index.html` dosyasını tarayıcıda açın
3. "Ekran Paylaş" butonuna tıklayın
4. Paylaşmak istediğiniz ekranı/pencereyi seçin

## 📋 Gereksinimler

- Modern tarayıcı (Chrome, Firefox, Edge, Safari)
- HTTPS bağlantısı (production için)
- Ekran paylaşım izni

## 🎯 Kullanım

### Temel Kullanım
1. **Ekran Paylaş**: Ana butona tıklayarak paylaşımı başlatın
2. **Paylaşım Seçin**: Ekran, pencere veya sekme seçin
3. **Ses Ekle**: İsteğe bağlı olarak sistem sesini dahil edin
4. **Kontrol Et**: Alt kontrollerle ses ve videoyu yönetin

### Gelişmiş Özellikler
- **Ayarlar**: Video kalitesi ve FPS ayarları
- **İstatistikler**: Gerçek zamanlı performans takibi
- **Tam Ekran**: F11 veya buton ile tam ekran modu
- **Klavye Kısayolları**: 
  - `ESC`: Ayarları kapat
  - `Space`: Video oynat/duraklat
  - `F11`: Tam ekran

## 🎨 Özelleştirme

### Renk Teması
CSS değişkenlerini düzenleyerek renk temasını değiştirebilirsiniz:

```css
:root {
    --primary-color: #3b82f6;
    --success-color: #10b981;
    --danger-color: #ef4444;
    /* ... diğer renkler */
}
```

### Ayarlar
`script.js` dosyasında varsayılan ayarları değiştirebilirsiniz:

```javascript
this.settings = {
    videoQuality: 'medium', // 'low', 'medium', 'high'
    frameRate: 30,          // 24, 30, 60
    autoQuality: true,
    showStats: true
};
```

## 🔧 Geliştirme

### Proje Yapısı
```
screenshare-pro/
├── index.html          # Ana HTML dosyası
├── styles.css          # CSS stilleri
├── script.js           # JavaScript kodu
└── README.md           # Bu dosya
```

### Tarayıcı Desteği
- Chrome 72+
- Firefox 66+
- Edge 79+
- Safari 13+

## 📊 Performans

- **Gecikme**: < 500ms
- **FPS**: 24-60 arası ayarlanabilir
- **Kalite**: 480p - 1080p arası
- **Bellek**: Minimal kullanım

## 🔒 Güvenlik

- HTTPS gereklidir (production)
- Kullanıcı izni gerekir
- Veri yerel olarak saklanır
- Üçüncü parti izleme yok

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'Add amazing feature'`)
4. Push yapın (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## 🆘 Destek

Sorunlar için GitHub Issues kullanın veya iletişime geçin.

## 🔄 Güncellemeler

### v1.0.0
- İlk sürüm
- Temel ekran paylaşım özellikleri
- Mobil uyumluluk
- Modern UI/UX

---

**Not**: Bu uygulama yerel ekran paylaşımı için tasarlanmıştır. Gerçek zamanlı uzaktan paylaşım için WebRTC signaling server'ı eklemeniz gerekir. 