# OdinVault Backend

A robust Node.js + TypeScript backend for a personal cloud storage platform with authentication, file management, sharing, and search capabilities.

## Features

- 🔐 **Authentication**: Email/password and Google OAuth login
- 📁 **File Storage**: Upload, download, and manage files with cloud storage
- 🔍 **Search & Metadata**: Advanced file search with tags and folders
- 📤 **File Sharing**: Generate secure share links with expiry dates
- 🗂️ **Organization**: Folder structure and tagging system
- 🗑️ **Soft Delete**: Trash bin with auto-purge functionality
- 🔒 **Security**: Rate limiting, input validation, and request logging
- 🖼️ **Previews**: Automatic thumbnail generation for images

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Storage**: AWS S3 / Backblaze B2
- **Authentication**: JWT + Google OAuth
- **File Processing**: Sharp for image thumbnails
- **Validation**: Zod schema validation
- **Logging**: Winston
- **Security**: Helmet, CORS, Rate limiting

## Project Structure

```
src/
├── index.ts                 # Application entry point
├── middleware/              # Express middleware
│   ├── auth.ts             # JWT authentication
│   ├── errorHandler.ts     # Error handling
│   └── validation.ts       # Request validation
├── routes/                  # API routes
│   ├── auth.ts             # Authentication routes
│   ├── files.ts            # File management routes
│   └── shares.ts           # File sharing routes
├── services/               # Business logic
│   ├── authService.ts      # User authentication
│   ├── googleAuthService.ts # Google OAuth
│   ├── fileService.ts      # File operations
│   └── shareService.ts     # Share management
├── utils/                  # Utilities
│   ├── database.ts         # Database connection
│   ├── logger.ts           # Logging configuration
│   ├── storage.ts          # Cloud storage operations
│   └── preview.ts          # File preview generation
└── scripts/                # Database scripts
    ├── seed.ts             # Database seeding
    └── cleanup.ts          # Cleanup tasks
```

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- AWS S3 or Backblaze B2 account
- Google OAuth credentials (optional)

### Installation

1. **Clone and install dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

3. **Database Setup**
   ```bash
   npx prisma generate
   npx prisma migrate dev
   npm run db:seed
   ```

4. **Start the server**
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3000`

## Docker Setup

```bash
# Start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f backend
```

## API Documentation

### Authentication

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Google OAuth Authentication
```http
POST /api/auth/google
Content-Type: application/json

{
  "idToken": "google-id-token-from-frontend"
}
```

#### Get Google OAuth URL
```http
GET /api/auth/google/url
```

#### Get User Profile
```http
GET /api/auth/profile
Authorization: Bearer <jwt-token>
```

### File Management

#### Upload File
```http
POST /api/files/upload
Authorization: Bearer <jwt-token>
Content-Type: multipart/form-data

file: <file>
folder: "documents" (optional)
tags: ["work", "important"] (optional)
```

#### Search Files
```http
GET /api/files/search?q=document&type=pdf&tags=work&folder=documents&page=1&limit=20
Authorization: Bearer <jwt-token>
```

#### Get File Details
```http
GET /api/files/:id
Authorization: Bearer <jwt-token>
```

#### Download File
```http
GET /api/files/:id/download
Authorization: Bearer <jwt-token>
```

#### Get File Preview
```http
GET /api/files/:id/preview
Authorization: Bearer <jwt-token>
```

#### Delete File
```http
DELETE /api/files/:id
Authorization: Bearer <jwt-token>
```

### File Sharing

#### Create Share Link
```http
POST /api/shares/:fileId
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "expiresAt": "2024-12-31T23:59:59Z" (optional)
}
```

#### List User's Shares
```http
GET /api/shares
Authorization: Bearer <jwt-token>
```

#### Access Shared File
```http
GET /api/shares/:token
```

#### Deactivate Share
```http
DELETE /api/shares/:shareId
Authorization: Bearer <jwt-token>
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `JWT_SECRET` | JWT signing secret | - |
| `JWT_EXPIRES_IN` | JWT token expiry | `7d` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | - |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | - |
| `GOOGLE_REDIRECT_URI` | Google OAuth redirect URI | `http://localhost:3000/auth/google/callback` |
| `AWS_ACCESS_KEY_ID` | AWS access key | - |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | - |
| `AWS_REGION` | AWS region | `us-east-1` |
| `AWS_S3_BUCKET` | S3 bucket name | - |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `MAX_FILE_SIZE` | Max file size (bytes) | `104857600` (100MB) |
| `ALLOWED_FILE_TYPES` | Allowed MIME types | `image/*,video/*,application/pdf,text/*` |
| `TRASH_PURGE_DAYS` | Days before permanent deletion | `30` |
| `DEFAULT_SHARE_EXPIRY_DAYS` | Default share link expiry | `7` |

