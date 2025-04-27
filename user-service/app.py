from flask import Flask, request, jsonify
from flask_cors import CORS
import uuid
import datetime
import os
import boto3
import requests
from jose import jwk, jwt
from jose.utils import base64url_decode
from botocore.exceptions import ClientError

app = Flask(__name__)
CORS(app)

# ----------------------------------------------------------------
#  AWS & Cognito Config
# ----------------------------------------------------------------
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')
USERS_TABLE_NAME = os.environ.get('USERS_TABLE_NAME', 'Users')
USER_POOL_ID = os.environ.get('COGNITO_USER_POOL_ID')      # e.g., "us-east-1_xxxxx"
USER_POOL_CLIENT_ID = os.environ.get('COGNITO_USER_POOL_CLIENT_ID')

dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
users_table = dynamodb.Table(USERS_TABLE_NAME)

# Boto3 Cognito client for sign-up / sign-in actions
cognito_idp = boto3.client('cognito-idp', region_name=AWS_REGION)

# We’ll grab the JWKS (public keys) from Cognito once on startup or lazily.
JWKS_URL = f"https://cognito-idp.{AWS_REGION}.amazonaws.com/{USER_POOL_ID}/.well-known/jwks.json"
JWKS = None  # Will load on first validation or at startup


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

# ----------------------------------------------------------------
#  Health Check
# ----------------------------------------------------------------
@app.route("/health", methods=["GET"])
def health():
    return "User Service is healthy!", 200

# ----------------------------------------------------------------
#  Cognito-based Sign Up
# ----------------------------------------------------------------
@app.route("/register", methods=["POST"])
def register():
    """
    Registers a user using Cognito.
    For pools using email as an alias, a generated username is used.
    """
    data = request.json
    if not data:
        return jsonify({"error": "Request body required"}), 400

    required_fields = ["name", "email", "password", "profile_type"]
    if not all(field in data for field in required_fields):
        return jsonify({"error": "Missing required fields"}), 400

    name = data["name"]
    email = data["email"]
    password = data["password"]
    profile_type = data["profile_type"]  # "customer" or "counsellor"

    # Construct user attributes for Cognito
    cognito_attributes = [
        {"Name": "email", "Value": email},
        {"Name": "name", "Value": name},
        {"Name": "custom:profile_type", "Value": profile_type}
    ]

    # If counsellor, require specialization
    if profile_type == "counsellor":
        if "specialization" not in data or not data["specialization"].strip():
            return jsonify({"error": "Counsellors must provide specialization"}), 400
        specialization = data["specialization"].strip()
        cognito_attributes.append({"Name": "custom:specialization", "Value": specialization})

    # Generate a unique username that is not in email format
    username = email

    try:
        sign_up_resp = cognito_idp.sign_up(
            ClientId=USER_POOL_CLIENT_ID,
            Username=username,  # generated username instead of email address
            Password=password,
            UserAttributes=cognito_attributes
        )
        # sign_up_resp includes the newly created user's sub in "UserSub"
        user_sub = sign_up_resp["UserSub"]
    except ClientError as e:
        return jsonify({"error": str(e)}), 400

    # Optionally, store additional user data in DynamoDB
    user_item = {
        "user_id": user_sub,  # use the Cognito sub as the unique key
        "name": name,
        "email": email,
        "profile_type": profile_type,
        "created_at": datetime.datetime.utcnow().isoformat() + "Z"
    }
    if profile_type == "counsellor":
        user_item["specialization"] = specialization

    try:
        users_table.put_item(Item=user_item)
    except Exception as e:
        return jsonify({"error": f"Error storing user data: {e}"}), 500

    return jsonify({
        "message": "User registered successfully",
        "user_id": user_sub,
        "status": sign_up_resp.get("UserConfirmed", False)
    }), 201



# ----------------------------------------------------------------
#  Cognito-based Sign Up Confirmation
# ----------------------------------------------------------------
@app.route("/confirm", methods=["POST"])
def confirm():
    data = request.json
    if not data or "email" not in data or "confirmation_code" not in data:
        return jsonify({"error": "Email and confirmation code are required."}), 400

    email = data["email"]
    confirmation_code = data["confirmation_code"]

    # Look up the username using email:
    try:
        lookup_resp = cognito_idp.list_users(
            UserPoolId=USER_POOL_ID,
            Filter=f'email = "{email}"'
        )
        users = lookup_resp.get("Users", [])
        if not users:
            return jsonify({"error": "User not found"}), 404
        username = users[0]["Username"]
    except ClientError as e:
        return jsonify({"error": f"Error looking up user: {e}"}), 500

    # Confirm the user with the provided code
    try:
        confirm_resp = cognito_idp.confirm_sign_up(
            ClientId=USER_POOL_CLIENT_ID,
            Username=username,
            ConfirmationCode=confirmation_code
        )
    except ClientError as e:
        return jsonify({"error": f"Error confirming user: {e}"}), 400

    return jsonify({"message": "User confirmed successfully"}), 200

