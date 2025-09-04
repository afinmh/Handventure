// /js/main.js

// --- Fungsionalitas Navbar Scroll ---

// 1. Pilih elemen navbar
const navbar = document.querySelector('.navbar');

// 2. Dapatkan tinggi dari navbar itu sendiri sebagai batas awal
// Ini lebih dinamis daripada angka mati seperti 100px
const scrollThreshold = navbar.offsetHeight;

// 3. Tambahkan event listener saat window di-scroll
window.addEventListener('scroll', () => {
    // 4. Periksa posisi scroll vertikal (window.scrollY)
    // Jika posisi scroll lebih besar dari batas (misal, tinggi navbar),
    // maka tambahkan class 'scrolled'.
    if (window.scrollY > scrollThreshold) {
        navbar.classList.add('scrolled');
    } else {
        // Jika tidak (kembali ke atas), hapus class 'scrolled'.
        navbar.classList.remove('scrolled');
    }
});

// --- (Mungkin ada kode lain di bawah sini, seperti untuk hamburger menu) ---

// Pastikan kode hamburger menu (jika ada) tetap ada di bawah ini.
const hamburger = document.querySelector('#hamburger-menu');
const navMenu = document.querySelector('.navbar-nav');

hamburger.addEventListener('click', function(e) {
    e.preventDefault();
    navMenu.classList.toggle('active');
});

