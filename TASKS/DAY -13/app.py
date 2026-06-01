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

# Load YOLO model once (important for speed)
model = YOLO("models/best.pt")


@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")


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
    total_conf = 0
    detect_count = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1

        # -----------------------------
        # YOLO INFERENCE
        # -----------------------------
        results = model(frame, verbose=False)

        for r in results:
            boxes = r.boxes

            for box in boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                conf = float(box.conf[0])
                cls = int(box.cls[0])

                label = model.names[cls]

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

                detect_count += 1
                total_conf += conf

        # overlay status
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

    # -----------------------------
    # RISK CALCULATION (simple logic)
    # -----------------------------
    if detect_count > 0:
        avg_conf = total_conf / detect_count
    else:
        avg_conf = 0

    risk = min(100, int(avg_conf * 100 + 20))

    insight = "YOLO model analyzed driver behavior and detected possible fatigue indicators."

    # -----------------------------
    # FIXED FLASK URLS (IMPORTANT)
    # -----------------------------
    input_url = url_for('static', filename='uploads/' + input_filename)
    output_url = url_for('static', filename='output/' + output_filename)

    print("INPUT:", input_url)
    print("OUTPUT:", output_url)
    print("FILE EXISTS:", os.path.exists(output_path))

    return render_template(
        "index.html",
        input_video=input_url,
        video=output_url,
        risk=risk,
        insight=insight
    )


if __name__ == "__main__":
    app.run(debug=True)