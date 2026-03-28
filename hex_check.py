import os

filepath = r"c:\Users\HP\Downloads\evidence-protector\backend\integrity_check.py"
with open(filepath, "r", encoding="utf-8", errors="replace") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "Duration" in line:
        print(f"Line {i+1}: {line.strip()}")
        # print hex of the word 'Duration' or similar
        start = line.find("D")
        if start != -1:
            fragment = line[start:start+10]
            print(f"  Hex: {fragment.encode('utf-8').hex()}")
