# src/load_data.py
import pandas as pd
import os

RAW_DATA_DIR = "data/raw"
PROCESSED_DIR = "data/processed"
OUTPUT_FILE = os.path.join(PROCESSED_DIR, "consumption.csv")

def load_and_merge_data():
    # Charger tous les fichiers CSV dans data/raw/
    files = [os.path.join(RAW_DATA_DIR, f) for f in os.listdir(RAW_DATA_DIR) if f.endswith(".csv")]
    dfs = []
    
    for file in files:
        print(f"📂 Loading {file}...")
        df = pd.read_csv(file)
        dfs.append(df)

    # Concaténer
    data = pd.concat(dfs, ignore_index=True)
    print(f"✅ Combined shape: {data.shape}")

    # Nettoyage simple
    data = data.rename(columns={
        "TxnDate": "date",
        "TxnTime": "time",
        "Consumption": "consumption"
    })

    data["datetime"] = pd.to_datetime(data["date"] + " " + data["time"], dayfirst=True)
    data = data.sort_values("datetime").drop(columns=["date", "time"]).reset_index(drop=True)

    # Sauvegarder le dataset combiné
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    data.to_csv(OUTPUT_FILE, index=False)
    print(f"💾 Processed data saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    load_and_merge_data()
