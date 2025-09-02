// Gesture Guide Carousel System - wrapped in namespace to avoid conflicts
(function() {
    'use strict';
    
    const gestureActions = ['a', 'f', 'halo', 'i', 'kamu', 'l', 'n', 'nama', 'perkenalkan', 'saya', 'siapa', 'terimakasih', 'u'];

    // Gesture data dengan nama yang lebih user-friendly
    const gestureData = {
        'a': { name: 'Huruf A', image: 'images/placeholder.png' },
        'f': { name: 'Huruf F', image: 'images/placeholder.png' },
        'halo': { name: 'Halo', image: 'images/placeholder.png' },
        'i': { name: 'Huruf I', image: 'images/placeholder.png' },
        'kamu': { name: 'Kamu', image: 'images/placeholder.png' },
        'l': { name: 'Huruf L', image: 'images/placeholder.png' },
        'n': { name: 'Huruf N', image: 'images/placeholder.png' },
        'nama': { name: 'Nama', image: 'images/placeholder.png' },
        'perkenalkan': { name: 'Perkenalkan', image: 'images/placeholder.png' },
        'saya': { name: 'Saya', image: 'images/placeholder.png' },
        'siapa': { name: 'Siapa', image: 'images/placeholder.png' },
        'terimakasih': { name: 'Terima Kasih', image: 'images/placeholder.png' },
        'u': { name: 'Huruf U', image: 'images/placeholder.png' }
    };

    class GestureCarousel {
        constructor() {
            this.currentIndex = 0;
            this.filteredActions = [...gestureActions];
            this.init();
        }

        init() {
            this.gestureImage = document.getElementById('gesture-image');
            this.gestureName = document.getElementById('gesture-name');
            this.gestureCount = document.querySelector('.gesture-count');
            this.prevBtn = document.querySelector('.carousel-btn.prev');
            this.nextBtn = document.querySelector('.carousel-btn.next');
            this.searchInput = document.querySelector('.search-wrapper input');

            this.bindEvents();
            this.updateDisplay();
            this.updateCount();
        }

        bindEvents() {
            // Carousel navigation
            this.prevBtn.addEventListener('click', () => this.previousGesture());
            this.nextBtn.addEventListener('click', () => this.nextGesture());

            // Search functionality
            this.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));

            // Keyboard navigation
            document.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowLeft') {
                    this.previousGesture();
                } else if (e.key === 'ArrowRight') {
                    this.nextGesture();
                }
            });
        }

        updateDisplay() {
            if (this.filteredActions.length === 0) {
                this.gestureImage.src = 'images/placeholder.png';
                this.gestureImage.alt = 'Tidak ada hasil';
                this.gestureName.textContent = 'Tidak ada hasil';
                return;
            }

            const currentAction = this.filteredActions[this.currentIndex];
            const currentGesture = gestureData[currentAction];

            this.gestureImage.src = currentGesture.image;
            this.gestureImage.alt = `Gesture ${currentGesture.name}`;
            this.gestureName.textContent = currentGesture.name;

            // Update button states
            this.prevBtn.disabled = this.filteredActions.length <= 1;
            this.nextBtn.disabled = this.filteredActions.length <= 1;
        }

        updateCount() {
            this.gestureCount.textContent = `(${this.filteredActions.length})`;
        }

        nextGesture() {
            if (this.filteredActions.length > 1) {
                this.currentIndex = (this.currentIndex + 1) % this.filteredActions.length;
                this.updateDisplay();
            }
        }

        previousGesture() {
            if (this.filteredActions.length > 1) {
                this.currentIndex = this.currentIndex === 0 ? 
                    this.filteredActions.length - 1 : this.currentIndex - 1;
                this.updateDisplay();
            }
        }

        handleSearch(query) {
            const searchTerm = query.toLowerCase().trim();
            
            if (searchTerm === '') {
                this.filteredActions = [...gestureActions];
            } else {
                this.filteredActions = gestureActions.filter(action => {
                    const gestureName = gestureData[action].name.toLowerCase();
                    return gestureName.includes(searchTerm) || action.includes(searchTerm);
                });
            }

            // Reset to first item
            this.currentIndex = 0;
            this.updateDisplay();
            this.updateCount();
        }

        // Method untuk mendapatkan gesture saat ini (bisa digunakan oleh sistem lain)
        getCurrentGesture() {
            if (this.filteredActions.length === 0) return null;
            return this.filteredActions[this.currentIndex];
        }

        // Method untuk set gesture berdasarkan nama action
        setGesture(actionName) {
            const index = this.filteredActions.indexOf(actionName);
            if (index !== -1) {
                this.currentIndex = index;
                this.updateDisplay();
            }
        }
    }

    // Inisialisasi carousel ketika DOM sudah siap
    document.addEventListener('DOMContentLoaded', () => {
        window.gestureCarousel = new GestureCarousel();
    });

    // Export untuk digunakan di file lain jika diperlukan
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { GestureCarousel, gestureActions, gestureData };
    }

})(); // End of IIFE
