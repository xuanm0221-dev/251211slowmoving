# -*- coding: utf-8 -*-
"""usecols 테스트"""

import pandas as pd

INVENTORY_COLUMNS = [
    "Channel 2", "产品品牌", "产品大分类", "产品中分类",
    "运营基准", "产品季节", "预计库存金额"
]

try:
    df = pd.read_csv(
        r"D:\data\inventory\2025.11.csv", 
        encoding="utf-8-sig", 
        usecols=INVENTORY_COLUMNS, 
        nrows=10
    )
    with open("temp_usecols.txt", "w", encoding="utf-8") as f:
        f.write(f"Success! Columns: {list(df.columns)}\n")
        f.write(f"Rows: {len(df)}\n")
        f.write(str(df.head(3)))
    print("Done! Check temp_usecols.txt")
except Exception as e:
    print("Error:", e)

