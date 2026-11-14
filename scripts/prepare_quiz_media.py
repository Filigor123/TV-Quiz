"""Rebuild one acquired asset using recorded source bounds. No DRM or paywall bypass.
Usage: python scripts/prepare_quiz_media.py ITEM_ID [--write]
Without --write only displays the acquisition/cut plan. Requires FFmpeg and Pillow.
Source-only items with no direct URL require acquisition work first.
"""
import argparse,json,pathlib,subprocess,tempfile,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('id');p.add_argument('--write',action='store_true');args=p.parse_args()
j=json.loads((ROOT/'content/media-pack/manifest.json').read_text())
r=next((x for x in j['items'] if x['id']==args.id),None)
if not r:raise SystemExit('Unknown item ID')
if not r.get('downloadUrl'):raise SystemExit('No direct URL; see sourcePage and cutNotes. Do not invent source timestamps.')
if r.get('status')=='rejected_asset':raise SystemExit('Asset rejected: acquire a new source before rebuilding.')
print(json.dumps({k:r.get(k) for k in ['id','sourcePage','downloadUrl','sourceStartSeconds','requestedDurationSeconds','media','cutNotes']},ensure_ascii=False,indent=2))
if not args.write:raise SystemExit(0)
if not r.get('media'):raise SystemExit('Set output media path after acquiring and reviewing the source.')
dest=ROOT/r['media']['src']
if not dest.resolve().is_relative_to((ROOT/'assets/quiz-media').resolve()):raise SystemExit('Invalid output path')
with tempfile.TemporaryDirectory() as temp:
 src=pathlib.Path(temp)/'source';req=urllib.request.Request(r['downloadUrl'],headers={'User-Agent':'TVQuizContentPreparation/1.0'})
 with urllib.request.urlopen(req,timeout=30) as response:data=response.read(25_000_001)
 if len(data)>25_000_000:raise SystemExit('Source exceeds 25 MB; choose a bounded source')
 src.write_bytes(data)
 if r['type']=='image':
  from PIL import Image
  im=Image.open(src).convert('RGB');im.thumbnail((1280,900));im.save(dest,quality=87)
 else:
  cmd=['ffmpeg','-v','error','-y','-ss',str(r.get('sourceStartSeconds',0)),'-i',str(src),'-t',str(r['requestedDurationSeconds']),'-map_metadata','-1']
  if r['type']=='video':cmd+=['-vf','scale=960:-2','-c:v','libx264','-preset','fast','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart','-c:a','aac','-b:a','128k']
  else:cmd+=['-vn','-c:a','libmp3lame','-b:a','128k']
  subprocess.run(cmd+['-af','loudnorm=I=-18:TP=-2:LRA=9',str(dest)],check=True)
print('Rebuilt:',dest.relative_to(ROOT));print('Recompute SHA256/bytes/duration in manifest and validate before committing.')
