# /// script
# requires-python = ">=3.10"
# dependencies = ["deface==1.5.0", "onnx==1.23.1", "onnxruntime==1.30.0"]
# ///
"""Writes reference detections from deface itself, used to check the browser port.

Usage: uv run scripts/golden.py
"""

import json
from pathlib import Path

import cv2
from deface.centerface import CenterFace

fixtures = Path(__file__).parent.parent / "tests/fixtures"
centerface = CenterFace(backend="onnxrt", override_execution_provider="CPUExecutionProvider")

for image in sorted(fixtures.glob("*.jpg")):
    frame = cv2.cvtColor(cv2.imread(str(image)), cv2.COLOR_BGR2RGB)
    dets, _ = centerface(frame, threshold=0.2)
    out = image.with_suffix(".golden.json")
    rows = [json.dumps([round(float(v), 3) for v in d]) for d in dets]
    out.write_text("[\n" + ",\n".join(rows) + "\n]\n")
    print(f"{out.name}: {len(dets)} faces")
