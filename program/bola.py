import cv2
import mediapipe as mp
import numpy as np
import math
import time

class ShapeGame:
    # BARU: Konstanta untuk konfigurasi yang lebih mudah
    PINCH_THRESHOLD = 0.05
    DRAG_RADIUS = 50
    SMOOTHING = 0.3
    MAX_VERTICES = 8
    MIN_VERTICES = 3

    def __init__(self):
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(max_num_hands=2, min_detection_confidence=0.7)
        self.vertices = []
        self.current_vertices = 3
        self.drag_info = {'left': {'active': False, 'vertex': -1}, 'right': {'active': False, 'vertex': -1}}
        self.last_click = 0
        self.shape_names = {3: "Segitiga", 4: "Segiempat", 5: "Pentagon", 6: "Hexagon", 7: "Heptagon", 8: "Octagon"}

    def _get_finger_pos(self, landmark, frame_shape):
        return int(landmark.x * frame_shape[1]), int(landmark.y * frame_shape[0])
    
    # DIUBAH: Menggunakan math.hypot untuk efisiensi
    def _distance(self, p1, p2):
        return math.hypot(p1[0] - p2[0], p1[1] - p2[1])

    def _is_pinch(self, landmarks):
        thumb_tip, index_tip = landmarks[self.mp_hands.HandLandmark.THUMB_TIP], landmarks[self.mp_hands.HandLandmark.INDEX_FINGER_TIP]
        return math.hypot(thumb_tip.x - index_tip.x, thumb_tip.y - index_tip.y) < self.PINCH_THRESHOLD
        
    def _calculate_angle(self, p1, p2, p3):
        a, b, c = self._distance(p2, p3), self._distance(p1, p2), self._distance(p1, p3)
        if a * b == 0: return 0
        cosine_angle = max(-1, min(1, (a**2 + b**2 - c**2) / (2 * a * b)))
        return math.degrees(math.acos(cosine_angle))

    def setup_shape(self, w, h):
        center_x, center_y, radius = w // 2, h // 2, min(w, h) // 4
        self.vertices = [
            [float(round(center_x + radius * math.cos(angle))), float(round(center_y + radius * math.sin(angle)))]
            for i, angle in enumerate((2 * math.pi * i / self.current_vertices) - math.pi/2 for i in range(self.current_vertices))
        ]

    def classify_shape(self):
            if not (3 <= self.current_vertices <= 4): return ""
            
            sides = [self._distance(self.vertices[i], self.vertices[(i + 1) % self.current_vertices]) for i in range(self.current_vertices)]
            angles = [self._calculate_angle(self.vertices[i - 1], self.vertices[i], self.vertices[(i + 1) % self.current_vertices]) for i in range(self.current_vertices)]
            
            def is_close(a, b, rel_tol=0.15): return math.isclose(a, b, rel_tol=rel_tol)
            def is_angle_close(a, b, abs_tol=8): return math.isclose(a, b, abs_tol=abs_tol)
            
            # --- DIUBAH: Logika Klasifikasi Segitiga yang Baru ---
            if self.current_vertices == 3:
                a1, a2, a3 = angles
                
                # Cek properti utama berdasarkan sudut
                is_equilateral = is_angle_close(a1, a2) and is_angle_close(a2, a3)
                is_isosceles = is_angle_close(a1, a2) or is_angle_close(a2, a3) or is_angle_close(a1, a3)
                is_right = any(is_angle_close(a, 90, abs_tol=5) for a in angles)
                is_obtuse = any(a > 95 for a in angles) # Toleransi agar tidak flickering

                # Terapkan aturan berdasarkan prioritas
                if is_equilateral:
                    return "Sama Sisi"
                
                # Gabungkan jenis sudut (Siku-siku/Tumpul) dengan jenis sisi (Sama Kaki)
                if is_isosceles:
                    if is_right: return "Siku-siku Sama Kaki"
                    if is_obtuse: return "Tumpul Sama Kaki"
                    return "Sama Kaki (Lancip)" # Sama kaki biasa pasti lancip
                else: # Berarti segitiga sembarang (scalene)
                    if is_right: return "Siku-siku Sembarang"
                    if is_obtuse: return "Tumpul Sembarang"
                    return "Lancip Sembarang"

            # --- Logika Segiempat (Tidak Berubah) ---
            if self.current_vertices == 4:
                s1, s2, s3, s4 = sides
                a1, a2, a3, a4 = angles
                all_angles_90 = all(is_angle_close(a, 90) for a in angles)
                all_sides_equal = all(is_close(s, sides[0]) for s in sides)
                opposite_sides_equal = is_close(s1, s3) and is_close(s2, s4)
                adjacent_sides_equal = (is_close(s1, s2) and is_close(s3, s4)) or (is_close(s2, s3) and is_close(s4, s1))
                one_pair_parallel = is_angle_close(a1 + a2, 180) or is_angle_close(a2 + a3, 180)

                if all_angles_90 and all_sides_equal: return "Persegi"
                if all_angles_90 and opposite_sides_equal: return "Persegi Panjang"
                if all_sides_equal: return "Belah Ketupat"
                if opposite_sides_equal: return "Jajar Genjang"
                if adjacent_sides_equal: return "Layang-layang"
                if one_pair_parallel: return "Trapesium"
                return "Sembarang"
                
            return ""

    def _handle_interaction(self, landmarks, handedness, frame_shape):
        hand = handedness.classification[0].label.lower()
        pos = self._get_finger_pos(landmarks[self.mp_hands.HandLandmark.INDEX_FINGER_TIP], frame_shape)
        pinching = self._is_pinch(landmarks)
        w, h = frame_shape[1], frame_shape[0]

        # Handle Dragging
        drag = self.drag_info[hand]
        other_vertex = self.drag_info['right' if hand == 'left' else 'left']['vertex']
        if pinching:
            if not drag['active']:
                for i, v in enumerate(self.vertices):
                    if self._distance(pos, v) < self.DRAG_RADIUS and i != other_vertex:
                        drag.update({'active': True, 'vertex': i})
                        break
            elif drag['vertex'] != -1:
                target, current = np.array(pos), np.array(self.vertices[drag['vertex']])
                self.vertices[drag['vertex']] = (current + (target - current) * self.SMOOTHING).tolist()
        else:
            drag.update({'active': False, 'vertex': -1})

        # Handle Buttons
        if pinching and (time.time() - self.last_click > 0.5) and 20 <= pos[1] <= 70:
            actions = {'+': lambda v: v + 1, '-': lambda v: v - 1, 'R': lambda v: self.current_vertices}
            buttons = [('+', 20, self.current_vertices < self.MAX_VERTICES), 
                       ('-', 80, self.current_vertices > self.MIN_VERTICES), 
                       ('R', 140, True)]
            for label, x, enabled in buttons:
                if enabled and x <= pos[0] <= x + 50:
                    new_vertices = actions[label](self.current_vertices)
                    if new_vertices != self.current_vertices or label == 'R':
                        self.current_vertices = new_vertices
                        self.setup_shape(w, h)
                        self.last_click = time.time()
                    break

    def _draw_scene(self, frame):
        h, w = frame.shape[:2]
        # Draw Shape
        if len(self.vertices) >= 2:
            pts = np.array(self.vertices, np.int32)
            cv2.polylines(frame, [pts], True, (0, 255, 0), 4)
            for i, v_float in enumerate(self.vertices):
                v = tuple(map(int, v_float))
                is_dragging = any(d['vertex'] == i for d in self.drag_info.values())
                cv2.circle(frame, v, 15, (0, 0, 255) if is_dragging else (255, 100, 100), -1)
                cv2.circle(frame, v, 15, (255, 255, 255), 3)
                if self.current_vertices <= 4:
                    angle = self._calculate_angle(self.vertices[i-1], v_float, self.vertices[(i + 1) % self.current_vertices])
                    cv2.putText(frame, f"{int(angle)}", (v[0] + 20, v[1] - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)

        # Draw UI
        buttons = [('+', 20, self.current_vertices >= self.MAX_VERTICES), ('-', 80, self.current_vertices <= self.MIN_VERTICES), ('R', 140, False)]
        for label, x, disabled in buttons:
            color = (80, 80, 80) if disabled else (100, 150, 255)
            cv2.rectangle(frame, (x, 20), (x + 50, 70), color, -1)
            cv2.rectangle(frame, (x, 20), (x + 50, 70), (255, 255, 255), 2)
            cv2.putText(frame, label, (x + 15, 60), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 3)
        
        base_name = self.shape_names.get(self.current_vertices, f"{self.current_vertices}-gon")
        classified_name = self.classify_shape()
        display_name = f"{base_name}: {classified_name}" if classified_name else base_name
        cv2.putText(frame, display_name, (20, h - 30), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)

    def run(self):
        cap = cv2.VideoCapture(0)
        print("Game Bentuk - Diringkas | Tekan 'q' untuk keluar")
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret: break
            
            frame = cv2.flip(frame, 1)
            if not self.vertices: self.setup_shape(*frame.shape[:2][::-1])

            results = self.hands.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            if results.multi_hand_landmarks:
                for landmarks, handedness in zip(results.multi_hand_landmarks, results.multi_handedness):
                    self._handle_interaction(landmarks.landmark, handedness, frame.shape)
                    # Draw finger cursor
                    pos = self._get_finger_pos(landmarks.landmark[self.mp_hands.HandLandmark.INDEX_FINGER_TIP], frame.shape)
                    is_pinching = self._is_pinch(landmarks.landmark)
                    cv2.circle(frame, pos, 12, (0, 255, 0) if is_pinching else (0, 255, 255), -1)
            
            self._draw_scene(frame)
            cv2.imshow('Game Bentuk', frame)
            if cv2.waitKey(1) & 0xFF == ord('q'): break
        
        cap.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    ShapeGame().run()