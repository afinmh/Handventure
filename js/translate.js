// --- Mendapatkan Elemen UI ---
const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const loadingOverlay = document.getElementById('loading-overlay');
const predictionDisplay = document.getElementById('prediction-display');
const statusText = document.getElementById('status-text');
const statusIndicator = document.getElementById('status-indicator');
const toggleButton = document.getElementById('toggleButton');
const guideModal = document.getElementById('guide-modal');
const calibrationOverlay = document.getElementById('calibration-overlay');
const startCalibrationBtn = document.getElementById('start-calibration');
const calibrationText = document.getElementById('calibration-text');
const calibrationBar = document.getElementById('calibration-bar');

// --- Variabel Global ---
let model, actions, camera, holistic;
let sequence = [];
const threshold = 0.85;
let status = 'MENUNGGU';
let last_prediction = "";
let mode = 'NORMAL';
let ejaan_buffer = [];
let isCameraActive = false;

// Variabel untuk tracking canvas dan context
let tempCanvas, tempCtx;
let frameCount = 0;
let lastProcessTime = 0;
const PROCESS_INTERVAL = 33; // ~30 FPS limit untuk mencegah overload

// --- Kalibrasi Bahu ---
const LEFT_SHOULDER_THRESH  = [0.70, 0.85, 0.75, 0.90];
const RIGHT_SHOULDER_THRESH = [0.20, 0.40, 0.75, 0.90];
let isCalibrated = false;
let calibrationProgress = 0;
let calibrationFrames = 0;
const CALIBRATION_FRAMES_NEEDED = 30;
let leftShoulderCalibrated = false;
let rightShoulderCalibrated = false;

// --- Daftar actions HARUS sesuai dengan model 138 fitur ---
actions = ['a', 'f', 'halo', 'i', 'kamu', 'l', 'n', 'nama', 'perkenalkan', 'saya', 'siapa', 'terimakasih', 'u'];

// --- Ikon untuk Tombol ---
const startIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>`;
const stopIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>`;

// --- Fungsi Helper (extractKeypoints, speak, speakEjaan) tidak berubah ---
function extractKeypoints(results) {
    const pose = results.poseLandmarks ? results.poseLandmarks.map(res => [res.x, res.y]).flat() : new Array(33*2).fill(0);
    const mouth = [pose[9*2], pose[9*2+1], pose[0], pose[1], pose[13*2], pose[13*2+1], pose[14*2], pose[14*2+1]];
    const shoulders = [pose[11*2], pose[11*2+1], pose[12*2], pose[12*2+1]];
    const lh = results.leftHandLandmarks ? results.leftHandLandmarks.map(res => [res.x, res.y, res.z]).flat() : new Array(21*3).fill(0);
    const rh = results.rightHandLandmarks ? results.rightHandLandmarks.map(res => [res.x, res.y, res.z]).flat() : new Array(21*3).fill(0);
    return [...mouth, ...shoulders, ...lh, ...rh];
}
// --- [PERBAIKAN] Menggunakan API TTS yang Anda minta ---
async function speak(text) { if (!text) return; const apiUrl = `https://tts-api.netlify.app/?text=${encodeURIComponent(text)}&lang=id`; try { const response = await fetch(apiUrl); if (!response.ok) throw new Error(`API request failed`); const blob = await response.blob(); const audioUrl = URL.createObjectURL(blob); new Audio(audioUrl).play(); } catch (e) { console.error("Error pada API TTS:", e); } }
function speakEjaan(letterArray) { if (!letterArray || letterArray.length === 0) return; let index = 0; async function speakNext() { if (index >= letterArray.length) return; const letter = letterArray[index]; const apiUrl = `https://tts-api.netlify.app/.netlify/functions/api?text=${encodeURIComponent(letter)}&lang=id&speed=1.2`; try { const response = await fetch(apiUrl); if (!response.ok) throw new Error(`API request failed`); const blob = await response.blob(); const audioUrl = URL.createObjectURL(blob); const audio = new Audio(audioUrl); audio.onended = () => { index++; speakNext(); }; audio.play(); } catch (e) { console.error(`Error pada API TTS untuk huruf '${letter}':`, e); index++; speakNext(); } } speakNext(); }


