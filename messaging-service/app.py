from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import uuid
import datetime
import boto3
import requests
from jose import jwk, jwt
from jose.utils import base64url_decode
from botocore.exceptions import ClientError

app = Flask(__name__)
CORS(app)

# ----------------------------------------------------------------
#  Environment / AWS Config
# ----------------------------------------------------------------
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')
MESSAGES_TABLE_NAME = os.environ.get('MESSAGES_TABLE_NAME', 'Messages')
SESSIONS_TABLE_NAME = os.environ.get('SESSIONS_TABLE_NAME', 'Sessions')

COGNITO_USER_POOL_ID = os.environ.get('COGNITO_USER_POOL_ID')
COGNITO_USER_POOL_CLIENT_ID = os.environ.get('COGNITO_USER_POOL_CLIENT_ID')

JWKS_URL = f"https://cognito-idp.{AWS_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}/.well-known/jwks.json"
JWKS = None

dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
messages_table = dynamodb.Table(MESSAGES_TABLE_NAME)
sessions_table = dynamodb.Table(SESSIONS_TABLE_NAME)

# ----------------------------------------------------------------
#  Load JWKS on startup
# ----------------------------------------------------------------
@app.before_first_request
def load_jwks():
    global JWKS
    try:
        resp = requests.get(JWKS_URL)
        resp.raise_for_status()
        JWKS = resp.json()["keys"]
        print("Messaging-Service: JWKS loaded.")
    except Exception as e:
        print(f"Failed to load JWKS: {e}")

# ----------------------------------------------------------------
#  Helper: verify token
# ----------------------------------------------------------------
def verify_cognito_token(token):
    global JWKS
    if not JWKS:
        load_jwks()

    headers = jwt.get_unverified_header(token)
    kid = headers.get('kid')
    key_index = None
    for i, key in enumerate(JWKS):
        if kid == key['kid']:
            key_index = i
            break
    if key_index is None:
        raise ValueError("Public key not found in JWKS")

    public_key = jwk.construct(JWKS[key_index])
    message, encoded_signature = token.rsplit('.', 1)
    decoded_signature = base64url_decode(encoded_signature.encode('utf-8'))

    if not public_key.verify(message.encode("utf8"), decoded_signature):
        raise ValueError("Signature verification failed")

    claims = jwt.get_unverified_claims(token)
    now = datetime.datetime.utcnow().timestamp()
    if claims['exp'] < now:
        raise ValueError("Token is expired")

    if 'aud' not in claims:
        raise ValueError("Token does not contain an 'aud' claim")

    if claims['aud'] != COGNITO_USER_POOL_CLIENT_ID:
        raise ValueError("Token was not issued for this audience")

    iss = f"https://cognito-idp.{AWS_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}"
    if claims.get('iss') != iss:
        raise ValueError("Token issuer mismatch")

    return claims

def parse_bearer_token(header):
    parts = header.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None

# ----------------------------------------------------------------
#  Health Check
# ----------------------------------------------------------------
@app.route("/health", methods=["GET"])
def health():
    return "Messaging Service is healthy!", 200

# ----------------------------------------------------------------
#  Messages (Protected)
# ----------------------------------------------------------------
@app.route("/messages", methods=["POST"])
def create_message():
    # Validate token
    auth_header = request.headers.get("Authorization", "")
    token = parse_bearer_token(auth_header)
    if not token:
        return jsonify({"error": "Missing or invalid Authorization header"}), 401

    try:
        verify_cognito_token(token)
    except Exception as e:
        return jsonify({"error": f"Token verification failed: {e}"}), 401

    data = request.json
    if not data:
        return jsonify({"error": "No JSON body provided"}), 400

    message_id = str(uuid.uuid4())
    data["message_id"] = message_id
    data["timestamp"] = datetime.datetime.utcnow().isoformat() + "Z"

    try:
        messages_table.put_item(Item=data)
        return jsonify({"message": "Message created!", "data": data}), 201
    except ClientError as e:
        return jsonify({"error": f"Error saving message: {e}"}), 500

@app.route("/messages", methods=["GET"])
def get_messages():
    # Validate token
    auth_header = request.headers.get("Authorization", "")
    token = parse_bearer_token(auth_header)
    if not token:
        return jsonify({"error": "Missing or invalid Authorization header"}), 401

    try:
        verify_cognito_token(token)
    except Exception as e:
        return jsonify({"error": f"Token verification failed: {e}"}), 401

    user_id = request.args.get("userId")
    if not user_id:
        return jsonify({"error": "Missing query param 'userId'"}), 400

    try:
        response = messages_table.scan()
        all_messages = response.get("Items", [])
        user_messages = [msg for msg in all_messages if msg.get("sender_id") == user_id or msg.get("receiver_id") == user_id]
        return jsonify(user_messages), 200
    except Exception as e:
        return jsonify({"error": f"Error fetching messages: {e}"}), 500

