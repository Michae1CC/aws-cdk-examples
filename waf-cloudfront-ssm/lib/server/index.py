from flask import Flask, request

app = Flask(__name__)


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def index(path):
    request_as_json = dict(request.headers)
    return request_as_json


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=80)
