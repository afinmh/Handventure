# Gesture Guide System Documentation

## Overview
Sistem guide gesture yang telah dibuat menggunakan 13 gesture sesuai dengan actions yang Anda tentukan. Sistem ini memiliki fitur carousel dan search yang fully functional.

## Gesture List
```javascript
actions = ['a', 'f', 'halo', 'i', 'kamu', 'l', 'n', 'nama', 'perkenalkan', 'saya', 'siapa', 'terimakasih', 'u'];
```

## Features

### 1. Carousel Navigation
- **Next/Previous buttons**: Navigasi menggunakan tombol panah kiri/kanan
- **Keyboard support**: Arrow keys untuk navigasi
- **Disabled state**: Tombol akan disabled jika hanya ada 1 hasil atau tidak ada hasil

### 2. Search Functionality
- **Real-time search**: Pencarian langsung saat mengetik
- **Smart filtering**: Mencari berdasarkan nama gesture dan action
- **Auto-reset**: Kembali ke item pertama setelah search

### 3. Counter
- **Dynamic count**: Menampilkan jumlah gesture yang tersedia `(13)` atau hasil filter

## File Structure
- `js/script.js` - Main carousel logic
- `translate.html` - Updated HTML with proper IDs
- `css/translate.css` - Updated styles with disabled states

## Usage

### Basic Integration
File script.js sudah di-include di translate.html dan akan auto-initialize.

### Advanced Usage
```javascript
// Akses carousel instance
const carousel = window.gestureCarousel;

// Get current gesture
const currentGesture = carousel.getCurrentGesture();

// Set specific gesture
carousel.setGesture('halo');
```

## Image Management
Saat ini semua gesture menggunakan placeholder image. Untuk menggunakan gambar asli:

1. Update object `gestureData` di `js/script.js`
2. Ganti path `images/placeholder.png` dengan path gambar yang sesuai

Contoh:
```javascript
const gestureData = {
    'a': { name: 'Huruf A', image: 'images/gestures/a.jpg' },
    'halo': { name: 'Halo', image: 'images/gestures/halo.jpg' },
    // dst...
};
```

## Integration dengan Sistem Deteksi
Carousel dapat diintegrasikan dengan sistem deteksi dengan cara:

```javascript
// Di translate.js atau file deteksi lainnya
function onGestureDetected(detectedGesture) {
    // Update carousel untuk menampilkan gesture yang terdeteksi
    if (window.gestureCarousel) {
        window.gestureCarousel.setGesture(detectedGesture);
    }
}
```

## Customization
- Ubah data gesture di `gestureData` object
- Modifikasi CSS di `.carousel-btn`, `.gesture-image-container`, dll.
- Extend fungsionalitas di class `GestureCarousel`
