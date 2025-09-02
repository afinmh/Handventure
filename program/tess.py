# File: deteksi_pose.py
import cv2
import numpy as np
import os
import threading
from gtts import gTTS
from playsound import playsound
import mediapipe as mp
from tensorflow.keras.models import load_model

# --- 1. SETUP DAN MEMUAT MODEL BARU ---
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

# --- [PERUBAHAN] Muat model baru yang sudah dilatih dengan data pose ---
MODEL_NAME = 'bisindo_model_pose.h5'
model = load_model(MODEL_NAME)

# --- [PERUBAHAN] Path ke dataset baru untuk mendapatkan daftar 'actions' ---
DATA_PATH = os.path.join(os.getcwd(), '../Dataset_BISINDO_Pose')
actions = np.array([folder for folder in os.listdir(DATA_PATH) if os.path.isdir(os.path.join(DATA_PATH, folder))])
print(f"✅ Model '{MODEL_NAME}' dan {len(actions)} kelas berhasil dimuat.")

# --- [PERUBAHAN] Gunakan MediaPipe Holistic ---
mp_holistic = mp.solutions.holistic
mp_drawing = mp.solutions.drawing_utils

# --- [PERUBAHAN] Fungsi extract_keypoints disesuaikan dengan data baru (138 fitur) ---
def extract_keypoints(results):
    pose_landmarks = np.array([[res.x, res.y] for res in results.pose_landmarks.landmark]).flatten() if results.pose_landmarks else np.zeros(33*2)
    mouth_indices = [9, 0, 13, 14]; mouth = np.array([pose_landmarks[i*2:i*2+2] for i in mouth_indices]).flatten()
    shoulders_indices = [11, 12]; shoulders = np.array([pose_landmarks[i*2:i*2+2] for i in shoulders_indices]).flatten()
    lh = np.array([[res.x, res.y, res.z] for res in results.left_hand_landmarks.landmark]).flatten() if results.left_hand_landmarks else np.zeros(21*3)
    rh = np.array([[res.x, res.y, res.z] for res in results.right_hand_landmarks.landmark]).flatten() if results.right_hand_landmarks else np.zeros(21*3)
    return np.concatenate([mouth, shoulders, lh, rh])

# --- 2. FUNGSI TTS DAN UI (Tidak ada perubahan signifikan) ---
def speak(text):
    if not text: return
    try:
        tts = gTTS(text=text, lang='id', slow=False)
        tts.save("prediction.mp3")
        playsound("prediction.mp3")
        os.remove("prediction.mp3")
    except Exception as e:
        print(f"Error pada TTS: {e}")

def draw_ui(image, mode, ejaan_buffer, prediction, status, sequence_len):
    h, w, _ = image.shape
    overlay = image.copy(); alpha = 0.6
    cv2.rectangle(overlay, (0, 0), (w, 50), (24, 24, 24), -1)
    image = cv2.addWeighted(overlay, alpha, image, 1 - alpha, 0)
    if mode == 'EJA':
        display_text = 'EJA: ' + ''.join(ejaan_buffer)
    else:
        display_text = prediction
    cv2.putText(image, display_text, (15, 35), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2, cv2.LINE_AA)
    status_text = f"{status}"
    if status == 'MEREKAM': status_text += f" ({sequence_len}/20)"
    color = (0, 255, 255)
    if status == 'MEREKAM': color = (0, 255, 0)
    if mode == 'EJA': color = (255, 150, 0)
    text_size = cv2.getTextSize(status_text, cv2.FONT_HERSHEY_SIMPLEX, 0.8, 2)[0]
    cv2.putText(image, status_text, (w - text_size[0] - 10, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2, cv2.LINE_AA)
    return image

# --- 3. LOGIKA DETEKSI UTAMA ---
sequence = []
threshold = 0.85 # Threshold bisa sedikit diturunkan untuk model yang lebih kompleks
status = 'MENUNGGU GERAKAN'
last_prediction = ""
mode = 'NORMAL'
ejaan_buffer = []

cap = cv2.VideoCapture(0)
with mp_holistic.Holistic(min_detection_confidence=0.5, min_tracking_confidence=0.5) as holistic:
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret: break
        frame = cv2.flip(frame, 1)

        image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = holistic.process(image)
        image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)

        # --- [PERUBAHAN] Menggambar semua landmark (pose dan tangan) ---
        if results.pose_landmarks: mp_drawing.draw_landmarks(image, results.pose_landmarks, mp_holistic.POSE_CONNECTIONS)
        if results.left_hand_landmarks: mp_drawing.draw_landmarks(image, results.left_hand_landmarks, mp_holistic.HAND_CONNECTIONS)
        if results.right_hand_landmarks: mp_drawing.draw_landmarks(image, results.right_hand_landmarks, mp_holistic.HAND_CONNECTIONS)
        
        keypoints = extract_keypoints(results)
        
        # --- [PERUBAHAN] Logika state machine disesuaikan untuk pose dan tangan ---
        is_visible = results.pose_landmarks and (results.left_hand_landmarks or results.right_hand_landmarks)

        if status == 'MENUNGGU GERAKAN' and is_visible:
            status = 'MEREKAM'
        
        if status == 'MEREKAM':
            sequence.append(keypoints)
            
            if len(sequence) == 20:
                input_tensor = np.expand_dims(sequence, axis=0)
                res = model.predict(input_tensor, verbose=0)[0]
                sequence = []
                
                prediction_idx = np.argmax(res)
                confidence = res[prediction_idx]

                if confidence > threshold:
                    prediction = actions[prediction_idx]
                    
                    if mode == 'NORMAL':
                        if prediction != last_prediction:
                            last_prediction = prediction
                            threading.Thread(target=speak, args=(prediction,)).start()
                    elif mode == 'EJA':
                        if not ejaan_buffer or prediction != ejaan_buffer[-1]:
                            ejaan_buffer.append(prediction)
                            last_prediction = ""

            if not is_visible:
                status = 'MENUNGGU GERAKAN'
                sequence = []

        image = draw_ui(image, mode, ejaan_buffer, last_prediction, status, len(sequence))
        cv2.imshow('Deteksi Bahasa Isyarat', image)

        # Cek Tombol Keyboard
        key = cv2.waitKey(10) & 0xFF
        if key == ord('q'): break
        if key == 13:
            if mode == 'NORMAL':
                mode = 'EJA'
                ejaan_buffer = []; last_prediction = ""
                print("--- Masuk Mode Eja ---")
            elif mode == 'EJA':
                mode = 'NORMAL'
                kata_ejaan = "".join(ejaan_buffer)
                last_prediction = kata_ejaan
                threading.Thread(target=speak, args=(kata_ejaan,)).start()
                print(f"--- Keluar Mode Eja, Kata Dihasilkan: {kata_ejaan} ---")
                ejaan_buffer = []
    
    cap.release()
    cv2.destroyAllWindows()