from pathlib import Path
import subprocess
import base64
import json
import sys
import hashlib
import re
root=Path(__file__).resolve().parent
partial='--preview-art' in sys.argv
web='--web' in sys.argv
cartoon=(root/'cartoon-data.js').exists()
bundle='cartoon-data.js'
packer=root/'assets/cartoon/pack.py'
if '--repack-art' in sys.argv:
    command=[sys.executable,str(packer)]
    if partial:command.append('--allow-partial')
    subprocess.run(command,check=True)
html=(root/'shell.html').read_text()
for token,name in [('/*__ART__*/','sprites.js'),('/*__ENGINE__*/','engine.js'),('/*__UI__*/','ui.js')]:
    js=(root/name).read_text()
    if name=='sprites.js':
        if (root/bundle).exists():js+='\n'+(root/bundle).read_text()
        if (root/'animation.js').exists():js+='\n'+(root/'animation.js').read_text()
        tracks=json.loads((root/'assets/audio/playlist.json').read_text())
        for track in tracks:
            music=root/'assets/audio'/track['fileName']
            track['src']='data:audio/mpeg;base64,'+base64.b64encode(music.read_bytes()).decode('ascii')
        js+='\nwindow.EMBEDDED_PLAYLIST='+json.dumps(tracks,separators=(',',':'))+';\n'
    if '</script' in js.lower():raise ValueError(f'Unexpected script end in {name}')
    html=html.replace(token,js)
if web:
    output=root/'site'
    output.mkdir(parents=True,exist_ok=True)
    extensions={'image/webp':'webp','image/png':'png','image/jpeg':'jpg',
                'image/svg+xml':'svg','audio/mpeg':'mp3'}
    files={}
    def externalize(match):
        mime=match.group(1)
        data=base64.b64decode(match.group(2),validate=True)
        folder='images' if mime.startswith('image/') else 'audio'
        digest=hashlib.sha256(data).hexdigest()[:16]
        name=f'assets/{folder}/{digest}.{extensions[mime]}'
        files[name]=data
        return name
    html=re.sub(r'data:((?:image|audio)/[\w.+-]+);base64,([A-Za-z0-9+/=]+)',externalize,html)
    # Remove resources left by earlier builds, including replaced music.
    for folder in ('images','audio'):
        directory=output/'assets'/folder
        if directory.exists():
            for old in directory.iterdir():
                if old.is_file() and old.relative_to(output).as_posix() not in files:
                    old.unlink()
    for name,data in files.items():
        path=output/name
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_bytes(data)
    (output/'index.html').write_text(html,encoding='utf-8')
    total=len(html.encode())+sum(map(len,files.values()))
    print(f'site/index.html: {len(html.encode()):,} bytes; {len(files)} external assets; {total:,} bytes total')
else:
    (root/'index.html').write_text(html)
    print(f'index.html: {len(html.encode()):,} bytes; fully inline; '+('cartoon animation' if cartoon else 'detailed art'))
