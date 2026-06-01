from flask import Flask, render_template, request, url_for
import cv2
import os
import time
from ultralytics import YOLO

app = Flask(__name__)

UPLOAD_FOLDER = "static/uploads"
OUTPUT_FOLDER = "static/output"

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

model = YOLO("models/best.pt")

# risky behavior classes (EDIT based on your model labels)
RISKY_CLASSES = [
    "drowsy",
    "sleep",
    "yawn",
    "phone",
    "no_seatbelt",
    "fatigue"
]


@app.route("/", methods=["GET"])
def index():
    return render_template(
        "index.html",
        risk=None,
        status=None,
        input_video=None,
        video=None
    )


@app.route("/predict", methods=["POST"])
def predict():

    video = request.files["video"]

    ts = str(int(time.time()))

    input_filename = f"{ts}_{video.filename}"
    output_filename = f"out_{ts}.mp4"

    input_path = os.path.join(UPLOAD_FOLDER, input_filename)
    output_path = os.path.join(OUTPUT_FOLDER, output_filename)

    video.save(input_path)

    cap = cv2.VideoCapture(input_path)

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps == 0 or fps is None:
        fps = 25

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    frame_count = 0
    risk_score = 0
    max_risk_per_frame = 20

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1

        results = model(frame, verbose=False)

        frame_risk = 0
        detected_labels = []

        for r in results:
            boxes = r.boxes

            for box in boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                conf = float(box.conf[0])
                cls = int(box.cls[0])

                label = model.names[cls]
                detected_labels.append(label)

                # draw box
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                cv2.putText(
                    frame,
                    f"{label} {conf:.2f}",
                    (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (0, 255, 0),
                    2
                )

                # risk logic (BASED ON CLASS)
                if label.lower() in RISKY_CLASSES:
                    frame_risk += 20

        risk_score += min(frame_risk, max_risk_per_frame)

        # overlay title
        cv2.putText(
            frame,
            "Driver Monitoring AI",
            (50, 50),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (255, 255, 255),
            2
        )

        out.write(frame)

    cap.release()
    out.release()
    cv2.destroyAllWindows()

    # FINAL RISK
    risk = min(100, risk_score)

    if risk >= 60:
        status = "High Risk Detected"
    elif risk >= 30:
        status = "Medium Risk"
    else:
        status = "Normal"

    insight = "YOLO model analyzed driver behavior and detected risk based on driver activity patterns."

    input_url = url_for('static', filename='uploads/' + input_filename)
    output_url = url_for('static', filename='output/' + output_filename)

    print("RISK:", risk)
    print("STATUS:", status)
    print("FILE EXISTS:", os.path.exists(output_path))

    return render_template(
        "index.html",
        input_video=input_url,
        video=output_url,
        risk=risk,
        status=status,
        insight=insight
    )


if __name__ == "__main__":
    app.run(debug=True)