# Driver Drowsiness Detection

YOLOv8 based driver drowsiness detection system.

## Build Docker Image

docker build -t drowsiness-yolo .

## Run Container

docker run -p 5000:5000 drowsiness-yolo

## API Endpoint

POST /predict

Form Data:
image=<image_file>

Response:

{
  "prediction":"drowsy",
  "confidence":0.95
}