# Handventure

**Handventure** adalah platform web inovatif yang mengubah gerakan tangan menjadi pemahaman melalui deteksi dan penerjemahan bahasa isyarat secara real-time. Aplikasi ini dirancang untuk memfasilitasi komunikasi inklusif dan menyediakan pengalaman belajar yang menyenangkan melalui fitur-fitur interaktif.

## Fitur Utama

### 1. Deteksi Bahasa Isyarat BISINDO
- Menerjemahkan bahasa isyarat **BISINDO** (Bahasa Isyarat Indonesia) ke teks secara real-time
- Menggunakan teknologi computer vision dan model pembelajaran mendalam (deep learning)
- Berbasis pada pustaka MediaPipe untuk pendeteksian pose tangan dan tubuh
- Dapat digunakan langsung dari browser tanpa perlu instalasi tambahan

### 2. Game Interaktif
Platform ini tidak hanya berfungsi sebagai penerjemah, tetapi juga menyediakan berbagai permainan yang mengedukasi dan menyenangkan:
- **Kodály Piano**: Mainkan nada do–re–mi–fa–so–la–si–do dengan gerakan tangan Kodály
- **Math Hands**: Menyelesaikan soal matematika dengan membentuk angka menggunakan jari
- **Shape Builder**: Membentuk berbagai bangun datar dengan gerakan tangan
- **Roscipa**: Permainan gunting-batu-kertas melawan komputer berbasis pengenalan gestur

### 3. Panduan dan Pembelajaran
- Menyediakan panduan penggunaan yang jelas untuk kalibrasi kamera
- Menyediakan contoh gesture untuk berbagai simbol atau huruf
- Mengarahkan pengguna untuk memahami posisi optimal saat menggunakan aplikasi

## Teknologi yang Digunakan

### Frontend
- HTML5, CSS3, dan JavaScript
- TensorFlow.js untuk implementasi model machine learning di browser
- MediaPipe untuk deteksi pose dan pengenalan gestur
- Feather Icons dan Animate On Scroll (AOS) untuk tampilan dan animasi

### Model dan Data
- Model pembelajaran mendalam LSTM (Long Short-Term Memory) untuk klasifikasi gestur
- Dataset BISINDO yang mencakup berbagai simbol dan kata dalam bahasa isyarat Indonesia
- File model yang dioptimalkan untuk digunakan langsung di browser (format TensorFlow.js)

## Struktur Proyek

```
HandSpeak/
├── index.html                 # Halaman utama/beranda aplikasi
├── translate.html             # Halaman deteksi real-time bahasa isyarat
├── games.html                 # Halaman daftar game interaktif
├── latih.html                 # Halaman pelatihan model (untuk pengembang)
├── asset/                     # File aset (CSS, JS, gambar, audio)
│   ├── css/                   # File stylesheet
│   ├── js/                    # File skrip JavaScript
│   ├── images/                # Gambar dan ikon
│   └── audio/                 # File audio (jika ada)
├── games/                     # File-file game individual
│   ├── piano.html
│   ├── mathands.html
│   ├── roscipa.html
│   └── shapebuilder.html
├── model_web/                 # Model machine learning untuk web
│   ├── action_model_optimized.json
│   ├── bisindo_model_pose.json
│   └── ...
├── program/                   # File pendukung untuk pelatihan dan pengembangan
│   ├── training_pose.py
│   ├── data_pose.py
│   ├── bisindo_model_pose.h5
│   └── ...
├── Dataset_BISINDO_Pose/      # Dataset pelatihan (berisi folder individu per gesture)
│   ├── a/
│   ├── f/
│   ├── halo/
│   └── ...
└── Logs_Pose/                 # File log (jika ada)
```

## Cara Menggunakan

1. Buka halaman `index.html` di browser modern
2. Klik tombol "Coba Sekarang" untuk menuju ke halaman terjemahan
3. Izinkan akses kamera saat diminta
4. Posisikan tubuh sesuai panduan kalibrasi
5. Lakukan gesture bahasa isyarat sesuai kebutuhan
6. Hasil deteksi akan muncul secara real-time di layar

Untuk bermain game, klik "Mainkan Game" di halaman utama dan pilih game yang diinginkan.

## Tujuan dan Manfaat

- Memfasilitasi komunikasi antara individu dengan dan tanpa gangguan pendengaran
- Menyediakan alat bantu belajar bahasa isyarat dalam bentuk yang menyenangkan
- Meningkatkan kesadaran akan pentingnya inklusi dan teknologi aksesibilitas
- Memberikan alternatif komunikasi yang lebih mudah bagi mereka yang memiliki kesulitan berbicara

## Pengembangan dan Kontribusi

Aplikasi ini masih dalam pengembangan aktif dan dapat ditingkatkan dengan:
- Menambahkan lebih banyak simbol dan kata dalam bahasa isyarat
- Meningkatkan akurasi deteksi melalui model pelatihan yang lebih baik
- Mengembangkan antarmuka pengguna yang lebih ramah
- Menyediakan fitur pelatihan khusus untuk pengguna baru

## Kontributor

Platform ini dikembangkan dengan bantuan sumber belajar seperti aplikasi "Hear Me", yang menjadi referensi utama dalam pengembangan dataset dan pengembangan fitur pembelajaran.