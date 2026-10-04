# /// script
# requires-python = ">=3.10"
# dependencies = ["imageio-ffmpeg==0.6.0"]
# ///
"""Builds tests/fixtures/city.mp4: a 2 s pan across city.jpg, with audio and identifying metadata to strip.

Frame at time t is city.jpg cropped at x = 40 * t, y = 56, so faces have known positions.

Usage: uv run scripts/make-video-fixture.py
"""

import subprocess
from pathlib import Path

import imageio_ffmpeg

fixtures = Path(__file__).parent.parent / "tests/fixtures"
subprocess.run(
    [
        imageio_ffmpeg.get_ffmpeg_exe(),
        "-y",
        "-loop", "1", "-framerate", "15", "-i", str(fixtures / "city.jpg"),
        "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000",
        "-t", "2",
        "-vf", "crop=640:452:'40*t':56",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-g", "15",
        "-c:a", "aac",
        "-metadata", "title=Secret title",
        "-metadata", "location=+48.8566+002.3522/",
        "-metadata", "creation_time=2024-05-01T12:00:00Z",
        "-movflags", "+use_metadata_tags",
        str(fixtures / "city.mp4"),
    ],
    check=True,
)
