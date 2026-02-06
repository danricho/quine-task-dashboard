import os
import sys
from rjsmin import jsmin
from rcssmin import cssmin
import shutil

def minify_file(file_path):
    ext = os.path.splitext(file_path)[1]
    with open(file_path, 'r', encoding='utf-8') as f:
        original = f.read()

    # Dont re-minify
    if ".min." in file_path:
      return False

    if ext == '.js':
        minified = jsmin(original)
    elif ext == '.css':
        minified = cssmin(original)
    else:
        return False  # Unsupported file type

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(minified)
    return True

def minify_directory(root_dir):
    minified_files = []
    for dirpath, _, filenames in os.walk(root_dir):
        for filename in filenames:
            if filename.endswith(('.js', '.css')):
                full_path = os.path.join(dirpath, filename)
                if minify_file(full_path):
                    minified_files.append(full_path)
                    print(f"Minified: {full_path}")
    return minified_files

if os.path.isdir('min/'):
  shutil.rmtree('min/')

shutil.copytree("dev/", "min/")

if not os.path.isdir('min/'):
    print(f"Error: 'min/' is not a valid directory.")
    sys.exit(1)

minify_directory('min/')
print("Minification complete.")
