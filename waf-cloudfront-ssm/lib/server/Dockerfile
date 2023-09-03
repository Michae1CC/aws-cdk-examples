FROM --platform=linux/amd64 python:3.11-slim
USER root

COPY . .

EXPOSE 80
ENV LANG=C.UTF-8
ENV FLASK_ENV=development
RUN pip install -r requirements.in

CMD ["python3", "index.py"]