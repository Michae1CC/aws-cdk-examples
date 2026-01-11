from flask import Flask

app = Flask(__name__)


@app.route("/")
def hello_world():
    return "<p>Hello, World!</p>"


@app.route("/healthcheck")
def healthcheck():
    return "ok"


@app.route("/api")
def api_root():
    return {"field": "Value from api route"}
