import os
import shutil
import sys

def install_and_import(package):
    import importlib
    try:
        importlib.import_module(package)
    except ImportError:
        import subprocess
        print(f"Installing {package}...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", package])
    finally:
        globals()[package] = importlib.import_module(package)

# Ensure Pillow is installed
install_and_import("PIL")
from PIL import Image

def compress_images():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    originals_dir = os.path.join(current_dir, "originals")
    
    if not os.path.exists(originals_dir):
        os.makedirs(originals_dir)
        print(f"Created backup directory: {originals_dir}")
        
    files = [f for f in os.listdir(current_dir) if f.lower().endswith('.png')]
    
    print(f"Found {len(files)} PNG images to compress.")
    total_original_size = 0
    total_compressed_size = 0
    
    for filename in files:
        file_path = os.path.join(current_dir, filename)
        backup_path = os.path.join(originals_dir, filename)
        
        orig_size = os.path.getsize(file_path)
        total_original_size += orig_size
        
        # 1. Back up original if not already backed up
        if not os.path.exists(backup_path):
            shutil.copy2(file_path, backup_path)
            print(f"Backed up: {filename}")
            
        try:
            # 2. Open image from backup to avoid re-compressing already compressed files
            with Image.open(backup_path) as img:
                # Get original dimensions
                width, height = img.size
                
                # Resize if larger than 800px on either side
                max_size = 800
                if width > max_size or height > max_size:
                    if width > height:
                        new_width = max_size
                        new_height = int((height / width) * max_size)
                    else:
                        new_height = max_size
                        new_width = int((width / height) * max_size)
                    img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                    print(f"Resized {filename} from {width}x{height} to {new_width}x{new_height}")
                
                # Save optimized image back to original location
                if img.mode == 'RGBA':
                    # Quantize to 256 colors for extreme PNG compression while preserving transparency
                    img = img.quantize(colors=256).convert('RGBA')
                    img.save(file_path, "PNG", optimize=True)
                else:
                    # Convert to RGB and save as highly compressed JPEG-like PNG, or optimize PNG
                    img = img.convert('RGB')
                    # Save as PNG with optimization
                    img.save(file_path, "PNG", optimize=True)
                    
            comp_size = os.path.getsize(file_path)
            total_compressed_size += comp_size
            reduction = (orig_size - comp_size) / orig_size * 100
            print(f"Compressed {filename}: {orig_size/1024/1024:.2f}MB -> {comp_size/1024/1024:.2f}MB (-{reduction:.1f}%)")
            
        except Exception as e:
            print(f"Failed to compress {filename}: {e}")
            
    if total_original_size > 0:
        overall_reduction = (total_original_size - total_compressed_size) / total_original_size * 100
        print("\n=== COMPRESSION SUMMARY ===")
        print(f"Total Original Size: {total_original_size/1024/1024:.2f}MB")
        print(f"Total Compressed Size: {total_compressed_size/1024/1024:.2f}MB")
        print(f"Overall Space Saved: {overall_reduction:.1f}%")
        print(f"Originals backed up in {originals_dir}")

if __name__ == "__main__":
    compress_images()
