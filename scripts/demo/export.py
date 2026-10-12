"""Create a local 116-second review video with narration, cards and captions.
Requires macOS say and an FFmpeg build with libass/drawtext. No network calls.
Run from the repository root; set FFMPEG to the installed binary's path.
"""
import hashlib, json, os, pathlib, re, shutil, subprocess, textwrap
root = pathlib.Path.cwd()
out = root / 'artifacts/demo-2026-10-12'
docs = root / 'docs/demo-2026-10-12'
ff = os.environ.get('FFMPEG') or shutil.which('ffmpeg')
if not ff:
    raise SystemExit('Set FFMPEG to an installed FFmpeg with libass and drawtext.')
scenes = json.loads((docs / 'scenes.json').read_text())
assert scenes[0]['start'] == 0 and scenes[-1]['end'] == 116
assert all(a['end'] == b['start'] for a,b in zip(scenes,scenes[1:]))
def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True)
def duration(path):
    probe = subprocess.run([ff,'-i',str(path)],capture_output=True,text=True).stderr
    d = re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)',probe)
    if not d: raise ValueError(probe)
    return int(d[1])*3600+int(d[2])*60+float(d[3])
def stamp(t,sep=','):
    ms=round(t*1000)
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}{sep}{ms%1000:03}'
for i,s in enumerate(scenes):
    (out/f'voice-{i}.txt').write_text(s['text'])
    run(['say','-v','Samantha','-r','168','-f',str(out/f'voice-{i}.txt'),'-o',str(out/f'voice-{i}.aiff')])
    raw=duration(out/f'voice-{i}.aiff'); available=s['end']-s['start']-0.6
    tempo=max(1,raw/available)
    assert tempo <= 1.15, f'Rewrite rushed scene: {s["scene"]}'
    run([ff,'-y','-v','error','-i',str(out/f'voice-{i}.aiff'),'-af',f'atempo={tempo},apad','-t',str(s['end']-s['start']),'-ar','48000','-ac','1',str(out/f'voice-{i}.wav')])
    s.update(rawNarrationSeconds=raw,tempoFactor=tempo,narrationSeconds=round(raw/tempo,3))
(out/'voice-concat.txt').write_text('\n'.join(f"file 'voice-{i}.wav'" for i in range(len(scenes)))+'\n')
run([ff,'-y','-v','error','-f','concat','-safe','0','-i',str(out/'voice-concat.txt'),'-af','loudnorm=I=-16:TP=-1.5:LRA=11','-ar','48000',str(out/'narration.wav')])
captions=[]
for s in scenes:
    chunks=[]; words=[]
    for w in s['text'].split():
        if len(' '.join(words+[w]))>82 and words:
            chunks.append(' '.join(words));words=[]
        words.append(w)
    if words: chunks.append(' '.join(words))
    total=sum(map(len,chunks)); elapsed=0
    for chunk in chunks:
        begin=s['start']+elapsed/total*s['narrationSeconds'];elapsed+=len(chunk)
        end=s['start']+elapsed/total*s['narrationSeconds']
        captions.append((begin,end,textwrap.fill(chunk,width=43,break_on_hyphens=False,break_long_words=False)))
(docs/'captions.srt').write_text('\n\n'.join(f'{i+1}\n{stamp(a)} --> {stamp(b)}\n{t}' for i,(a,b,t) in enumerate(captions))+'\n')
(docs/'captions.vtt').write_text('WEBVTT\n\n'+'\n\n'.join(f'{stamp(a,".")} --> {stamp(b,".")}\n{t}' for a,b,t in captions)+'\n')
(docs/'voiceover-script.txt').write_text('Between the Lines — 116-second review cut\nCurrent local build · synthetic match · AI off\n82–108 seconds: architecture and historical Foundry receipt cards\nNarrator: macOS Samantha, local synthetic voice\n\n'+'\n\n'.join(f'{stamp(s["start"])} – {stamp(s["end"])} | {s["scene"]}\n{s["text"]}' for s in scenes)+'\n')
raw=duration(out/'screen-recording.webm'); offset=max(0,raw-116)
# Magnified insets use the SAME recorded frames, without editing application text.
# The questions sit in the right column at x=1142; keep their visible top 620px.
filters=("[0:v]split=2[base][detail];[detail]crop=408:620:1142:0,scale=580:882[zoom];"
 "[base][zoom]overlay=260:0:enable='between(t,39,52)+between(t,56,68)'[app];"
 "[app][2:v]overlay=0:0:enable='between(t,82,94)'[role];"
 "[role][3:v]overlay=0:0:enable='between(t,94,108)',scale=1920:948,pad=1920:1080:0:0:color=0x101c28,"
 "drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:text='SYNTHETIC MATCH  |  AI OFF  |  LOCAL PREVIEW':fontcolor=0xA5E3B6:fontsize=22:x=(w-tw)/2:y=958:enable='lt(t,82)+gte(t,108)',"
 "drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:text='IMPLEMENTATION DIAGRAM  |  OPTIONAL FOUNDRY PATH':fontcolor=0xA5E3B6:fontsize=22:x=(w-tw)/2:y=958:enable='gte(t,82)*lt(t,94)',"
 "drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:text='HISTORICAL FOUNDRY RESULT  |  OCTOBER 11  |  NOT LIVE':fontcolor=0xA5E3B6:fontsize=22:x=(w-tw)/2:y=958:enable='gte(t,94)*lt(t,108)',"
 f"subtitles='{docs}/captions.srt':force_style='FontName=Arial,FontSize=10,PrimaryColour=&H00FFFFFF,Outline=0,Shadow=0,Alignment=2,MarginV=6'[video]")
# Limit the inset to the original video area (790px) before final scale/pad.
filters=filters.replace('scale=580:882','scale=508:772')
run([ff,'-y','-v','warning','-ss',str(offset),'-i',str(out/'screen-recording.webm'),'-i',str(out/'narration.wav'),'-loop','1','-i',str(docs/'assets/foundry-role.png'),'-loop','1','-i',str(docs/'assets/foundry-receipt.png'),'-filter_complex',filters,'-map','[video]','-map','1:a:0','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-r','30','-c:a','aac','-b:a','192k','-t','116','-movflags','+faststart',str(out/'between-the-lines-demo.mp4')])
run([ff,'-y','-v','error','-i',str(out/'between-the-lines-demo.mp4'),'-vf','fps=1/8,scale=480:270,tile=4x4','-frames:v','1',str(out/'review-contact-sheet.jpg')])
decode=run([ff,'-v','error','-i',str(out/'between-the-lines-demo.mp4'),'-f','null','-'])
assert not decode.stderr
receipt={'durationSeconds':duration(out/'between-the-lines-demo.mp4'),'sha256':hashlib.sha256((out/'between-the-lines-demo.mp4').read_bytes()).hexdigest(),'rawDurationSeconds':raw,'trimmedLoadingSeconds':offset,'dimensions':[1920,1080],'framesPerSecond':30,'videoCodec':'H.264','audioCodec':'AAC','decodeErrors':0,'captions':len(captions),'captionTiming':'Proportional within measured local speech segments; not word-aligned transcription','scenes':scenes,'editing':'Loading trim; magnified same-frame question insets 39–52 and 56–68s; separately labeled cards 82–108s; caption/source band','published':False}
assert receipt['durationSeconds'] == 116
(out/'export-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'output':str(out/'between-the-lines-demo.mp4'),'duration':receipt['durationSeconds'],'captions':len(captions),'maximumTempoFactor':max(s['tempoFactor'] for s in scenes)}))
