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
    if (sequence.length === 20) { const inputTensor = tf.tensor([sequence]); const prediction = model.predict(inputTensor); const res = await prediction.data(); tf.dispose(inputTensor); tf.dispose(prediction); const maxProb = Math.max(...res); if (maxProb > threshold) { const predIndex = res.indexOf(maxProb); const currentPrediction = actions[predIndex]; if (mode === 'NORMAL') { if (currentPrediction !== last_prediction) { last_prediction = currentPrediction; speak(currentPrediction); } } else if (mode === 'EJA') { if (!ejaan_buffer.length || currentPrediction !== ejaan_buffer[ejaan_buffer.length - 1]) { ejaan_buffer.push(currentPrediction); last_prediction = ""; } } } sequence = []; }
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

// Fungsi ini hanya akan dijalankan sekali untuk memuat semua aset
async function initializeApp() {
    loadingOverlay.classList.add('show');
    try {
        updateLoadingText('Memuat Model AI...');
        model = await tf.loadLayersModel('./model_web/bisindo_model_pose.json');
        
        updateLoadingText('Memuat MediaPipe...');
        holistic = new Holistic({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5/${file}`});
        holistic.setOptions({ minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
        holistic.onResults(onResults);
        
        updateLoadingText('Menyiapkan Kamera...');
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        // Buat objek kamera sekali dan simpan
        camera = new Camera(videoElement, {
            onFrame: async () => {
                tempCanvas.width = videoElement.videoWidth;
                tempCanvas.height = videoElement.videoHeight;
                tempCtx.translate(tempCanvas.width, 0); tempCtx.scale(-1, 1);
                tempCtx.drawImage(videoElement, 0, 0, tempCanvas.width, tempCanvas.height);
                await holistic.send({ image: tempCanvas });
            },
            width: 640, height: 480 
        });
        
        updateLoadingText('Siap digunakan!');
        // Small delay to show "ready" message
        await new Promise(resolve => setTimeout(resolve, 500));
        
    } catch(e) {
        console.error("Gagal inisialisasi:", e);
        updateLoadingText('Gagal memuat! Coba refresh halaman.');
        alert("Gagal memuat aset penting. Coba muat ulang halaman.");
    } finally {
        loadingOverlay.classList.remove('show');
    }
}

async function startCamera() {
    if (!camera) return;
    
    // Show loading for MediaPipe warmup
    loadingOverlay.classList.add('show');
    updateLoadingText('Memulai kamera...');
    
    try {
        await camera.start();

        updateLoadingText('Menyiapkan MediaPipe...');
        // Wait a bit longer for MediaPipe to fully initialize
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        isCameraActive = true;
        setButtonState('active');
        console.log("Kamera dimulai. Warmup Model.");
        
        // Tampilkan modal panduan setelah MediaPipe siap
        showGuideModal();
        
    } catch(e) {
        console.error("Gagal memulai kamera:", e);
        updateLoadingText('Gagal memulai kamera!');
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
    
    // Reset kalibrasi
    isCalibrated = false;
    calibrationFrames = 0;
    calibrationProgress = 0;
    leftShoulderCalibrated = false;
    rightShoulderCalibrated = false;
    
    // Reset visual elements
    document.querySelector('.left-shoulder').classList.remove('calibrated');
    document.querySelector('.right-shoulder').classList.remove('calibrated');
    calibrationBar.style.width = '0%';
    calibrationText.textContent = 'Posisikan kedua bahu pada area hijau';
}

function stopCamera() {
    if (camera) {
        camera.stop();
        isCameraActive = false;
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        status = 'MENUNGGU';
        last_prediction = '';
        setButtonState('inactive');
        console.log("Kamera dihentikan.");
    }
}

// --- Event Listeners ---
startCalibrationBtn.addEventListener('click', startCalibration);

toggleButton.addEventListener('click', () => {
    if (!isCameraActive) {
        startCamera();
    } else {
        stopCamera();
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

// Inisialisasi tampilan tombol awal dan muat aset
setButtonState('inactive');
initializeApp();