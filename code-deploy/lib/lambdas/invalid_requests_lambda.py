import subprocess
import sys


def handler(event, context):
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "invalid_requests_test.py",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    print(result.stdout)
    print(result.stderr, file=sys.stderr)
    return {"statusCode": 500 if result.returncode else 200, "body": result.stdout}
