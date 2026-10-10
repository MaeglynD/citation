"""Prepare the supplied Suno WAVs. Usage: python scripts/prepare-suno-audio.py <input-directory>

Requires NumPy, SciPy and ffmpeg for this optional authoring step. The game ships
the encoded assets and needs none of these tools at runtime or during its build.
Originals stay untouched; lossless edits and measurements go to ignored shots/.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
import warnings
import numpy as np
from scipy.io import wavfile

warnings.filterwarnings('ignore', category=wavfile.WavFileWarning)
ROOT = Path(__file__).resolve().parent.parent
INPUT = Path(sys.argv[1])
MASTERS = ROOT / 'shots/audio/edits'
OUTPUT = ROOT / 'public/audio/suno'
for directory in [MASTERS, OUTPUT]:
    directory.mkdir(parents=True, exist_ok=True)

# Music boundaries follow matching beat/harmonic phrases. The tail blends into
# the audio immediately preceding the start, preserving the exact loop length.
# Effect cuts keep a self-contained final phrase and its natural decay.
EDITS = [
    ('attribution-chaos', 'Attribution Chaos.wav', 8.005, 70.965, .492, 0),
    ('quiz-groove', 'Quiz Groove.wav', 20.905, 57.815, .577, 0),
    ('correct', 'One-second Cheerful Correct-answer Sound. Three Rising Marimba And Plucky Syn....wav', 1.472, 2.84, 0, .19),
    ('wrong', 'A 1-second Playful Wrong-answer Sound. Two Descending Rounded Synth Boops, Wi....wav', 5.416, 6.76, 0, .18),
    ('complete', '3 Second Game-completion Flourish In C Major. Bouncy Marimba, Warm Plucky Syn....wav', 4.365, 7.50, 0, .24),
]

report = []
for key, filename, start, end, overlap, release in EDITS:
    source = INPUT / filename
    rate, pcm = wavfile.read(source)
    if pcm.dtype != np.int16 or pcm.ndim != 2 or pcm.shape[1] != 2:
        raise ValueError(f'{filename}: expected stereo 16-bit PCM')
    x = pcm.astype(np.float64) / 32768
    a, b = round(start * rate), round(end * rate)
    y = x[a:b].copy()
    if overlap:
        n = round(overlap * rate)
        blend = np.linspace(0, 1, n)[:, None]
        # Complementary smooth fades avoid a gain bump on correlated material.
        blend = .5 - .5 * np.cos(np.pi * blend)
        y[-n:] = y[-n:] * (1 - blend) + x[a-n:a] * blend
    else:
        attack = round(.004 * rate)
        y[:attack] *= np.linspace(0, 1, attack)[:, None]
        n = round(release * rate)
        y[-n:] *= np.linspace(1, 0, n)[:, None] ** 1.5
    rms = np.sqrt(np.mean(y*y))
    gain = min(10**(-19/20) / max(rms, 1e-9), 10**(-3/20) / max(np.max(np.abs(y)), 1e-9))
    y *= gain
    master = MASTERS / (key + '.wav')
    wavfile.write(master, rate, np.round(np.clip(y, -1, 1)*32767).astype(np.int16))
    for suffix, codec in [('ogg', ['-c:a','libvorbis','-q:a','5']), ('mp3', ['-c:a','libmp3lame','-q:a','3'])]:
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(master),'-map_metadata','-1',*codec,str(OUTPUT/(key+'.'+suffix))], check=True)
    item = {'id':key, 'source':filename, 'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'sourceDuration':len(x)/rate, 'start':start, 'end':end, 'duration':len(y)/rate,
        'loopBlendSeconds':overlap, 'peakDb':round(float(20*np.log10(np.max(np.abs(y)))),2),
        'rmsDb':round(float(20*np.log10(np.sqrt(np.mean(y*y)))),2)}
    if overlap:
        item['seamStep'] = round(float(np.max(np.abs(y[-1]-y[0]))),6)
        seam = np.concatenate([y[-rate*2:],y[:rate*2]])
        wavfile.write(MASTERS/(key+'-seam.wav'),rate,np.round(seam*32767).astype(np.int16))
    report.append(item)

(ROOT/'public/audio/credits.json').write_text(json.dumps({
    'origin':'User-provided Suno recordings',
    'editing':'Phrase excerpts, short fades, matched music-loop transitions, balanced levels; no time compression.',
    'tracks':report
},indent=2)+'\n',encoding='utf-8')
(MASTERS/'report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,indent=2))

# A short review reel, kept out of the game download: correct, wrong, complete.
review=[]
for key in ['correct','wrong','complete']:
    rate, cue=wavfile.read(MASTERS/(key+'.wav'))
    review.extend([cue,np.zeros((round(rate*.6),2),dtype=np.int16)])
wavfile.write(MASTERS/'cue-preview.wav',rate,np.concatenate(review))
subprocess.run(['ffmpeg','-v','error','-y','-i',str(MASTERS/'cue-preview.wav'),'-c:a','libmp3lame','-q:a','3',str(MASTERS/'cue-preview.mp3')],check=True)
