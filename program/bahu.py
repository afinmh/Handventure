# File: cek_bahu.py
import cv2
import mediapipe as mp
import time
import os

mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils

cap = cv2.VideoCapture(0)

print("="*50)
print("📷 Buka Kamera: Posisikan diri Anda dengan nyaman.")
print("Perhatikan nilai koordinat Bahu Kiri (LK) dan Kanan (RK).")
print("Tekan 's' untuk simpan gambar tanpa skeleton.")
print("Tekan 'q' untuk keluar.")
print("="*50)

# Buat folder simpan
save_dir = "hasil_bahu"
os.makedirs(save_dir, exist_ok=True)

with mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5) as pose:
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        
        frame = cv2.flip(frame, 1)
        h, w, _ = frame.shape

        # Simpan versi asli (tanpa skeleton)
        original_frame = frame.copy()

        image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = pose.process(image)
        image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)

        if results.pose_landmarks:
            mp_drawing.draw_landmarks(image, results.pose_landmarks, mp_pose.POSE_CONNECTIONS)
            
            landmarks = results.pose_landmarks.landmark
            left_shoulder = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value]
            right_shoulder = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value]
            
            cv2.putText(image, f"LK (X:{left_shoulder.x:.2f}, Y:{left_shoulder.y:.2f})", 
                        (int(left_shoulder.x * w) - 100, int(left_shoulder.y * h) - 20), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)
            
            cv2.putText(image, f"RK (X:{right_shoulder.x:.2f}, Y:{right_shoulder.y:.2f})", 
                        (int(right_shoulder.x * w) - 100, int(right_shoulder.y * h) - 20), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)

        cv2.imshow('Cek Posisi Bahu', image)

        key = cv2.waitKey(10) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('s'):
            filename = os.path.join(save_dir, f"bahu_{int(time.time())}.jpg")
            cv2.imwrite(filename, original_frame)
            print(f"✅ Gambar disimpan: {filename}")

cap.release()
cv2.destroyAllWindows()