# ----------------------------------------------------------------
#  Cognito-based Sign In
# ----------------------------------------------------------------
@app.route("/login", methods=["POST"])
def login():
    data = request.json
    if not data or "email" not in data or "password" not in data:
        return jsonify({"error": "Email and password are required"}), 400

    email = data["email"]
    password = data["password"]

    # Lookup the actual username using the email alias.
    try:
        lookup_resp = cognito_idp.list_users(
            UserPoolId=USER_POOL_ID,
            Filter=f'email = "{email}"'
        )
        users = lookup_resp.get("Users", [])
        if not users:
            return jsonify({"error": "User not found"}), 404
        
        # The actual username generated during sign-up is in the 'Username' field.
        username = users[0]["Username"]
    except ClientError as e:
        return jsonify({"error": f"Error looking up user: {e}"}), 500

    # Now authenticate using the actual username.
    try:
        auth_resp = cognito_idp.initiate_auth(
            ClientId=USER_POOL_CLIENT_ID,
            AuthFlow='USER_PASSWORD_AUTH',
            AuthParameters={
                'USERNAME': username,
                'PASSWORD': password
            }
        )
        auth_result = auth_resp['AuthenticationResult']
    except ClientError as e:
        return jsonify({"error": f"Authentication error: {e}"}), 401

    return jsonify({
        "message": "Login successful",
        "access_token": auth_result["AccessToken"],
        "id_token": auth_result["IdToken"],
        "refresh_token": auth_result.get("RefreshToken", None),
        "expires_in": auth_result["ExpiresIn"],
        "token_type": auth_result["TokenType"]
    }), 200

# ----------------------------------------------------------------
#  Token Validation Utility
# ----------------------------------------------------------------
def verify_cognito_token(token):
    """
    Verifies the JWT using the public keys from the Cognito User Pool.
    Raises an exception if verification fails.
    """
    global JWKS
    if not JWKS:
        # Reload JWKS if not loaded or if you prefer lazy loading
        load_jwks()

    headers = jwt.get_unverified_header(token)
    kid = headers['kid']

    # Find the matching public key in our JWKS
    key_index = None
    for i in range(len(JWKS)):
        if kid == JWKS[i]['kid']:
            key_index = i
            break
    if key_index is None:
        raise ValueError("Public key not found in JWKS")

    public_key = jwk.construct(JWKS[key_index])
    message, encoded_signature = token.rsplit('.', 1)
    decoded_signature = base64url_decode(encoded_signature.encode('utf-8'))

    if not public_key.verify(message.encode("utf8"), decoded_signature):
        raise ValueError("Signature verification failed")

    # Now verify claims like issuer, client_id, expiration, etc.
    claims = jwt.get_unverified_claims(token)
    # Check token expiration
    if claims['exp'] < datetime.datetime.utcnow().timestamp():
        raise ValueError("Token is expired")

    # Verify token audience matches your app client ID
    if claims['aud'] != USER_POOL_CLIENT_ID:
        raise ValueError("Token was not issued for this audience")

    # (Optionally) check the issuer
    iss = f"https://cognito-idp.{AWS_REGION}.amazonaws.com/{USER_POOL_ID}"
    if claims['iss'] != iss:
        raise ValueError("Token issuer mismatch")

    # If everything checks out, return the claims
    return claims

# ----------------------------------------------------------------
#  Example Protected Endpoint: fetch all counsellors
# ----------------------------------------------------------------
@app.route("/counsellors", methods=["GET"])
def get_counsellors():
    """
    Example: You must supply a valid Cognito Access/ID token in the header:
      Authorization: Bearer <JWT>
    This endpoint simply returns all users in DynamoDB with profile_type = 'counsellor'.
    """
    # Grab the token from the Authorization header
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return jsonify({"error": "Missing Authorization header"}), 401

    # Parse out the 'Bearer <token>'
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return jsonify({"error": "Invalid Authorization header format"}), 401

    token = parts[1]

    # Verify token (this will raise if invalid)
    try:
        claims = verify_cognito_token(token)
    except Exception as e:
        return jsonify({"error": f"Token verification failed: {e}"}), 401

    # If we get here, token is valid. Let's fetch counsellors from DynamoDB
    try:
        response = users_table.scan()
        all_users = response.get("Items", [])
        counsellors = [u for u in all_users if u.get("profile_type") == "counsellor"]
        return jsonify(counsellors), 200
    except Exception as e:
        return jsonify({"error": "Error fetching counsellors: " + str(e)}), 500

# ----------------------------------------------------------------
#  Main
# ----------------------------------------------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
