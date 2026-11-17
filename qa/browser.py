import os, subprocess, sys
from pathlib import Path
env=os.environ.copy()
env['XDG_CACHE_HOME']='/tmp/elderholm-cache'
command=sys.argv[1]
args=[Path(sys.argv[2]).read_text()] if len(sys.argv)>2 and command in ('run-code','eval') else sys.argv[2:]
raise SystemExit(subprocess.run(['playwright-cli','--raw','-s=elderholm',command,*args],env=env).returncode)
