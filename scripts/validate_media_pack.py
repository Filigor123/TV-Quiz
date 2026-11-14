"""Validate real media files, hashes, question options and clip durations.
Run: python scripts/validate_media_pack.py
This does not verify recognition, facts, licensing or browser playback.
"""
import hashlib,json,pathlib,subprocess,xml.etree.ElementTree as ET
from collections import Counter
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1]
j=json.loads((ROOT/'content/media-pack/manifest.json').read_text());ids=set();errors=[];checked=set()
def check_file(src,sha,kind):
 p=ROOT/src
 if not p.resolve().is_relative_to((ROOT/'assets/quiz-media').resolve()):raise ValueError('path outside assets directory')
 if not p.is_file():raise ValueError('missing '+src)
 if hashlib.sha256(p.read_bytes()).hexdigest()!=sha:raise ValueError('hash mismatch '+src)
 if p.suffix=='.svg':ET.parse(p)
 elif kind=='image':
  with Image.open(p) as im:im.verify()
 else:
  info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(p)]))
  d=float(info['format']['duration'])
  if not 0<d<45:raise ValueError('unexpected clip duration '+src)
  if kind=='video' and not any(x['codec_name']=='h264' for x in info['streams']):raise ValueError('video should be H.264')
  subprocess.run(['ffmpeg','-v','error','-i',str(p),'-f','null','-'],check=True,capture_output=True)
 checked.add(src)
for r in j['items']:
 try:
  if r['id'] in ids:raise ValueError('duplicate ID')
  ids.add(r['id'])
  if len(r['options'])!=4 or len(set(r['options']))!=4:raise ValueError('need 4 unique options')
  if r['answer'] not in r['options'] or not r['acceptedAnswers']:raise ValueError('missing answer')
  if r.get('media'):
   check_file(r['media']['src'],r['sha256'],r['type'])
   if r['status']!='file_prepared':raise ValueError('file status inconsistent')
   if r.get('bytes')!=(ROOT/r['media']['src']).stat().st_size:raise ValueError('size mismatch')
  elif r['status']=='file_prepared':raise ValueError('prepared item has no media')
 except Exception as e:errors.append(r['id']+': '+str(e))
for r in j.get('accompaniment',[]):
 try:check_file(r['src'],r['sha256'],'audio')
 except Exception as e:errors.append(r['role']+': '+str(e))
unused={str(p.relative_to(ROOT)) for p in (ROOT/'assets/quiz-media').iterdir() if p.is_file()}-checked
if unused:errors.append('Uncatalogued files: '+str(sorted(unused)))
print('Questions:',len(ids));print('Statuses:',dict(Counter(r['status'] for r in j['items'])));print('Prepared by category:',dict(Counter(r['category'] for r in j['items'] if r.get('media'))));print('Validated media:',len(checked))
if errors:print('\n'.join(errors));raise SystemExit(1)
print('PASS: options, unique IDs, paths, hashes, sizes, image decoding, full audio/video decoding and bounded durations')
