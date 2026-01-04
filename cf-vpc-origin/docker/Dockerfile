FROM python:3.14-slim

# Install the application dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy in the source code
COPY app.py ./
EXPOSE 8080

CMD ["flask", "run", "--host", "0.0.0.0", "--port", "8080"]