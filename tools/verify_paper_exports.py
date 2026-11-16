#!/usr/bin/env python3
"""Decode actual H.264 frames and compare with the same-time Canvas preview."""
import json
import pathlib
import re
import subprocess

root = pathlib.Path(__file__).resolve().parent.parent
out = root / "质检" / "paper"
ids = ["text-match-cut", "paper-cutout", "paper-unfold", "magazine-letters"]
report = []
for name in ids:
    video = out / (name + ".mp4")
    probe = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate,nb_frames,duration", "-of", "json", str(video)]))["streams"][0]
    assert (probe["width"], probe["height"], probe["r_frame_rate"], int(probe["nb_frames"])) == (1920, 1080, "60/1", 360), probe
    assert abs(float(probe["duration"]) - 6) < .02, probe
    decoded = out / (name + "-decoded.png")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", "2.5", "-i", str(video), "-frames:v", "1", str(decoded)], check=True)
    result = subprocess.run(["ffmpeg", "-v", "info", "-i", str(decoded), "-i", str(out / (name + "-expected.png")), "-lavfi", "ssim", "-f", "null", "-"], capture_output=True, text=True, check=True)
    ssim = float(re.findall(r"All:([\d.]+)", result.stderr)[-1])
    assert ssim > .99, (name, ssim)
    report.append({"id": name, **probe, "sampleTime": 2.5, "ssim": ssim})
    print("PASS decoded MP4 dimensions, fps, frames, duration and preview SSIM", name, ssim)
listing = out / "concat.txt"
listing.write_text("".join("file '" + str(out / (name + ".mp4")) + "'\n" for name in ids))
subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(listing), "-c", "copy", "-movflags", "+faststart", str(out / "纸张与拼贴-四模板验收.mp4")], check=True)
(out / "video-verification.json").write_text(json.dumps(report, indent=2))
