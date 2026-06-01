from flask import Flask, request, render_template_string, send_from_directory
from ultralytics import YOLO
import os

app = Flask(__name__)

model = YOLO("models/best.pt")

HTML = """
<!DOCTYPE html>
<html>
<head>
    <title>Driver Drowsiness Detection</title>

    <style>

    body{
        margin:0;
        font-family:Arial,sans-serif;
        background:linear-gradient(135deg,#1e3c72,#2a5298);
        min-height:100vh;
        display:flex;
        justify-content:center;
        align-items:center;
    }

    .container{
        background:white;
        width:650px;
        padding:30px;
        border-radius:20px;
        text-align:center;
        box-shadow:0 10px 25px rgba(0,0,0,0.3);
    }

    h1{
        color:#1e3c72;
    }

    input[type=file]{
        margin:20px;
    }

    button{
        background:#1e3c72;
        color:white;
        border:none;
        padding:12px 30px;
        border-radius:8px;
        cursor:pointer;
        font-size:16px;
    }

    button:hover{
        background:#2a5298;
    }

    img{
        width:100%;
        margin-top:20px;
        border-radius:10px;
        border:1px solid #ddd;
    }

    .result{
        margin-top:20px;
        background:#f4f4f4;
        padding:15px;
        border-radius:10px;
    }

    .prediction{
        font-size:24px;
        font-weight:bold;
        color:#1e3c72;
    }

    .confidence{
        font-size:18px;
        color:green;
        margin-top:10px;
    }

    </style>
</head>

<body>

<div class="container">

<h1>🚗 Driver Drowsiness Detection</h1>

<form action="/predict" method="POST" enctype="multipart/form-data">

<input type="file" name="image" required>

<br>

<button type="submit">Predict</button>

</form>

{% if image %}
<h3>Uploaded Image</h3>
<img src="{{ image }}">
{% endif %}

{% if prediction %}
<div class="result">
    <div class="prediction">
        Prediction: {{ prediction }}
    </div>

    <div class="confidence">
        Confidence: {{ confidence }}
    </div>
</div>
{% endif %}

</div>

</body>
</html>
"""

@app.route("/")
def home():
    return render_template_string(HTML)

@app.route("/static/<path:filename>")
def serve_image(filename):
    return send_from_directory("static", filename)

@app.route("/predict", methods=["POST"])
def predict():

    if "image" not in request.files:
        return "No image uploaded"

    file = request.files["image"]

    os.makedirs("static", exist_ok=True)

    filename = file.filename

    image_path = os.path.join("static", filename)

    file.save(image_path)

    results = model.predict(image_path, verbose=False)

    if len(results[0].boxes) == 0:
        return render_template_string(
            HTML,
            image=f"/static/{filename}",
            prediction="No Face Detected",
            confidence="0%"
        )

    cls = int(results[0].boxes.cls[0])
    label = model.names[cls]
    conf = float(results[0].boxes.conf[0])

    return render_template_string(
        HTML,
        image=f"/static/{filename}",
        prediction=label,
        confidence=f"{conf:.2%}"
    )

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)