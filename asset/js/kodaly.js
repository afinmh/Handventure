// js/kodaly.js

const HandventureApp = {
    // State dan Konfigurasi (tidak ada perubahan)
    model: null,
    labelMap: null,
    labels: null,
    hands: null,
    camera: null,
    isCameraOn: false,
    gestureList: [],
    currentGestureIndex: 0,
    lastPredictionTime: 0,
    predictionCooldown: 800,
    lastPlayedNote: null,
    startIcon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>`,
    stopIcon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>`,

    // Referensi Elemen DOM (tidak ada perubahan)
    elements: {
        video: document.querySelector('.input_video'),
        canvas: document.getElementById('output_canvas'),
        loadingOverlay: document.getElementById('loading-overlay'),
        predictionDisplay: document.getElementById('prediction-display'),
        statusIndicator: document.getElementById('status-indicator'),
        statusText: document.getElementById('status-text'),
        toggleButton: document.getElementById('toggleButton'),
        gestureImage: document.getElementById('gesture-image'),
        gestureName: document.getElementById('gesture-name'),
        prevBtn: document.querySelector('.carousel-btn.prev'),
        nextBtn: document.querySelector('.carousel-btn.next'),
    },

    // Inisialisasi Utama (tidak ada perubahan)
    async init() {
        if (!this.elements.toggleButton) {
            console.error("Tombol tidak ditemukan!");
            return;
        }
        this.setupEventListeners();
        await this.loadModelsAndMediaPipe();
    },

    // Pemuatan Model dan MediaPipe (tidak ada perubahan)
    async loadModelsAndMediaPipe() {
        this.elements.loadingOverlay.style.display = 'flex';
        try {
            this.model = await tf.loadLayersModel('../model_web/model_classifier_tfjs.json');
            const response = await fetch('../model_web/label_map.json');
            this.labelMap = await response.json();
            this.labels = Object.fromEntries(Object.entries(this.labelMap).map(([key, value]) => [value, key]));
            this.setupCarousel();
            this.hands = new Hands({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            });
            this.hands.setOptions({
                maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5, selfieMode: true,
            });
            this.hands.onResults(this.onResults.bind(this));
            this.camera = new Camera(this.elements.video, {
                onFrame: async () => { await this.hands.send({ image: this.elements.video }); },
                width: 1280, height: 720
            });
            this.updateStatus('SIAP', 'orange');
            this.elements.loadingOverlay.style.display = 'none';
            this.setButtonState('inactive');
        } catch (error) {
            console.error("Gagal memuat:", error);
            this.elements.loadingOverlay.querySelector('h3').innerText = 'Gagal Memuat Model!';
            this.updateStatus('ERROR', 'red');
        }
    },

    // --- PERUBAHAN UTAMA ADA DI FUNGSI INI ---
    onResults(results) {
        const canvasCtx = this.elements.canvas.getContext('2d');
        canvasCtx.clearRect(0, 0, this.elements.canvas.width, this.elements.canvas.height);
        canvasCtx.drawImage(results.image, 0, 0, this.elements.canvas.width, this.elements.canvas.height);

        let rightHandLandmarks = null;
        let isLeftHandVisible = false; // --- PERUBAHAN TANGAN KIRI 1: Flag untuk deteksi tangan kiri ---

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                const landmarks = results.multiHandLandmarks[i];
                const classification = results.multiHandedness[i];
                const label = classification.label;

                drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 5 });
                drawLandmarks(canvasCtx, landmarks, { color: label === 'Right' ? '#0000FF' : '#FF0000', lineWidth: 2 });

                if (label === 'Right') {
                    rightHandLandmarks = landmarks;
                }
                // --- PERUBAHAN TANGAN KIRI 2: Set flag jika tangan kiri terlihat ---
                if (label === 'Left') {
                    isLeftHandVisible = true;
                }
            }
        }

        if (rightHandLandmarks) {
            this.updateStatus('MENDETEKSI', 'green');
            const now = Date.now();
            if (now - this.lastPredictionTime > this.predictionCooldown) {
                this.lastPredictionTime = now;
                tf.tidy(() => {
                    const features = this.normalizeLandmarks(rightHandLandmarks);
                    const inputTensor = tf.tensor2d([features]);
                    const prediction = this.model.predict(inputTensor);
                    const highestProbIndex = prediction.argMax(1).dataSync()[0];
                    const predictedClass = this.labels[highestProbIndex];
                    
                    this.elements.predictionDisplay.innerText = predictedClass;

                    // --- PERUBAHAN TANGAN KIRI 3: Logika Audio Baru ---
                    let noteToPlay = predictedClass; // Secara default, mainkan nada yang terprediksi

                    // Jika tangan kiri terlihat DAN prediksi tangan kanan adalah 'do'
                    if (isLeftHandVisible && predictedClass === 'do') {
                        noteToPlay = 'do_tinggi'; // Ganti nada yang akan dimainkan
                        console.log("Modifier Tangan Kiri Aktif! Memainkan 'do_tinggi'");
                    }
                    
                    if (noteToPlay && noteToPlay !== this.lastPlayedNote) {
                        const audioPath = `../asset/audio/${noteToPlay}.mp3`;
                        const sound = new Audio(audioPath);
                        sound.play().catch(e => console.error(`Error audio: ${e.message}`));
                        this.lastPlayedNote = noteToPlay;
                    }
                });
            }
        } else {
            this.updateStatus('MENUNGGU', 'grey');
            this.elements.predictionDisplay.innerText = '-';
            this.lastPlayedNote = null;
        }
    },

    // Fungsi lainnya (Normalisasi, UI) tidak ada perubahan
    normalizeLandmarks(landmarks) {
        const wrist = landmarks[0];
        const translatedLandmarks = landmarks.map(lm => ({ x: lm.x - wrist.x, y: lm.y - wrist.y, z: lm.z - wrist.z }));
        const flatCoords = translatedLandmarks.flatMap(lm => [lm.x, lm.y, lm.z]);
        const maxVal = Math.max(...flatCoords.map(Math.abs)) + 1e-8;
        return flatCoords.map(coord => coord / maxVal);
    },
    setupEventListeners() {
        this.elements.toggleButton.addEventListener('click', this.toggleCamera.bind(this));
        this.elements.prevBtn.addEventListener('click', this.prevGesture.bind(this));
        this.elements.nextBtn.addEventListener('click', this.nextGesture.bind(this));
    },
    toggleCamera() {
        if (this.isCameraOn) {
            this.camera.stop();
            this.isCameraOn = false;
            this.setButtonState('inactive');
            this.updateStatus('KAMERA MATI', 'red');
            this.elements.predictionDisplay.innerText = '-';
            this.lastPlayedNote = null;
        } else {
            this.camera.start();
            this.isCameraOn = true;
            this.setButtonState('active');
            this.updateStatus('MENUNGGU', 'grey');
        }
    },
    setButtonState(state) {
        const toggleButton = this.elements.toggleButton;
        if (state === 'active') {
            toggleButton.innerHTML = this.stopIcon;
            toggleButton.className = 'control-button stop';
            toggleButton.title = 'Hentikan Kamera';
        } else {
            toggleButton.innerHTML = this.startIcon;
            toggleButton.className = 'control-button start';
            toggleButton.title = 'Mulai Kamera';
        }
    },
    updateStatus(text, color) {
        this.elements.statusText.innerText = text;
        this.elements.statusIndicator.style.backgroundColor = color;
    },
    setupCarousel() {
        this.gestureList = Object.keys(this.labelMap);
        this.currentGestureIndex = 0;
        this.updateCarouselDisplay();
    },
    updateCarouselDisplay() {
        const gestureName = this.gestureList[this.currentGestureIndex];
        this.elements.gestureName.innerText = gestureName;
        this.elements.gestureImage.src = `../asset/images/gestures/${gestureName}.png`;
    },
    nextGesture() {
        this.currentGestureIndex = (this.currentGestureIndex + 1) % this.gestureList.length;
        this.updateCarouselDisplay();
    },
    prevGesture() {
        this.currentGestureIndex = (this.currentGestureIndex - 1 + this.gestureList.length) % this.gestureList.length;
        this.updateCarouselDisplay();
    }
};