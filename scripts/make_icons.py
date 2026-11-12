"""Generate the app icons (pure Python, no dependencies): a white barbell on the plan's indigo."""
import struct, sys, zlib, os

BG = (0x31, 0x2E, 0x81)
FG = (0xFA, 0xFA, 0xF9)
ACCENT = (0xF5, 0x9E, 0x0B)

def rect(x0, y0, x1, y1, r=0.0):
    def inside(x, y):
        if not (x0 <= x <= x1 and y0 <= y <= y1):
            return False
        cx = min(max(x, x0 + r), x1 - r); cy = min(max(y, y0 + r), y1 - r)
        return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
    return inside

# Shapes in unit coordinates (0..1), centred so they sit inside the maskable safe zone.
SHAPES = [
    (rect(0.18, 0.485, 0.82, 0.515, 0.012), FG),          # bar
    (rect(0.25, 0.34, 0.31, 0.66, 0.02), FG),             # big plates
    (rect(0.69, 0.34, 0.75, 0.66, 0.02), FG),
    (rect(0.32, 0.40, 0.355, 0.60, 0.015), FG),           # small plates
    (rect(0.645, 0.40, 0.68, 0.60, 0.015), FG),
    (rect(0.44, 0.70, 0.56, 0.72, 0.01), ACCENT),         # underline
]

def render(size):
    ss = 3  # supersampling
    rows = []
    for py in range(size):
        row = bytearray([0])
        for px in range(size):
            acc = [0, 0, 0]
            for sy in range(ss):
                for sx in range(ss):
                    x = (px + (sx + 0.5) / ss) / size; y = (py + (sy + 0.5) / ss) / size
                    c = BG
                    for test, col in SHAPES:
                        if test(x, y):
                            c = col
                    acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]
            n = ss * ss
            row += bytes([acc[0] // n, acc[1] // n, acc[2] // n])
        rows.append(bytes(row))
    raw = b"".join(rows)
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")

out = sys.argv[1]
for name, size in [("apple-touch-icon.png", 180), ("icon-192.png", 192), ("icon-512.png", 512), ("favicon-32.png", 32)]:
    with open(os.path.join(out, name), "wb") as f:
        f.write(render(size))
print("ok")