## Google OAuth Setup

1. **Create Google OAuth Credentials**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable Google+ API
   - Go to Credentials → Create Credentials → OAuth 2.0 Client ID
   - Set authorized redirect URIs

2. **Configure Environment Variables**
   ```bash
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
   ```

3. **Frontend Integration**
   ```javascript
   // Get OAuth URL
   const response = await fetch('/api/auth/google/url');
   const { authUrl } = await response.json();
   
   // Redirect to Google
   window.location.href = authUrl;
   
   // After Google redirect, get ID token and authenticate
   const idToken = 'google-id-token';
   const authResponse = await fetch('/api/auth/google', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ idToken })
   });
   ```

## Testing

### Test Credentials
- **Admin**: `admin@odinvault.com` / `admin123456`
- **User**: `user@odinvault.com` / `user123456`
- **Google User**: `googleuser@odinvault.com` (OAuth only)

### Test Share Link
```
http://localhost:3000/api/shares/test-share-token-123
```

## Database Schema

### Users
- `id`: Unique identifier
- `email`: Email address (unique)
- `password`: Hashed password (optional for OAuth users)
- `name`: Display name
- `googleId`: Google OAuth ID (unique)
- `googleEmail`: Google email (unique)
- `avatar`: Profile picture URL
- `emailVerified`: Email verification status

### Files
- `id`: Unique identifier
- `name`: Internal file name
- `originalName`: Original file name
- `size`: File size in bytes
- `mimeType`: MIME type
- `storageKey`: Cloud storage key
- `previewKey`: Preview/thumbnail key
- `tags`: Array of tags
- `folder`: Folder path
- `isDeleted`: Soft delete flag
- `deletedAt`: Deletion timestamp
- `ownerId`: User who owns the file

### Shares
- `id`: Unique identifier
- `token`: Share token (unique)
- `expiresAt`: Expiry timestamp
- `isActive`: Active status
- `fileId`: Associated file
- `createdById`: User who created the share

### Tags
- `id`: Unique identifier
- `name`: Tag name (unique per user)
- `color`: Tag color
- `userId`: User who owns the tag

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Google OAuth**: Secure third-party authentication
- **Rate Limiting**: API request rate limiting
- **Input Validation**: Zod schema validation
- **CORS**: Cross-origin resource sharing
- **Helmet**: Security headers
- **Request Logging**: IP, endpoint, timestamp logging
- **File Type Validation**: MIME type checking
- **File Size Limits**: Configurable upload limits

## Deployment

### Production Considerations

1. **Environment Variables**
   - Set all required environment variables
   - Use strong JWT secrets
   - Configure production database URL

2. **Database**
   - Run migrations: `npx prisma migrate deploy`
   - Set up database backups
   - Configure connection pooling

3. **Security**
   - Enable HTTPS
   - Configure CORS for production domains
   - Set up proper rate limiting
   - Use environment-specific logging

4. **Monitoring**
   - Set up application monitoring
   - Configure error tracking
   - Monitor file storage usage

### Serverless Deployment

The backend is designed to be serverless-friendly:

- **Stateless**: No in-memory state
- **Database**: Uses Prisma with connection pooling
- **File Storage**: Cloud storage integration
- **Environment**: Environment variable configuration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the API examples

---

Built with ❤️ for secure and efficient file management