// --- Fungsi Utama Aplikasi ---
async function onResults(results) {
    // Early return jika kamera tidak aktif
    if (!isCameraActive) return;
    
    // Throttling untuk mencegah overload - limit ke ~30 FPS
    const now = Date.now();
    if (now - lastProcessTime < PROCESS_INTERVAL) {
        return;
    }
    lastProcessTime = now;
    
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, { color: 'rgba(0, 255, 0, 0.5)', lineWidth: 2 });
    drawConnectors(canvasCtx, results.leftHandLandmarks, HAND_CONNECTIONS, { color: 'rgba(204, 0, 0, 0.8)', lineWidth: 3 });
    drawConnectors(canvasCtx, results.rightHandLandmarks, HAND_CONNECTIONS, { color: 'rgba(0, 204, 0, 0.8)', lineWidth: 3 });
    
    // Jika belum dikalibrasi, lakukan kalibrasi bahu
    if (!isCalibrated && results.poseLandmarks) {
        checkShoulderCalibration(results.poseLandmarks);
        return;
    }
    
    const isVisible = results.poseLandmarks && (results.leftHandLandmarks || results.rightHandLandmarks);
    if (isVisible) { if (status === 'MENUNGGU') { status = 'MEREKAM'; } if (status === 'MEREKAM') { const keypoints = extractKeypoints(results); sequence.push(keypoints); sequence = sequence.slice(-20); } } else { status = 'MENUNGGU'; sequence = []; }
    if (sequence.length === 20) { 
        let inputTensor, prediction;
        try {
            inputTensor = tf.tensor([sequence]); 
            prediction = model.predict(inputTensor); 
            const res = await prediction.data(); 
            
            const maxProb = Math.max(...res); 
            if (maxProb > threshold) { 
                const predIndex = res.indexOf(maxProb); 
                const currentPrediction = actions[predIndex]; 
                if (mode === 'NORMAL') { 
                    if (currentPrediction !== last_prediction) { 
                        last_prediction = currentPrediction; 
                        speak(currentPrediction); 
                    } 
                } else if (mode === 'EJA') { 
                    if (!ejaan_buffer.length || currentPrediction !== ejaan_buffer[ejaan_buffer.length - 1]) { 
                        ejaan_buffer.push(currentPrediction); 
                        last_prediction = ""; 
                    } 
                } 
            } 
        } finally {
            // Cleanup tensors to prevent memory leak
            if (inputTensor) tf.dispose(inputTensor);
            if (prediction) tf.dispose(prediction);
        }
        sequence = []; 
    }
    predictionDisplay.textContent = mode === 'EJA' ? 'EJA: ' + ejaan_buffer.join('') : last_prediction;
    statusText.textContent = (status === 'MEREKAM') ? `MEREKAM (${sequence.length}/20)` : "MENUNGGU";
    statusIndicator.classList.toggle('recording', status === 'MEREKAM');
}

