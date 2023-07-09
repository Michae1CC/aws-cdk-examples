import os
import json
from flask import Flask, request

app = Flask(__name__)


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def index(path):
    token_value = os.getenv("WAF_TOKEN", None)
    request_as_json = dict(request.headers)
    request_as_json["X-Env-Token"] = token_value
    request_as_json["X-Match"] = token_value == request_as_json.get(
        "X-Amzn-Waf-Fruit", ""
    )
    print(json.dumps(request_as_json))
    return request_as_json


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=80)
