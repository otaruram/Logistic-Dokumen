import os
import re

directory = 'fe/src'

fixes = [
    # Radix UI
    ('Lihatport', 'Viewport'),
    ('Aksi', 'Action'),
    # Lucide React
    ('Beranda', 'Home'),
]

for root, dirs, files in os.walk(directory):
    for file in files:
        if file.endswith(('.tsx', '.ts')):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            original_content = content
            for wrong, right in fixes:
                # Replace in imports
                content = re.sub(r'(\{\s*.*?\b)' + wrong + r'(\b.*?\})', r'\g<1>' + right + r'\g<2>', content)
                
                # Replace JSX tags and Radix primitives (e.g. ToastPrimitives.Aksi)
                content = re.sub(r'\.' + wrong + r'\b', r'.' + right, content)
                content = re.sub(r'<' + wrong + r'(\s|>)', r'<' + right + r'\g<1>', content)
                content = re.sub(r'</' + wrong + r'>', r'</' + right + '>', content)
                
                # Replace type declarations or props that might have been matched
                content = re.sub(r'\b' + wrong + r'\b', right, content)
                
            if content != original_content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f'Fixed {path}')
