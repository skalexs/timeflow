# TimeFlow

Smart scheduling app with AI-powered availability engine.

## Setup

```bash
cp app/.env app/.env.local  # Edit with your values
docker compose up -d
```

## Environment variables

- `DATABASE_URL` — PostgreSQL connection string
- `GOOGLE_CLIENT_ID` — Google OAuth2 client ID
- `GOOGLE_CLIENT_SECRET` — Google OAuth2 client secret
- `GOOGLE_REDIRECT_URI` — OAuth2 redirect URI
