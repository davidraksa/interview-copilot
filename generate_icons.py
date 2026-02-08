import os
import subprocess

def create_icon(size):
    output_path = f"icons/icon{size}.png"
    # Using specific dimensions to create a simple colored square with text using convert (ImageMagick) if available, or just a simple colored square.
    # Since I don't know if ImageMagick is installed, I'll write a simple python script using PIL if available, or just use a valid minimal PNG hex string.
    
    # Let's try to use valid minimal PNG data.
    # minimal 1x1 pixel PNG
    # But I need 16, 48, 128.
    
    # I will just create a simple colored square using a raw header for a PNG if I can, or better:
    # I'll just create a python script that uses 'cairosvg' or similar AND 'PIL' if they are present.
    # Checking if `pip install Pillow` is an option? 
    # To be safe and dependency-free, I will just copy a known dummy PNG byte sequence for now, 
    # or I can use `sips` on mac to convert.
    
    try:
        # Mac has 'sips' command line tool for image processing!
        # First create the svg
        subprocess.run(["mkdir", "-p", "icons"])
        
        # Convert SVG to PNG using QuickLook (qlmanage) or sips? Sips doesn't support SVG reading directly usually. 
        # But `qlmanage -t -s 128 -o . icon.svg` might work.
        
        # Alternative: Just create a script that writes a BMP or simple headers.
        pass
    except Exception as e:
        print(e)
        
# Actually, I will write a small python script that writes a valid PNG file using purely standard libraries (struct, zlib) to avoid dependencies.

import zlib
import struct

def make_png(width, height):
    # RGB (255, 0, 0) - Red square
    width_byte = struct.pack('!I', width)
    height_byte = struct.pack('!I', height)
    
    # Data: rows of (filter_byte + RGB * width)
    # Filter byte 0 (None)
    line_size = width * 3 + 1
    raw_data = b''
    for _ in range(height):
        raw_data += b'\x00' + b'\xFF\x00\x00' * width
        
    compressed_data = zlib.compress(raw_data)
    
    # Chunks
    # IHDR
    ihdr_content = width_byte + height_byte + b'\x08\x02\x00\x00\x00'
    ihdr_crc = struct.pack('!I', zlib.crc32(b'IHDR' + ihdr_content) & 0xFFFFFFFF)
    ihdr = struct.pack('!I', len(ihdr_content)) + b'IHDR' + ihdr_content + ihdr_crc
    
    # IDAT
    idat_content = compressed_data
    idat_crc = struct.pack('!I', zlib.crc32(b'IDAT' + idat_content) & 0xFFFFFFFF)
    idat = struct.pack('!I', len(idat_content)) + b'IDAT' + idat_content + idat_crc
    
    # IEND
    iend_content = b''
    iend_crc = struct.pack('!I', zlib.crc32(b'IEND' + iend_content) & 0xFFFFFFFF)
    iend = struct.pack('!I', len(iend_content)) + b'IEND' + iend_content + iend_crc
    
    return b'\x89PNG\r\n\x1a\n' + ihdr + idat + iend

if __name__ == "__main__":
    if not os.path.exists("icons"):
        os.makedirs("icons")
        
    for size in [16, 48, 128]:
        data = make_png(size, size)
        with open(f"icons/icon{size}.png", "wb") as f:
            f.write(data)
    print("Icons created.")
