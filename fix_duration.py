import os

filepath = r"c:\Users\HP\Downloads\evidence-protector\backend\integrity_check.py"
with open(filepath, "rb") as f:
    content = f.read()

# Try to replace the hex sequence for 'D⚡tion' with 'Duration'
# ⚡ is U+26A1, which is b'\xe2\x9a\xa1' in UTF-8
target = b"D" + b"\xe2\x9a\xa1" + b"tion"
replacement = b"Duration"

if target in content:
    new_content = content.replace(target, replacement)
    with open(filepath, "wb") as f:
        f.write(new_content)
    print(f"Fixed {content.count(target)} occurrences.")
else:
    print("Target not found. Let's try to search for any 'tion' variant.")
    # Maybe it's not a lightning bolt but another character
    for i in range(len(content)-4):
        if content[i:i+4] == b"tion":
            # look back a bit
            print(f"Found 'tion' at index {i}. Preceding 5 bytes: {content[max(0, i-5):i]}")
