







# photo-forensic-detector## Environment Setup

This project uses separate environment files for the backend, web app, and mobile app.

The repository includes example files with the required variable names:

```txt
backend/app/.env.example
web/.env.example
mobile/.env.example
```

Before running the project, create the real environment files from the provided Templates.

From the project root, run:

```bash
cp backend/app/.env.example backend/app/.env
cp web/.env.example web/.env.local
cp mobile/.env.example mobile/.env.local
```

Then fill in the missing values with the values provided to you by one of the collaborators (saving the mobile EXPO_PUBLIC_API_URL blank for now)

## Running the Web App

The web version runs with two local services:

- FastAPI backend on `http://127.0.0.1:8000`
- Next.js web app on `http://localhost:3000`

Before starting, make sure these files have been created and filled in:

```txt
backend/app/.env
web/.env.local
```

For local web testing, the web app's API URL should point to the local backend:

```txt
http://localhost:8000
```

Use the exact variable name shown in `web/.env.example`.

### Terminal 1: Start the Backend

From the project root, run:

```bash
cd backend
pip install -r requirements.txt
fastapi dev app/main.py
```

If you are using a Python virtual environment, activate it before running `pip install`.

Leave this terminal running.

### Terminal 2: Start the Web App

Open a second terminal from the project root, then run:

```bash
cd web
npm install
npm run dev
```

Once the web app starts, open:

```txt
http://localhost:3000
```

The backend terminal must stay running while using the web app.

Video Demo:


https://github.com/user-attachments/assets/76f6399d-0660-4b16-be98-6842554f7557


## Running the Mobile App

The mobile app requires the backend to be running and publicly accessible. Since the app runs on a physical phone through Expo, it cannot reliably use `localhost` for backend requests.

The correct order is:

1. Start the backend.
2. Start ngrok and copy the public forwarding URL.
3. Paste the public ngrok URL into `mobile/.env.local`.
4. Start the Expo mobile frontend.

Before starting, make sure these files have been created and filled in:

```txt
backend/app/.env
mobile/.env.local
```

Leave `EXPO_PUBLIC_API_URL` blank until ngrok is running.

### Terminal 1: Start the Backend

From the project root, run:

```bash
cd backend
pip install -r requirements.txt
fastapi dev app/main.py
```

Leave this terminal running.

The backend should be running locally at:

```txt
http://127.0.0.1:8000
```

### Terminal 2: Start ngrok

Open a second terminal from the project root and run:

```bash
ngrok http 8000
```

ngrok will display a public forwarding URL that looks something like this:

```txt
https://example-name.ngrok-free.dev
```

Copy that public URL.

### Update the Mobile Environment File

Open:

```txt
mobile/.env.local
```

Find:

```env
EXPO_PUBLIC_API_URL=
```

Set it equal to the ngrok forwarding URL:

```env
EXPO_PUBLIC_API_URL=https://example-name.ngrok-free.dev
```

Do not include a trailing slash at the end of the URL.

### Terminal 3: Start the Mobile App

Open a third terminal from the project root and run:

```bash
cd mobile
npm install
npx expo start --tunnel -c
```

Once Expo starts, scan the QR code using Expo Go mobile application (must be downloaded from your app store).

The backend and ngrok terminals must stay running while using the mobile app.


mobile demo:


https://github.com/user-attachments/assets/4587fbe1-856b-42b9-9249-bdc86a8b705f
