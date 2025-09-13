# Polka Deployment Guide for Render

## Overview

This guide covers deploying your Polka monorepo to Render. Your project consists of:

- **API Backend**: FastAPI (Python) in `packages/api/`
- **Frontend**: React/Vite in `packages/frontend/`
- **Mobile**: React Native in `packages/mobile/` (not deployed to Render)

## Deployment Strategy: Separate Services (Recommended)

### 1. API Backend Deployment

#### Service Configuration:

- **Service Type**: Web Service
- **Language**: Python
- **Root Directory**: `packages/api`
- **Build Command**:
  ```bash
  pip install -r requirements.txt
  alembic upgrade head
  ```
- **Start Command**:
  ```bash
  uvicorn main:app --host 0.0.0.0 --port $PORT
  ```

#### Environment Variables to Set:

```
DATABASE_URL=postgresql://username:password@host:port/database
SECRET_KEY=your-secret-key
JWT_SECRET_KEY=your-jwt-secret
OAUTH_GOOGLE_CLIENT_ID=your-google-client-id
OAUTH_GOOGLE_CLIENT_SECRET=your-google-client-secret
OAUTH_APPLE_CLIENT_ID=your-apple-client-id
OAUTH_APPLE_CLIENT_SECRET=your-apple-client-secret
YOOKASSA_SHOP_ID=your-yookassa-shop-id
YOOKASSA_SECRET_KEY=your-yookassa-secret
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USERNAME=your-smtp-username
SMTP_PASSWORD=your-smtp-password
FRONTEND_URL=https://your-frontend-url.onrender.com
```

### 2. Frontend Deployment

#### Service Configuration:

- **Service Type**: Static Site
- **Root Directory**: `packages/frontend`
- **Build Command**:
  ```bash
  npm install
  npm run build
  ```
- **Publish Directory**: `dist`

#### Environment Variables to Set:

```
VITE_API_URL=https://your-api-url.onrender.com
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_APPLE_CLIENT_ID=your-apple-client-id
```

## Step-by-Step Deployment Instructions

### Step 1: Prepare Your Repository

1. Ensure all your code is committed and pushed to GitHub
2. Make sure your `requirements.txt` and `package.json` files are up to date

### Step 2: Deploy API Backend

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `polka-api`
   - **Root Directory**: `packages/api`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt && alembic upgrade head`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add all required environment variables
6. Click "Create Web Service"

### Step 3: Deploy Frontend

1. In Render Dashboard, click "New +" → "Static Site"
2. Connect your GitHub repository
3. Configure the service:
   - **Name**: `polka-frontend`
   - **Root Directory**: `packages/frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Add environment variables (VITE_API_URL should point to your API URL)
5. Click "Create Static Site"

### Step 4: Update CORS Settings

After both services are deployed, update your API's CORS settings to allow your frontend domain.

## Alternative: Single Service Deployment

If you prefer to deploy everything as one service:

### Service Configuration:

- **Service Type**: Web Service
- **Language**: Python
- **Root Directory**: `/` (project root)
- **Build Command**:
  ```bash
  # Install Python dependencies
  cd packages/api && pip install -r requirements.txt && alembic upgrade head
  # Install and build frontend
  cd ../frontend && npm install && npm run build
  ```
- **Start Command**:
  ```bash
  cd packages/api && uvicorn main:app --host 0.0.0.0 --port $PORT
  ```

## Database Setup

### Option 1: Render PostgreSQL (Recommended)

1. In Render Dashboard, create a new PostgreSQL database
2. Copy the connection string to your `DATABASE_URL` environment variable

### Option 2: External Database

Use any PostgreSQL provider (AWS RDS, Supabase, etc.) and set the `DATABASE_URL` accordingly.

## Environment Variables Reference

### API Service Required Variables:

- `DATABASE_URL`: PostgreSQL connection string
- `SECRET_KEY`: Random secret for general encryption
- `JWT_SECRET_KEY`: Secret for JWT token signing
- `FRONTEND_URL`: Your frontend domain for CORS

### Optional API Variables:

- `OAUTH_GOOGLE_CLIENT_ID` & `OAUTH_GOOGLE_CLIENT_SECRET`: Google OAuth
- `OAUTH_APPLE_CLIENT_ID` & `OAUTH_APPLE_CLIENT_SECRET`: Apple OAuth
- `YOOKASSA_SHOP_ID` & `YOOKASSA_SECRET_KEY`: Payment processing
- `SMTP_*`: Email service configuration

### Frontend Service Required Variables:

- `VITE_API_URL`: Your API service URL

## Troubleshooting

### Common Issues:

1. **Build Failures**: Check that all dependencies are in requirements.txt/package.json
2. **Database Connection**: Ensure DATABASE_URL is correctly formatted
3. **CORS Errors**: Verify FRONTEND_URL matches your actual frontend domain
4. **Environment Variables**: Make sure all required variables are set

### Logs:

- Check Render service logs for detailed error messages
- API logs: Service → Logs tab
- Frontend logs: Service → Logs tab

## Cost Considerations

- **Starter Plan**: $7/month per service (API + Frontend = $14/month)
- **Free Tier**: Available but with limitations (sleeps after inactivity)
- **Database**: Render PostgreSQL starts at $7/month

## Next Steps After Deployment

1. Test all API endpoints
2. Verify frontend can connect to API
3. Set up custom domains if needed
4. Configure monitoring and alerts
5. Set up CI/CD for automatic deployments
