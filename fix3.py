import os
import re

directory = 'fe/src'

fixes = {
    'Cari': 'Search',
    'Beranda': 'Home',
    'Unggah': 'Upload',
    'Pengaturan': 'Settings',
    'Lihatport': 'Viewport',
    'Aksi': 'Action'
}

for root, dirs, files in os.walk(directory):
    for file in files:
        if file.endswith(('.tsx', '.ts')):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            original_content = content
            for wrong, right in fixes.items():
                # Replace exact word matching only inside import statements or component usages
                # E.g. `  Cari,` or `<Cari` or `ToastPrimitives.Aksi`
                content = re.sub(r'\b' + wrong + r'\b', right, content)
                
            if content != original_content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f'Fixed {path}')
