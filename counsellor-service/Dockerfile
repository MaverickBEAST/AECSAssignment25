FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

ENV AWS_REGION=us-east-1
ENV AWS_ACCESS_KEY_ID=AKIA3LET552QIFPIULBJ 
ENV AWS_SECRET_ACCESS_KEY=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 
ENV COGNITO_USER_POOL_ID=us-east-1_WhwqzXWPq
ENV COGNITO_USER_POOL_CLIENT_ID=5rujc50rsvmdd624a531qmh8tf
ENV USERS_TABLE_NAME=Users

COPY app.py .
EXPOSE 5001
CMD ["python", "app.py"]