# ----------------------------------------------------------------
#  Sessions (Protected)
# ----------------------------------------------------------------
@app.route("/sessions", methods=["POST"])
def book_session():
    # Validate token
    auth_header = request.headers.get("Authorization", "")
    token = parse_bearer_token(auth_header)
    if not token:
        return jsonify({"error": "Missing or invalid Authorization header"}), 401

    try:
        verify_cognito_token(token)
    except Exception as e:
        return jsonify({"error": f"Token verification failed: {e}"}), 401

    data = request.json
    if not data:
        return jsonify({"error": "No JSON body provided"}), 400

    session_id = str(uuid.uuid4())
    data["session_id"] = session_id
    data["created_at"] = datetime.datetime.utcnow().isoformat() + "Z"
    # Expecting date_time and session_time to be provided separately in the JSON body.
    # For example: { "customer_id": "user@example.com", "counsellor_id": "counsellor@example.com", "date_time": "2025-04-30", "session_time": "14:00", "status": "booked" }
    try:
        sessions_table.put_item(Item=data)
        return jsonify({"message": "Session booked!", "data": data}), 201
    except Exception as e:
        return jsonify({"error": f"Error booking session: {e}"}), 500

@app.route("/sessions", methods=["GET"])
def get_sessions():
    # Validate token
    auth_header = request.headers.get("Authorization", "")
    token = parse_bearer_token(auth_header)
    if not token:
        return jsonify({"error": "Missing or invalid Authorization header"}), 401

    try:
        verify_cognito_token(token)
    except Exception as e:
        return jsonify({"error": f"Token verification failed: {e}"}), 401

    customer_id = request.args.get("customerId")
    counsellor_id = request.args.get("counsellorId")
    try:
        response = sessions_table.scan()
        all_sessions = response.get("Items", [])
        filtered = []
        for sess in all_sessions:
            if customer_id and sess.get("customer_id") == customer_id:
                filtered.append(sess)
            elif counsellor_id and sess.get("counsellor_id") == counsellor_id:
                filtered.append(sess)
        if not customer_id and not counsellor_id:
            filtered = all_sessions
        return jsonify(filtered), 200
    except Exception as e:
        return jsonify({"error": f"Error fetching sessions: {e}"}), 500
@app.route("/sessions/<session_id>", methods=["PUT"])
def update_session(session_id):
    """
    Update a session's details:
    Allows updating the date_time, session_time, and/or status.
    For example, to cancel a session, set status to "cancelled".
    To reschedule, provide new values for date_time and session_time.
    """
    # Validate token
    auth_header = request.headers.get("Authorization", "")
    token = parse_bearer_token(auth_header)
    if not token:
        return jsonify({"error": "Missing or invalid Authorization header"}), 401

    try:
        verify_cognito_token(token)
    except Exception as e:
        return jsonify({"error": f"Token verification failed: {e}"}), 401

    data = request.json
    if not data:
        return jsonify({"error": "No JSON body provided"}), 400

    # Build update expression for allowed fields.
    # Allowed fields: date_time, session_time, status
    update_expression = []
    expression_attribute_values = {}
    expression_attribute_names = {}

    if "date_time" in data:
        update_expression.append("date_time = :d")
        expression_attribute_values[":d"] = data["date_time"]
    if "session_time" in data:
        update_expression.append("session_time = :t")
        expression_attribute_values[":t"] = data["session_time"]
    if "status" in data:
        # Use ExpressionAttributeNames to avoid reserved keyword conflict
        update_expression.append("#st = :s")
        expression_attribute_values[":s"] = data["status"]
        expression_attribute_names["#st"] = "status"

    if not update_expression:
        return jsonify({"error": "No valid fields provided for update"}), 400

    update_expr = "set " + ", ".join(update_expression)
    try:
        result = sessions_table.update_item(
            Key={"session_id": session_id},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expression_attribute_values,
            ExpressionAttributeNames=expression_attribute_names if expression_attribute_names else None,
            ReturnValues="ALL_NEW"
        )
        updated_session = result.get("Attributes", {})
        return jsonify({"message": "Session updated", "data": updated_session}), 200
    except Exception as e:
        return jsonify({"error": f"Error updating session: {e}"}), 500


# ----------------------------------------------------------------
#  Main
# ----------------------------------------------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5002))
    app.run(host="0.0.0.0", port=port)