// --- Fungsi Kalibrasi Bahu ---
function checkShoulderCalibration(poseLandmarks) {
    const leftShoulder = poseLandmarks[11]; // LEFT_SHOULDER
    const rightShoulder = poseLandmarks[12]; // RIGHT_SHOULDER
    
    if (!leftShoulder || !rightShoulder) return;
    
    // Cek apakah bahu kiri dalam zona
    const leftInZone = leftShoulder.x >= LEFT_SHOULDER_THRESH[0] && 
                       leftShoulder.x <= LEFT_SHOULDER_THRESH[1] && 
                       leftShoulder.y >= LEFT_SHOULDER_THRESH[2] && 
                       leftShoulder.y <= LEFT_SHOULDER_THRESH[3];
    
    // Cek apakah bahu kanan dalam zona
    const rightInZone = rightShoulder.x >= RIGHT_SHOULDER_THRESH[0] && 
                        rightShoulder.x <= RIGHT_SHOULDER_THRESH[1] && 
                        rightShoulder.y >= RIGHT_SHOULDER_THRESH[2] && 
                        rightShoulder.y <= RIGHT_SHOULDER_THRESH[3];
    
    // Gambar titik bahu untuk debugging
    drawShoulderPoints(leftShoulder, rightShoulder);
    
    // Update status zona
    const leftZone = document.querySelector('.left-shoulder');
    const rightZone = document.querySelector('.right-shoulder');
    
    if (leftInZone && !leftShoulderCalibrated) {
        leftZone.classList.add('calibrated');
        leftShoulderCalibrated = true;
    } else if (!leftInZone && leftShoulderCalibrated) {
        leftZone.classList.remove('calibrated');
        leftShoulderCalibrated = false;
    }
    
    if (rightInZone && !rightShoulderCalibrated) {
        rightZone.classList.add('calibrated');
        rightShoulderCalibrated = true;
    } else if (!rightInZone && rightShoulderCalibrated) {
        rightZone.classList.remove('calibrated');
        rightShoulderCalibrated = false;
    }
    
    // Jika kedua bahu dalam zona, mulai hitung mundur
    if (leftInZone && rightInZone) {
        calibrationFrames++;
        calibrationProgress = (calibrationFrames / CALIBRATION_FRAMES_NEEDED) * 100;
        calibrationBar.style.width = calibrationProgress + '%';
        
        if (calibrationFrames >= CALIBRATION_FRAMES_NEEDED) {
            completeCalibration();
        } else {
            calibrationText.textContent = `Pertahankan posisi... ${Math.ceil((CALIBRATION_FRAMES_NEEDED - calibrationFrames) / 10)}`;
        }
    } else {
        calibrationFrames = 0;
        calibrationProgress = 0;
        calibrationBar.style.width = '0%';
        calibrationText.textContent = 'Posisikan kedua bahu pada area hijau';
    }
}

function drawShoulderPoints(leftShoulder, rightShoulder) {
    const canvasWidth = canvasElement.width;
    const canvasHeight = canvasElement.height;
    
    // Gambar titik bahu kiri
    canvasCtx.beginPath();
    canvasCtx.arc(leftShoulder.x * canvasWidth, leftShoulder.y * canvasHeight, 8, 0, 2 * Math.PI);
    canvasCtx.fillStyle = 'red';
    canvasCtx.fill();
    
    // Gambar titik bahu kanan
    canvasCtx.beginPath();
    canvasCtx.arc(rightShoulder.x * canvasWidth, rightShoulder.y * canvasHeight, 8, 0, 2 * Math.PI);
    canvasCtx.fillStyle = 'blue';
    canvasCtx.fill();
}

function completeCalibration() {
    isCalibrated = true;
    calibrationOverlay.classList.remove('show');
    calibrationText.textContent = 'Kalibrasi selesai! Mulai gesture detection...';
    
    // Reset status
    status = 'MENUNGGU';
    last_prediction = '';
    sequence = [];
    
    setTimeout(() => {
        statusText.textContent = 'MENUNGGU';
        predictionDisplay.textContent = '-';
    }, 1000);
}

function setButtonState(state) {
    if (state === 'active') {
        toggleButton.innerHTML = stopIcon;
        toggleButton.className = 'control-button stop';
        toggleButton.title = 'Hentikan Kamera';
    } else {
        toggleButton.innerHTML = startIcon;
        toggleButton.className = 'control-button start';
        toggleButton.title = 'Mulai Kamera';
    }
}

// --- [PERBAIKAN] Fungsi Inisialisasi dan Start/Stop ---

// Fungsi helper untuk update loading text
function updateLoadingText(text) {
    const loadingText = loadingOverlay.querySelector('h3');
    if (loadingText) {
        loadingText.textContent = text;
    }
}

