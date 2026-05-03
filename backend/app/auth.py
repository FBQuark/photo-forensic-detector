from fastapi import HTTPException
from appwrite.client import Client
from appwrite.services.account import Account

from config import APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID

# Verify the appwrite JWT sent by the frontend and return the current user 
# this function checks that the header exists, creates an appwrite client using the users JWT, calls account.get to confirm that the token recieved is valid
# then returns the authenticated user and the JWT based appwrite client so the backend can now make changes on the users behalf 
def get_current_user_from_auth_header(authorization: str | None):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    jwt = authorization.split(" ", 1)[1].strip() # removes the "bearer" string so all we have left is the raw JWT 

    try:
        client = (
            Client()
            .set_endpoint(APPWRITE_ENDPOINT)
            .set_project(APPWRITE_PROJECT_ID)
            .set_jwt(jwt)
        )

        account = Account(client)
        user = account.get()
        return user, client
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")