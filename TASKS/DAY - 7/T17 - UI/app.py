from flask import Flask, render_template, request
import joblib

app = Flask(__name__)

model = joblib.load("model.pkl")
vectorizer = joblib.load("vectorizer.pkl")


@app.route("/")
def home():
    return render_template("mood_check.html")


@app.route("/predict-mood", methods=["POST"])
def predict_mood():
    text = request.form.get("user_text", "")

    vec = vectorizer.transform([text])
    prediction = model.predict(vec)[0]

    return render_template("mood_check.html", mood=prediction)


if __name__ == "__main__":
    app.run(debug=True)