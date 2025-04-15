from flask import Flask, request, jsonify
from flask_cors import CORS
import uuid
import os
import boto3
import requests
import datetime
from jose import jwk, jwt
from jose.utils import base64url_decode
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Attr  # For filter expressions

app = Flask(__name__)
CORS(app)

# ----------------------------------------------------------------
#  Environment / AWS Config
# ----------------------------------------------------------------
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')
USERS_TABLE_NAME = os.environ.get('USERS_TABLE_NAME', 'Users')

COGNITO_USER_POOL_ID = os.environ.get('COGNITO_USER_POOL_ID')
COGNITO_USER_POOL_CLIENT_ID = os.environ.get('COGNITO_USER_POOL_CLIENT_ID')

JWKS_URL = f"https://cognito-idp.{AWS_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}/.well-known/jwks.json"
JWKS = None

dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
users_table = dynamodb.Table(USERS_TABLE_NAME)

@app.before_first_request
def load_jwks():
    global JWKS
    try:
        resp = requests.get(JWKS_URL)
        resp.raise_for_status()
        JWKS = resp.json()["keys"]
        print("JWKS loaded successfully.")
    except Exception as e:
        print(f"Failed to load JWKS from {JWKS_URL}: {e}")

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
    if claims['exp'] < datetime.datetime.utcnow().timestamp():
        raise ValueError("Token is expired")
    if 'aud' not in claims:
        raise ValueError("Token does not contain an 'aud' claim")
    if claims['aud'] != COGNITO_USER_POOL_CLIENT_ID:
        raise ValueError("Token was not issued for this audience")
    iss = f"https://cognito-idp.{AWS_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}"
    if claims.get('iss') != iss:
        raise ValueError("Token issuer mismatch")
    return claims

# ----------------------------------------------------------------
#  Health Check
# ----------------------------------------------------------------
@app.route("/health", methods=["GET"])
def health():
    return "Counsellors Service is healthy!", 200

@app.route("/counsellors", methods=["GET"])
def list_counsellors():
    """
    Retrieves counsellors from the Users table where profile_type equals 'counsellor'.
    A valid Cognito ID token must be provided in the Authorization header.
    """
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return jsonify({"error": "Missing Authorization header"}), 401
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return jsonify({"error": "Invalid Authorization header format"}), 401
    token = parts[1]
    try:
        verify_cognito_token(token)
    except Exception as e:
        return jsonify({"error": f"Token verification failed: {e}"}), 401
    try:
        response = users_table.scan(
            FilterExpression=Attr("profile_type").eq("counsellor")
        )
        counsellors = response.get("Items", [])
        return jsonify(counsellors), 200
    except Exception as e:
        return jsonify({"error": "Error fetching counsellors: " + str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port)