// Fungsi untuk menunggu MediaPipe siap dengan deteksi yang lebih akurat
function waitForMediaPipeReady() {
    return new Promise((resolve) => {
        let isResolved = false;
        let checkCount = 0;
        const maxChecks = 150; // maksimal 15 detik (150 x 100ms)
        
        // Variabel untuk tracking warmup MediaPipe
        let mediapipeReady = false;
        
        // Override console.log sementara untuk mendeteksi pesan MediaPipe
        const originalLog = console.log;
        console.log = function(...args) {
            const message = args.join(' ');
            if (message.includes('holistic_solution_simd_wasm_bin.js') || 
                message.includes('still waiting on run dependencies')) {
                // MediaPipe masih loading
                mediapipeReady = false;
            }
            originalLog.apply(console, args);
        };
        
        const checkReady = async () => {
            if (isResolved) return;
            checkCount++;
            
            // Cek apakah MediaPipe sudah benar-benar siap
            if (typeof holistic !== 'undefined' && holistic.send) {
                try {
                    // Test dengan gambar dummy untuk memastikan MediaPipe berfungsi
                    const testCanvas = document.createElement('canvas');
                    testCanvas.width = 64;
                    testCanvas.height = 64;
                    const testCtx = testCanvas.getContext('2d');
                    testCtx.fillStyle = 'black';
                    testCtx.fillRect(0, 0, 64, 64);
                    
                    // Set flag sebelum test
                    mediapipeReady = true;
                    
                    // Test kirim data ke MediaPipe
                    await holistic.send({ image: testCanvas });
                    
                    // Tunggu sebentar untuk memastikan tidak ada error
                    await new Promise(r => setTimeout(r, 200));
                    
                    if (mediapipeReady) {
                        console.log = originalLog; // Restore console.log
                        console.log('MediaPipe ready after', checkCount * 100, 'ms');
                        isResolved = true;
                        resolve();
                        return;
                    }
                } catch (e) {
                    mediapipeReady = false;
                    console.error('MediaPipe test failed:', e);
                }
            }
            
            if (checkCount < maxChecks) {
                setTimeout(checkReady, 100);
            } else {
                console.log = originalLog; // Restore console.log
                console.warn('MediaPipe warmup timeout, proceeding anyway');
                isResolved = true;
                resolve();
            }
        };
        
        // Mulai pengecekan setelah delay kecil
        setTimeout(checkReady, 100);
    });
}

