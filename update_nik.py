import sys, os, codecs
sys.stdout = codecs.getwriter('utf-8')(sys.stdout.detach())
sys.path.append(os.getcwd() + '/be')
from dotenv import load_dotenv
load_dotenv('be/.env')
from be.services.scan_helpers import get_supabase_admin
sb = get_supabase_admin()
res = sb.table('profiles').select('id, nik, user_email').execute()
rows = res.data or []
for i, r in enumerate(rows):
    if not r.get('nik'):
        dummy_nik = f'320100000000{i:04d}'
        sb.table('profiles').update({'nik': dummy_nik}).eq('id', r['id']).execute()
        print(f'Updated NIK for {r.get("user_email")} to {dummy_nik}')
print('Done updating profiles.')
