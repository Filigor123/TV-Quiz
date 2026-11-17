"""Original procedural music and cues for TV Quiz. No samples or external libraries.
Run from repository root: python scripts/build_quiz_audio.py
Requires FFmpeg. Produces original prototype assets, NOT voice narration.
"""
import array, math, pathlib, random, subprocess, tempfile, wave
RATE=24000
OUT=pathlib.Path('assets/quiz-media');OUT.mkdir(parents=True,exist_ok=True)
def render(name,duration,events):
 data=[0.0]*int(RATE*duration)
 for at,length,freq,gain,kind in events:
  start=int(at*RATE);count=int(length*RATE)
  for n in range(min(count,len(data)-start)):
   t=n/RATE;env=min(1,t/.008)*min(1,(length-t)/.04)*math.exp(-t*(5 if kind=='pluck' else 1.5))
   value=math.sin(2*math.pi*freq*t)
   if kind=='kick':value=math.sin(2*math.pi*(45*t+30*(1-math.exp(-t*20))/20))*math.exp(-t*22)
   data[start+n]+=gain*value*env
 peak=max(max(map(abs,data)),.001);samples=array.array('h',(int(v/peak*18000) for v in data))
 with tempfile.TemporaryDirectory() as td:
  wav=pathlib.Path(td)/'source.wav'
  with wave.open(str(wav),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(RATE);w.writeframes(samples.tobytes())
  subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-af','loudnorm=I=-22:TP=-3:LRA=7','-map_metadata','-1','-c:a','libmp3lame','-b:a','128k',str(OUT/name)],check=True)
def note(midi):return 440*2**((midi-69)/12)
beat=.625;events=[]
for bar in range(8):
 root=[48,44,51,46][bar%4]
 for b in range(4):
  at=(bar*4+b)*beat;events.append((at,.14,60,.5,'kick'));events.append((at,.4,note(root-12),.20,'pluck'))
 for n,m in enumerate([root,root+7,root+12,root+7]):events.append(((bar*4+n)*beat,.55,note(m),.12,'pluck'))
render('bed-01.mp3',20,events)
render('cue-01.mp3',.25,[(0,.20,900,.4,'pluck')])
render('cue-02.mp3',1,[(0,.25,note(72),.4,'pluck'),(.2,.25,note(76),.4,'pluck'),(.4,.5,note(79),.4,'pluck')])
render('cue-03.mp3',.8,[(0,.3,note(48),.4,'pluck'),(.2,.4,note(43),.4,'pluck')])
render('cue-04.mp3',1.5,[(i*.2,.5,note(m),.35,'pluck') for i,m in enumerate([60,64,67,72])])
render('cue-05.mp3',2.4,[(i*.23,.6,note(m),.35,'pluck') for i,m in enumerate([60,64,67,72,67,72,76])])
print('Generated original 20-second bed and 5 cues')
