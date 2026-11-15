#!/usr/bin/env python3
"""Decode actual MP4s, verify dimensions/FPS/duration, compare a frame, and join review reels."""
import json
import pathlib
import re
import subprocess

root = pathlib.Path(__file__).resolve().parent.parent
folder = root / '质检' / 'opus'
run = lambda args: subprocess.run(args, check=True, capture_output=True, text=True)
reports = []
for meta in sorted(folder.glob('*-video.json')):
    stem = meta.name[:-11]
    video = folder / (stem + '.mp4')
    expected = folder / (stem + '-expected.png')
    actual = folder / (stem + '-decoded.png')
    want = json.loads(meta.read_text())
    info = json.loads(run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,avg_frame_rate,nb_frames,duration', '-of', 'json', str(video)]).stdout)['streams'][0]
    assert info['width'] == want['width'] and info['height'] == want['height'], stem
    a, b = map(int, info['avg_frame_rate'].split('/'))
    assert abs(a / b - want['fps']) < .001 and abs(float(info['duration']) - want['duration']) < .05, stem
    assert int(info['nb_frames']) == want['frames'], stem
    run(['ffmpeg', '-v', 'error', '-y', '-ss', str(want['sampleTime']), '-i', str(video), '-frames:v', '1', str(actual)])
    result = run(['ffmpeg', '-hide_banner', '-i', str(actual), '-i', str(expected), '-lavfi', 'ssim', '-f', 'null', '-'])
    score = float(re.search(r'All:([0-9.]+)', result.stderr).group(1))
    assert score > .98, (stem, score)
    reports.append({'clip': video.name, 'width': info['width'], 'height': info['height'], 'fps': a / b, 'duration': float(info['duration']), 'frames': int(info['nb_frames']), 'sampleTime': want['sampleTime'], 'ssim': score})
    print('PASS', video.name, 'SSIM', score)
assert len(reports) == 23, f'Expected all 23 clips; found {len(reports)}'
reels = {'重构调研-全部动效验收.mp4': (1, 23), 'Opus-首批四模板.mp4': (1, 4), 'Opus-十种数据组件.mp4': (5, 14), '重构调研-进阶动效与预设.mp4': (15, 23)}
for name, (lo, hi) in reels.items():
    files = [r['clip'] for r in reports if lo <= int(r['clip'].split('-')[0]) <= hi]
    manifest = folder / (name + '.concat.txt')
    manifest.write_text(''.join("file '" + str(folder / f).replace("'", "'\\''") + "'\n" for f in files))
    run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(manifest), '-c', 'copy', '-movflags', '+faststart', str(folder / name)])
(folder / 'video-verification.json').write_text(json.dumps({'clips': reports, 'minimumSSIM': min(r['ssim'] for r in reports), 'reels': reels}, ensure_ascii=False, indent=2) + '\n')
