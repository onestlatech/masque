# /// script
# requires-python = ">=3.10"
# dependencies = ["onnx==1.23.1"]
# ///
"""Converts deface's static-shape CenterFace model into public/models/centerface.onnx.

Usage: uv run scripts/prepare-model.py path/to/deface/centerface.onnx
"""

import hashlib
import sys
from pathlib import Path

import onnx
from onnx.tools.update_model_dims import update_inputs_outputs_dims

src = Path(sys.argv[1])
dst = Path(__file__).parent.parent / "public/models/centerface.onnx"

model = onnx.load(src)

# Initializers listed as graph inputs are treated as overridable, which blocks constant folding.
initializers = {i.name for i in model.graph.initializer}
inputs = [i for i in model.graph.input if i.name not in initializers]
del model.graph.input[:]
model.graph.input.extend(inputs)

used = {name for node in model.graph.node for name in node.input}
kept = [i for i in model.graph.initializer if i.name in used]
del model.graph.initializer[:]
model.graph.initializer.extend(kept)

# Same dims as deface's CenterFace.dynamicize_shapes.
model = update_inputs_outputs_dims(
    model,
    {"input.1": ["B", 3, "H", "W"]},
    {
        "537": ["B", 1, "h", "w"],
        "538": ["B", 2, "h", "w"],
        "539": ["B", 2, "h", "w"],
        "540": ["B", 10, "h", "w"],
    },
)
onnx.checker.check_model(model)
onnx.save(model, dst)

digest = hashlib.sha256(dst.read_bytes()).hexdigest()
(dst.parent / "SHA256SUMS").write_text(f"{digest}  {dst.name}\n")
print(f"{dst} {dst.stat().st_size} bytes sha256:{digest}")
