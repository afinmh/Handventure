# File: train_pose.py
import os
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.utils import to_categorical
from sklearn.model_selection import train_test_split
from tensorflow.keras.callbacks import TensorBoard, EarlyStopping
from tensorflow.keras.optimizers import Adam

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
print("✅ Pustaka berhasil dimuat.")

# --- 1. PERSIAPAN DATA ---
# --- [PERUBAHAN] Menggunakan path ke dataset baru Anda ---
DATA_PATH = os.path.join(os.getcwd(), 'Dataset_BISINDO_Pose')

actions = [folder for folder in os.listdir(DATA_PATH) if os.path.isdir(os.path.join(DATA_PATH, folder))]
actions = np.array(actions)
print(f"👉 Ditemukan {len(actions)} kelas gerakan: {actions}")

label_map = {label: num for num, label in enumerate(actions)}

sequences, labels = [], []
for action in actions:
    path = os.path.join(DATA_PATH, action)
    no_sequences = len(os.listdir(path))
    for sequence in range(no_sequences):
        window = []
        for frame_num in range(20):
            # --- [PERUBAHAN] Memuat data langsung tanpa normalisasi ---
            res = np.load(os.path.join(path, str(sequence), f"{frame_num}.npy"))
            window.append(res)
        sequences.append(window)
        labels.append(label_map[action])

print(f"📊 Total video (sekuens) yang dimuat: {len(sequences)}")

X = np.array(sequences)
y = to_categorical(labels).astype(int)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

print(f"📦 Ukuran data latih (X_train): {X_train.shape}")
print(f"📦 Ukuran data uji (X_test): {X_test.shape}")

# --- 2. MEMBANGUN MODEL LSTM ---
model = Sequential([
    # --- [PERUBAHAN] input_shape disesuaikan menjadi 138 (mulut+bahu+tangan) ---
    LSTM(128, return_sequences=True, activation='relu', input_shape=(20, 138)),
    Dropout(0.2),
    LSTM(64, return_sequences=False, activation='relu'),
    Dropout(0.2),
    Dense(64, activation='relu'),
    Dropout(0.2),
    Dense(32, activation='relu'),
    Dense(actions.shape[0], activation='softmax')
])

optimizer = Adam(learning_rate=0.0005)
model.compile(optimizer=optimizer, loss='categorical_crossentropy', metrics=['categorical_accuracy'])
print("\n🧠 Arsitektur Model (Versi Pose):")
model.summary()

# --- 3. MELATIH MODEL ---
es_callback = EarlyStopping(monitor='val_loss', patience=30, restore_best_weights=True)
tb_callback = TensorBoard(log_dir='Logs_Pose')

print("\n🚀 Memulai proses pelatihan model (data pose)...")
history = model.fit(
    X_train, y_train,
    epochs=500,
    validation_data=(X_test, y_test),
    callbacks=[tb_callback, es_callback]
)

# --- 4. EVALUASI & SIMPAN MODEL ---
print("\n📈 Mengevaluasi model dengan data uji...")
loss, accuracy = model.evaluate(X_test, y_test)
print(f"Akurasi pada data uji: {accuracy * 100:.2f}%")
print(f"Loss pada data uji: {loss:.4f}")

# --- [PERUBAHAN] Simpan model dengan nama baru ---
model.save("bisindo_model_pose.h5")
print("\n✅ Model berhasil disimpan sebagai 'bisindo_model_pose.h5'")