// js/shape.js

const ShapeBuilderApp = {
    // --- KONFIGURASI & STATE ---
    hands: null,
    camera: null,
    isCameraOn: false,
    
    vertices: [],
    currentVertices: 3,
    shapeNames: { 3: "Segitiga", 4: "Segiempat", 5: "Pentagon", 6: "Hexagon", 7: "Heptagon", 8: "Octagon" },

    // dragInfo: { left: { active: false, vertex: null }, right: { active: false, vertex: null } },
    // --- DIUBAH: Melacak status cubit dan posisi jari untuk indikator ---
    handStates: {
        left: { active: false, vertex: null, pinching: false, indexTipPos: null },
        right: { active: false, vertex: null, pinching: false, indexTipPos: null }
    },
    lastClickTime: 0, // Untuk tombol UI
    
    PINCH_THRESHOLD: 0.05,
    DRAG_RADIUS: 50,
    SMOOTHING: 0.25,
    MAX_VERTICES: 8,
    MIN_VERTICES: 3,

    startIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`,
    stopIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>`,

    elements: {
        video: document.querySelector('.input_video'),
        canvas: document.getElementById('output_canvas'),
        loadingOverlay: document.getElementById('loading-overlay'),
        predictionDisplay: document.getElementById('prediction-display'),
        statusIndicator: document.getElementById('status-indicator'),
        statusText: document.getElementById('status-text'),
        toggleButton: document.getElementById('toggleButton'),
    },

    async init() {
        this.setupEventListeners();
        await this.loadMediaPipe();
    },

    async loadMediaPipe() {
        this.elements.loadingOverlay.style.display = 'flex';
        try {
            this.hands = new Hands({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            });
            this.hands.setOptions({
                maxNumHands: 2, // Memungkinkan deteksi dua tangan
                modelComplexity: 1, 
                minDetectionConfidence: 0.7,
                minTrackingConfidence: 0.7, 
                selfieMode: true,
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
            console.error("Gagal memuat MediaPipe:", error);
            this.updateStatus('ERROR', 'red');
        }
    },

    onResults(results) {
        const canvasCtx = this.elements.canvas.getContext('2d');
        const w = this.elements.canvas.width;
        const h = this.elements.canvas.height;

        canvasCtx.clearRect(0, 0, w, h);
        canvasCtx.drawImage(results.image, 0, 0, w, h);

        if (this.isCameraOn && this.vertices.length === 0) {
            this.setupShape(w, h);
        }

        // --- DIUBAH: Reset handStates untuk tangan yang tidak terdeteksi ---
        const detectedHandLabels = results.multiHandedness.map(h => h.label.toLowerCase());
        ['left', 'right'].forEach(hand => {
            if (!detectedHandLabels.includes(hand)) {
                this.handStates[hand] = { active: false, vertex: null, pinching: false, indexTipPos: null };
            }
        });

        if (results.multiHandLandmarks) {
            for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                const landmarks = results.multiHandLandmarks[i];
                const handedness = results.multiHandedness[i];
                this._handleInteraction(landmarks, handedness, w, h);
            }
        }
        
        if(this.isCameraOn) this._drawScene(canvasCtx, w, h);
    },

    // --- METODE HELPER ---
    _distance(p1, p2) { return Math.hypot(p1.x - p2.x, p1.y - p2.y); },
    _isPinch(landmarks) {
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        return Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y) < this.PINCH_THRESHOLD;
    },
    _calculateAngle(p1, p2, p3) {
        const a = this._distance(p2, p3), b = this._distance(p1, p2), c = this._distance(p1, p3);
        if (a * b === 0) return 0;
        const val = Math.max(-1, Math.min(1, (a**2 + b**2 - c**2) / (2 * a * b)));
        return Math.acos(val) * (180 / Math.PI);
    },
    _isClose(a, b, relTol = 0.15) { return Math.abs(a - b) <= relTol * Math.max(Math.abs(a), Math.abs(b)); },
    _isAngleClose(a, b, absTol = 8) { return Math.abs(a - b) <= absTol; },

    setupShape(w, h) {
        const centerX = w / 2, centerY = h / 2, radius = Math.min(w, h) / 4;
        this.vertices = [];
        for (let i = 0; i < this.currentVertices; i++) {
            const angle = (2 * Math.PI * i / this.currentVertices) - Math.PI / 2;
            this.vertices.push({
                x: Math.round(centerX + radius * Math.cos(angle)),
                y: Math.round(centerY + radius * Math.sin(angle)),
            });
        }
    },

    classifyShape() {
        if (this.currentVertices < 3 || this.currentVertices > 4) return "";
        const sides = this.vertices.map((v, i, arr) => this._distance(v, arr[(i + 1) % arr.length]));
        const angles = this.vertices.map((v, i, arr) => this._calculateAngle(arr[i === 0 ? arr.length - 1 : i - 1], v, arr[(i + 1) % arr.length]));
        if (this.currentVertices === 3) {
            const [a1, a2, a3] = angles;
            const isEquilateral = this._isAngleClose(a1, a2) && this._isAngleClose(a2, a3);
            if (isEquilateral) return "Sama Sisi";
            const isIsosceles = this._isAngleClose(a1, a2) || this._isAngleClose(a2, a3) || this._isAngleClose(a1, a3);
            const isRight = angles.some(a => this._isAngleClose(a, 90, 5));
            const isObtuse = angles.some(a => a > 95);
            if (isIsosceles) {
                if (isRight) return "Siku-siku Sama Kaki";
                if (isObtuse) return "Tumpul Sama Kaki";
                return "Sama Kaki (Lancip)";
            } else {
                if (isRight) return "Siku-siku Sembarang";
                if (isObtuse) return "Tumpul Sembarang";
                return "Lancip Sembarang";
            }
        }
        if (this.currentVertices === 4) {
            // --- DIUBAH: Definisikan semua variabel sisi dan sudut ---
            const [s1, s2, s3, s4] = sides;
            const [a1, a2, a3, a4] = angles;
            
            // Logika pengecekan (sekarang variabelnya sudah benar)
            const allAngles90 = angles.every(a => this._isAngleClose(a, 90));
            const allSidesEqual = sides.every(s => this._isClose(s, sides[0]));
            const oppositeSidesEqual = this._isClose(s1, s3) && this._isClose(s2, s4);
            
            // Pengecekan trapesium sekarang akan berfungsi
            const onePairParallel = this._isAngleClose(a1 + a2, 180) || this._isAngleClose(a2 + a3, 180);

            // Urutan pengecekan (tidak berubah)
            if (allAngles90 && allSidesEqual) return "Persegi";
            if (allAngles90) return "Persegi Panjang";
            if (allSidesEqual) return "Belah Ketupat";
            if (oppositeSidesEqual) return "Jajar Genjang";
            if (onePairParallel) return "Trapesium";

            return "Sembarang";
        }
        return "";
    },
    
    _handleInteraction(landmarks, handedness, w, h) {
        const handLabel = handedness.label.toLowerCase(); // 'left' or 'right'
        const indexTip = landmarks[8];
        const pos = { x: indexTip.x * w, y: indexTip.y * h };
        const pinching = this._isPinch(landmarks);
        
        // --- DIUBAH: Update status tangan ---
        this.handStates[handLabel].pinching = pinching;
        this.handStates[handLabel].indexTipPos = pos; // Simpan posisi untuk indikator

        const handState = this.handStates[handLabel];
        const otherHandLabel = handLabel === 'left' ? 'right' : 'left';
        const otherHandState = this.handStates[otherHandLabel];

        if (pinching) {
            if (!handState.active) {
                // Cek tombol UI jika sedang mencubit
                const buttonPressed = this._handleButtonClick(pos, w, h);
                if (!buttonPressed) { // Jika tidak ada tombol yang ditekan, coba drag vertex
                    for (let i = 0; i < this.vertices.length; i++) {
                        // Pastikan tangan ini tidak mengontrol vertex yang sudah dikontrol tangan lain
                        if (this._distance(pos, this.vertices[i]) < this.DRAG_RADIUS && i !== otherHandState.vertex) {
                            handState.active = true;
                            handState.vertex = i;
                            break;
                        }
                    }
                }
            } else if (handState.vertex !== null) { // Jika sudah aktif dan mengontrol vertex
                const target = pos, current = this.vertices[handState.vertex];
                current.x += (target.x - current.x) * this.SMOOTHING;
                current.y += (target.y - current.y) * this.SMOOTHING;
            }
        } else { // Jika tidak mencubit, nonaktifkan drag
            handState.active = false;
            handState.vertex = null;
        }
    },

    _handleButtonClick(pos, w, h) {
        if (Date.now() - this.lastClickTime < 500) return false;
        
        // --- DIUBAH: Koordinat x dihitung dari lebar canvas (w) ---
        const buttons = [
            { x: w - 190, y: 20, w: 50, h: 50, action: 'add' },    // Tombol +
            { x: w - 130, y: 20, w: 50, h: 50, action: 'remove' }, // Tombol -
            { x: w - 70,  y: 20, w: 50, h: 50, action: 'reset' }   // Tombol R
        ];

        for (const btn of buttons) {
            if (pos.x > btn.x && pos.x < btn.x + btn.w && pos.y > btn.y && pos.y < btn.y + btn.h) {
                let changed = false;
                if (btn.action === 'add' && this.currentVertices < this.MAX_VERTICES) {
                    this.currentVertices++;
                    changed = true;
                }
                if (btn.action === 'remove' && this.currentVertices > this.MIN_VERTICES) {
                    this.currentVertices--;
                    changed = true;
                }
                if (btn.action === 'reset') {
                    changed = true;
                }

                if (changed) {
                    this.setupShape(w, h);
                    this.lastClickTime = Date.now();
                }
                return true;
            }
        }
        return false;
    },
    
    _drawScene(ctx, w, h) {
        // Gambar Bentuk
        if (this.vertices.length > 2) {
            ctx.beginPath();
            ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
            this.vertices.forEach(v => ctx.lineTo(v.x, v.y));
            ctx.closePath();
            ctx.strokeStyle = '#00FF00'; ctx.lineWidth = 4; ctx.stroke();
            this.vertices.forEach((v, i) => {
                // --- DIUBAH: Cek status drag dari kedua tangan ---
                const isDragging = this.handStates.left.vertex === i || this.handStates.right.vertex === i;
                ctx.beginPath();
                ctx.arc(v.x, v.y, 15, 0, 2 * Math.PI);
                ctx.fillStyle = isDragging ? '#FF0000' : '#6464FF'; ctx.fill();
                ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3; ctx.stroke();
                if (this.currentVertices <= 4) {
                    const angle = this._calculateAngle(this.vertices[i === 0 ? this.vertices.length - 1 : i - 1], v, this.vertices[(i + 1) % this.vertices.length]);
                    // --- DIUBAH: Perbesar ukuran font ---
                    ctx.font = 'bold 24px Poppins'; // Font lebih besar
                    ctx.fillStyle = '#FFFF00';
                    ctx.fillText(`${Math.round(angle)}°`, v.x + 20, v.y - 20);
                }
            });
        }
        
        // Gambar UI Buttons (sama)
        const buttons = [
            { label: '+', x: w - 190, disabled: this.currentVertices >= this.MAX_VERTICES },
            { label: '-', x: w - 130, disabled: this.currentVertices <= this.MIN_VERTICES },
            { label: 'R', x: w - 70,  disabled: false }
        ];
        buttons.forEach(btn => {
            ctx.fillStyle = btn.disabled ? '#555' : '#FF9664';
            ctx.globalAlpha = 0.8;
            ctx.fillRect(btn.x, 20, 50, 50);
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; ctx.strokeRect(btn.x, 20, 50, 50);
            ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 30px Poppins';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(btn.label, btn.x + 25, 48);
        });

        // --- BARU: Gambar indikator cubit untuk setiap tangan ---
        ['left', 'right'].forEach(hand => {
            if (this.handStates[hand].indexTipPos) {
                const pos = this.handStates[hand].indexTipPos;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 12, 0, 2 * Math.PI);
                ctx.fillStyle = this.handStates[hand].pinching ? '#00FF00' : '#00FFFF'; // Hijau saat mencubit, cyan saat tidak
                ctx.fill();
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 3;
                ctx.stroke();
            }
        });

        // Update Teks Prediksi
        const baseName = this.shapeNames[this.currentVertices] || `${this.currentVertices}-gon`;
        const classifiedName = this.classifyShape();
        this.elements.predictionDisplay.innerText = classifiedName ? `${baseName}: ${classifiedName}` : baseName;
    },

    setupEventListeners() {
        this.elements.toggleButton.addEventListener('click', this.toggleCamera.bind(this));
    },
    toggleCamera() {
        if (this.isCameraOn) {
            this.camera.stop(); this.isCameraOn = false; this.setButtonState('inactive');
            this.updateStatus('KAMERA MATI', 'red'); this.elements.predictionDisplay.innerText = '-';
            this.vertices = []; // Kosongkan vertices saat kamera mati
            // --- DIUBAH: Reset status tangan ---
            this.handStates.left = { active: false, vertex: null, pinching: false, indexTipPos: null };
            this.handStates.right = { active: false, vertex: null, pinching: false, indexTipPos: null };
        } else {
            this.camera.start(); this.isCameraOn = true; this.setButtonState('active');
            this.updateStatus('MENUNGGU', 'grey');
        }
    },
    setButtonState(state) {
        const btn = this.elements.toggleButton;
        if (state === 'active') {
            btn.innerHTML = this.stopIcon; btn.className = 'control-button stop'; btn.title = 'Hentikan Kamera';
        } else {
            btn.innerHTML = this.startIcon; btn.className = 'control-button start'; btn.title = 'Mulai Kamera';
        }
    },
    updateStatus(text, color) {
        this.elements.statusText.innerText = text;
        this.elements.statusIndicator.style.backgroundColor = color;
    },
};