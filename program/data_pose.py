# File: collect_data_pose.py (Versi dengan Opsi Melanjutkan)
import cv2
import numpy as np
import os
import shutil
import time
import mediapipe as mp

# --- Inisialisasi MediaPipe ---
mp_holistic = mp.solutions.holistic
mp_drawing = mp.solutions.drawing_utils

# --- Fungsi Helper (Tidak ada perubahan) ---
def extract_keypoints(results):
    pose = np.array([[res.x, res.y] for res in results.pose_landmarks.landmark]).flatten() if results.pose_landmarks else np.zeros(33*2)
    mouth = np.array([pose[i*2:i*2+2] for i in [9, 0, 13, 14]]).flatten()
    shoulders = np.array([pose[i*2:i*2+2] for i in [11, 12]]).flatten()
    lh = np.array([[res.x, res.y, res.z] for res in results.left_hand_landmarks.landmark]).flatten() if results.left_hand_landmarks else np.zeros(21*3)
    rh = np.array([[res.x, res.y, res.z] for res in results.right_hand_landmarks.landmark]).flatten() if results.right_hand_landmarks else np.zeros(21*3)
    return np.concatenate([mouth, shoulders, lh, rh])

# --- PENGATURAN AWAL ---
DATA_PATH = os.path.join(os.getcwd(), '../Dataset_BISINDO_Pose')
no_sequences = 30
sequence_length = 20
os.makedirs(DATA_PATH, exist_ok=True)

LEFT_SHOULDER_THRESH  = [0.70, 0.85, 0.75, 0.90]
RIGHT_SHOULDER_THRESH = [0.20, 0.40, 0.75, 0.90]

def is_shoulders_in_place(results):
    if not results.pose_landmarks: return False
    lm = results.pose_landmarks.landmark
    ls = lm[mp_holistic.PoseLandmark.LEFT_SHOULDER.value]
    rs = lm[mp_holistic.PoseLandmark.RIGHT_SHOULDER.value]
    ls_ok = LEFT_SHOULDER_THRESH[0] < ls.x < LEFT_SHOULDER_THRESH[1] and LEFT_SHOULDER_THRESH[2] < ls.y < LEFT_SHOULDER_THRESH[3]
    rs_ok = RIGHT_SHOULDER_THRESH[0] < rs.x < RIGHT_SHOULDER_THRESH[1] and RIGHT_SHOULDER_THRESH[2] < rs.y < RIGHT_SHOULDER_THRESH[3]
    return ls_ok and rs_ok

# --- Inisialisasi Kamera dan MediaPipe (Hanya sekali di awal) ---
cap = cv2.VideoCapture(0)
with mp_holistic.Holistic(min_detection_confidence=0.5, min_tracking_confidence=0.5) as holistic:
    
    # --- [PERUBAHAN] Loop utama program ---
    while True:
        # --- Input kata dipindahkan ke dalam loop utama ---
        input_actions = input("\n🎤 Masukkan nama gerakan (pisahkan dengan spasi): ").lower()
        if not input_actions: # Jika pengguna hanya menekan Enter, keluar.
            print("Tidak ada input. Program berhenti.")
            break
            
        actions = np.array(input_actions.split())
        print("="*50); print(f"✅ Siap merekam {len(actions)} kata berikut: {actions}"); print("="*50)

        for action in actions:
            action_path = os.path.join(DATA_PATH, action)
            os.makedirs(action_path, exist_ok=True)
            
            for sequence in range(no_sequences):
                # Countdown "Bersiap"
                print(f"INFO: Mempersiapkan rekaman '{action}' video ke-{sequence+1}/{no_sequences}...")
                start_time = time.time()
                while time.time() - start_time < 2.0:
                    ret, frame = cap.read(); frame = cv2.flip(frame, 1)
                    cv2.putText(frame, "Bersiap...", (180, 200), cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 255, 0), 3, cv2.LINE_AA)
                    cv2.imshow('Kamera Pengumpul Data', frame)
                    if cv2.waitKey(10) & 0xFF == ord('q'): exit()
                
                sequence_path = os.path.join(action_path, str(sequence))
                os.makedirs(sequence_path, exist_ok=True)
                
                state = 'WAITING_SHOULDERS'
                frame_idx = 0
                
                # Loop untuk satu video
                while True:
                    ret, frame = cap.read(); frame = cv2.flip(frame, 1)
                    image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB); results = holistic.process(image); image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)

                    if results.pose_landmarks: mp_drawing.draw_landmarks(image, results.pose_landmarks, mp_holistic.POSE_CONNECTIONS)
                    if results.left_hand_landmarks: mp_drawing.draw_landmarks(image, results.left_hand_landmarks, mp_holistic.HAND_CONNECTIONS)
                    if results.right_hand_landmarks: mp_drawing.draw_landmarks(image, results.right_hand_landmarks, mp_holistic.HAND_CONNECTIONS)
                    
                    if state == 'WAITING_SHOULDERS':
                        cv2.putText(image, "Posisikan Bahu Anda", (40, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2, cv2.LINE_AA)
                        if is_shoulders_in_place(results):
                            state = 'WAITING_HANDS'
                    
                    elif state == 'WAITING_HANDS':
                        cv2.putText(image, "BAHU OK. Tunjukkan Tangan untuk Merekam", (40, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2, cv2.LINE_AA)
                        if not is_shoulders_in_place(results):
                            state = 'WAITING_SHOULDERS'
                        elif results.left_hand_landmarks or results.right_hand_landmarks:
                            print("[INFO] Tangan terdeteksi. Mulai Merekam.")
                            state = 'RECORDING'
                            frame_idx = 0
                    
                    elif state == 'RECORDING':
                        rec_text = f"🔴 MEREKAM | Video: {sequence+1} | Frame: {frame_idx+1}"
                        cv2.putText(image, rec_text, (15, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2, cv2.LINE_AA)
                        
                        failure_reason = ""
                        if not (results.left_hand_landmarks or results.right_hand_landmarks):
                            failure_reason = "Tangan hilang!"
                        elif not is_shoulders_in_place(results):
                            failure_reason = "Bahu melenceng!"
                        if failure_reason:
                            print(f"❌ {failure_reason} Mengulangi rekaman untuk video ke-{sequence+1}.")
                            shutil.rmtree(sequence_path); os.makedirs(sequence_path, exist_ok=True)
                            state = 'WAITING_SHOULDERS'
                            continue
                        
                        keypoints = extract_keypoints(results)
                        npy_path = os.path.join(sequence_path, str(frame_idx))
                        np.save(npy_path, keypoints)
                        frame_idx += 1
                        
                        if frame_idx >= sequence_length:
                            print(f"✅ Video ke-{sequence+1} untuk '{action}' selesai direkam.")
                            break

                    cv2.imshow('Kamera Pengumpul Data', image)
                    if cv2.waitKey(10) & 0xFF == ord('q'):
                        cap.release(); cv2.destroyAllWindows(); exit()

        # --- [PERUBAHAN] Opsi untuk melanjutkan setelah semua kata selesai ---
        print("\n🎉 Pengumpulan data untuk batch ini selesai!")
        lanjut = input("Apakah Anda ingin merekam kata-kata lain? (y/n): ").lower()
        if lanjut != 'y':
            break

# --- Program Berakhir ---
print("\n👋 Program Selesai.")
cap.release()
cv2.destroyAllWindows()