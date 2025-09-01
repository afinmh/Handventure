# File: convert_data_pose.py
import os
import numpy as np
import json

# [PERUBAHAN] Path menunjuk ke dataset baru Anda
DATA_PATH = 'Dataset_BISINDO_Pose'
# [PERUBAHAN] Nama file output diubah agar tidak tertukar
OUTPUT_JSON = 'dataset_pose.json' 

print(f"Mulai membaca dataset dari '{DATA_PATH}'...")

# Ambil daftar kelas dari nama folder
actions = [folder for folder in os.listdir(DATA_PATH) if os.path.isdir(os.path.join(DATA_PATH, folder))]

final_dataset = []

# Loop melalui setiap kelas dan setiap video
for action in actions:
    action_path = os.path.join(DATA_PATH, action)
    num_sequences = len(os.listdir(action_path))

    for sequence_idx in range(num_sequences):
        sequence_path = os.path.join(action_path, str(sequence_idx))

        window = []
        for frame_num in range(20): # 20 frame per sekuens
            frame_file = os.path.join(sequence_path, f"{frame_num}.npy")
            # Cek jika file ada, untuk menghindari error
            if os.path.exists(frame_file):
                res = np.load(frame_file)
                window.append(res.tolist())
        
        # Hanya tambahkan jika window berisi 20 frame penuh
        if len(window) == 20:
            final_dataset.append({
                "label": action,
                "sequence": window
            })

    print(f"Selesai memproses kelas: {action}")

# Simpan dataset ke dalam satu file JSON
with open(OUTPUT_JSON, 'w') as f:
    json.dump(final_dataset, f)

print(f"\n✅ Dataset berhasil disimpan ke {OUTPUT_JSON}")