// Fungsi ini hanya akan dijalankan sekali untuk memuat semua aset
async function initializeApp() {
    loadingOverlay.classList.add('show');
    try {
        updateLoadingText('Memuat Model AI...');
        model = await tf.loadLayersModel('./model_web/bisindo_model_pose.json');
        console.log('Model AI berhasil dimuat');
        
        updateLoadingText('Memuat MediaPipe...');
        holistic = new Holistic({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5/${file}`});
        holistic.setOptions({ 
            minDetectionConfidence: 0.5, 
            minTrackingConfidence: 0.5,
            modelComplexity: 1
        });
        holistic.onResults(onResults);
        console.log('MediaPipe instance created');
        
        updateLoadingText('Warming up MediaPipe...');
        // Tunggu MediaPipe benar-benar siap - ini yang paling penting!
        await waitForMediaPipeReady();
        console.log('MediaPipe warmup complete');
        
        updateLoadingText('Menyiapkan Kamera...');
        
        // Inisialisasi canvas dan context sekali saja
        if (!tempCanvas) {
            tempCanvas = document.createElement('canvas');
            tempCtx = tempCanvas.getContext('2d');
        }
        
        // Buat objek kamera setelah MediaPipe siap
        camera = new Camera(videoElement, {
            onFrame: async () => {
                // Pastikan semua komponen siap sebelum memproses frame
                if (!holistic || !isCameraActive || !videoElement.videoWidth || !videoElement.videoHeight) {
                    return;
                }
                
                try {
                    frameCount++;
                    
                    // Resize canvas hanya jika ukuran berubah
                    if (tempCanvas.width !== videoElement.videoWidth || tempCanvas.height !== videoElement.videoHeight) {
                        tempCanvas.width = videoElement.videoWidth;
                        tempCanvas.height = videoElement.videoHeight;
                    }
                    
                    tempCtx.save();
                    tempCtx.translate(tempCanvas.width, 0); 
                    tempCtx.scale(-1, 1);
                    tempCtx.drawImage(videoElement, 0, 0, tempCanvas.width, tempCanvas.height);
                    tempCtx.restore();
                    
                    await holistic.send({ image: tempCanvas });
                    
                    // Log FPS dan memory usage setiap 100 frame untuk monitoring
                    if (frameCount % 100 === 0) {
                        const memInfo = performance.memory ? {
                            used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                            total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024)
                        } : null;
                        console.log(`Frame ${frameCount} processed${memInfo ? `, Memory: ${memInfo.used}/${memInfo.total}MB` : ''}`);
                    }
                } catch (error) {
                    console.error('Error in onFrame:', error);
                }
            },
            width: 640, height: 480 
        });
        
        updateLoadingText('Siap digunakan!');
        // Delay untuk menunjukkan pesan "siap"
        await new Promise(resolve => setTimeout(resolve, 800));
        
    } catch(e) {
        console.error("Gagal inisialisasi:", e);
        updateLoadingText('Gagal memuat! Coba refresh halaman.');
        alert("Gagal memuat aset penting. Coba muat ulang halaman.");
    } finally {
        loadingOverlay.classList.remove('show');
    }
}

async function startCamera() {
    if (!camera) {
        console.error('Camera object not initialized');
        return;
    }
    
    // Jika kamera sudah aktif, jangan start lagi
    if (isCameraActive) {
        console.warn('Camera already active');
        return;
    }
    
    // Show loading hanya untuk memulai kamera
    loadingOverlay.classList.add('show');
    updateLoadingText('Memulai kamera...');
    
    try {
        // Reset frame counter
        frameCount = 0;
        
        // Pastikan kamera benar-benar berhenti dulu
        if (camera) {
            try {
                await camera.stop();
                // Delay untuk cleanup
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (e) {
                console.warn('Error stopping previous camera instance:', e);
            }
        }
        
        // Reuse existing canvas dan context, tidak buat baru
        if (!tempCanvas) {
            tempCanvas = document.createElement('canvas');
            tempCtx = tempCanvas.getContext('2d');
        }
        
        // Buat ulang camera object dengan reused canvas
        camera = new Camera(videoElement, {
            onFrame: async () => {
                // Pastikan semua komponen siap sebelum memproses frame
                if (!holistic || !isCameraActive || !videoElement.videoWidth || !videoElement.videoHeight) {
                    return;
                }
                
                try {
                    frameCount++;
                    
                    // Resize canvas hanya jika ukuran berubah
                    if (tempCanvas.width !== videoElement.videoWidth || tempCanvas.height !== videoElement.videoHeight) {
                        tempCanvas.width = videoElement.videoWidth;
                        tempCanvas.height = videoElement.videoHeight;
                    }
                    
                    tempCtx.save();
                    tempCtx.translate(tempCanvas.width, 0); 
                    tempCtx.scale(-1, 1);
                    tempCtx.drawImage(videoElement, 0, 0, tempCanvas.width, tempCanvas.height);
                    tempCtx.restore();
                    
                    await holistic.send({ image: tempCanvas });
                } catch (error) {
                    console.error('Error in onFrame:', error);
                }
            },
            width: 640, height: 480 
        });
        
        await camera.start();
        
        // Tunggu kamera benar-benar mulai streaming
        await new Promise(resolve => {
            const checkVideoReady = () => {
                if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                    resolve();
                } else {
                    setTimeout(checkVideoReady, 100);
                }
            };
            checkVideoReady();
        });
        
        isCameraActive = true;
        setButtonState('active');
        console.log("Kamera dimulai. MediaPipe sudah siap untuk deteksi.");
        
        // Tampilkan modal panduan setelah kamera siap
        setTimeout(() => {
            showGuideModal();
        }, 300);
        
    } catch(e) {
        console.error("Gagal memulai kamera:", e);
        updateLoadingText('Gagal memulai kamera!');
        isCameraActive = false;
        setButtonState('inactive');
        setTimeout(() => {
            loadingOverlay.classList.remove('show');
        }, 1500);
    } finally {
        loadingOverlay.classList.remove('show');
    }
}

// --- Fungsi Modal dan Kalibrasi ---
function showGuideModal() {
    guideModal.classList.add('show');
}

function startCalibration() {
    guideModal.classList.remove('show');
    calibrationOverlay.classList.add('show');
    
    // Reset kalibrasi menggunakan fungsi helper
    resetCalibration();
}

function stopCamera() {
    if (camera) {
        try {
            camera.stop();
        } catch (e) {
            console.warn('Error stopping camera:', e);
        }
        
        isCameraActive = false;
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        
        // Reset semua status ke kondisi awal
        status = 'MENUNGGU';
        last_prediction = '';
        sequence = [];
        frameCount = 0;
        lastProcessTime = 0;
        
        // Reset kalibrasi jika sedang berlangsung
        if (!isCalibrated) {
            resetCalibration();
        }
        
        // Sembunyikan overlay kalibrasi jika masih tampil
        calibrationOverlay.classList.remove('show');
        guideModal.classList.remove('show');
        
        // Clear video element
        if (videoElement.srcObject) {
            const tracks = videoElement.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            videoElement.srcObject = null;
        }
        
        // Force garbage collection hint
        if (window.gc) {
            window.gc();
        }
        
        setButtonState('inactive');
        console.log("Kamera dihentikan dan resources dibersihkan. Frame count:", frameCount);
    }
}

// Fungsi helper untuk reset kalibrasi
function resetCalibration() {
    isCalibrated = false;
    calibrationFrames = 0;
    calibrationProgress = 0;
    leftShoulderCalibrated = false;
    rightShoulderCalibrated = false;
    
    // Reset visual elements jika ada
    const leftZone = document.querySelector('.left-shoulder');
    const rightZone = document.querySelector('.right-shoulder');
    
    if (leftZone) leftZone.classList.remove('calibrated');
    if (rightZone) rightZone.classList.remove('calibrated');
    
    if (calibrationBar) calibrationBar.style.width = '0%';
    if (calibrationText) calibrationText.textContent = 'Posisikan kedua bahu pada area hijau';
}

// Fungsi untuk monitoring dan cleanup memory
function performanceCleanup() {
    // TensorFlow.js memory cleanup
    if (typeof tf !== 'undefined') {
        const memInfo = tf.memory();
        console.log('TensorFlow.js Memory:', memInfo);
        
        // Cleanup unused tensors
        tf.disposeVariables();
    }
    
    // Browser memory info
    if (performance.memory) {
        const memInfo = {
            used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
            total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
            limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
        };
        console.log(`Browser Memory: ${memInfo.used}/${memInfo.total}MB (Limit: ${memInfo.limit}MB)`);
    }
}

// --- Event Listeners ---
startCalibrationBtn.addEventListener('click', startCalibration);

toggleButton.addEventListener('click', async () => {
    // Prevent multiple clicks during camera state transition
    if (toggleButton.disabled) return;
    
    toggleButton.disabled = true;
    
    try {
        if (!isCameraActive) {
            await startCamera();
        } else {
            stopCamera();
        }
    } catch (error) {
        console.error('Error toggling camera:', error);
    } finally {
        // Re-enable button after a short delay
        setTimeout(() => {
            toggleButton.disabled = false;
        }, 500);
    }
});

window.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && isCameraActive && isCalibrated) {
        if (mode === 'NORMAL') { mode = 'EJA'; ejaan_buffer = []; last_prediction = ""; } 
        else if (mode === 'EJA') {
            mode = 'NORMAL';
            const kata_ejaan = ejaan_buffer.join('');
            last_prediction = kata_ejaan;
            speak(kata_ejaan); // Mengucapkan kata utuh
            ejaan_buffer = [];
        }
    }
});

// Cleanup saat window ditutup atau refresh
window.addEventListener('beforeunload', () => {
    if (isCameraActive && camera) {
        camera.stop();
    }
});

// Cleanup saat visibility berubah (tab switching)
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isCameraActive) {
        // Optional: pause camera when tab is hidden to save resources
        console.log('Tab hidden, camera still running');
    }
});

// Periodic cleanup untuk mencegah memory leak
setInterval(() => {
    if (isCameraActive && frameCount > 1000) {
        performanceCleanup();
        
        // Reset frame count untuk mencegah overflow
        if (frameCount > 10000) {
            frameCount = 0;
            console.log('Frame counter reset');
        }
    }
}, 30000); // Cleanup setiap 30 detik

// Inisialisasi tampilan tombol awal dan muat aset
setButtonState('inactive');
initializeApp();