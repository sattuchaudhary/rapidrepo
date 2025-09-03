# RapidRepo - Multi-Tenant SaaS Platform

A modern multi-tenant SaaS platform built with Node.js, Express, React, and MongoDB.

## Features

- 🔐 Multi-tenant authentication system
- 👑 Super Admin Panel
- 🏢 Tenant management
- 🔒 Role-based access control
- 📧 Email notifications
- 🎨 Modern UI with React

## Project Structure

```
rapidrepo/
├── server/                 # Backend API
│   ├── config/            # Database and app configuration
│   ├── controllers/       # Route controllers
│   ├── middleware/        # Custom middleware
│   ├── models/           # Database models
│   ├── routes/           # API routes
│   └── utils/            # Utility functions
├── client/               # Frontend React app
│   ├── public/           # Static files
│   ├── src/              # React components
│   └── package.json      # Frontend dependencies
├── package.json          # Backend dependencies
└── README.md            # This file
```

## Quick Start

1. **Install dependencies:**
   ```bash
   npm run install-all
   ```

2. **Set up environment variables:**
   Create a `.env` file in the root directory:
   ```
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   PORT=5000
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Super Admin
- `GET /api/admin/users` - Get all users
- `POST /api/admin/users` - Create new user
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user

## Technologies Used

- **Backend:** Node.js, Express.js, MongoDB, Mongoose
- **Frontend:** React.js, Material-UI
- **Authentication:** JWT, bcryptjs
- **Email:** Nodemailer
- **Security:** Helmet, CORS, Rate limiting

## License

MIT License








