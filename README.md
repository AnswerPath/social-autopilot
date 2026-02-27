# Social Autopilot

**Social Autopilot** is a comprehensive social media management platform with enterprise-grade authentication, role-based access control, and team collaboration features.

## 🚀 Features

### Authentication & Security
- **Secure User Authentication**: Email/password authentication powered by Supabase Auth
- **Session Management**: Secure session handling with automatic token refresh
- **Password Security**: Strong password requirements with secure hashing
- **Password Reset**: Secure email-based password reset flow

### Role-Based Access Control (RBAC)
- **Three Core Roles**: Admin, Editor, and Viewer with distinct permission sets
- **Granular Permissions**: 30+ specific permissions across 9 categories
- **Dynamic Role Management**: Flexible role assignment and permission customization
- **Resource-Based Access**: Fine-grained access control for specific resources

### User Management
- **User Profiles**: Comprehensive profile management with avatar uploads
- **Account Settings**: Customizable preferences and notification settings
- **Session Management**: View and manage active sessions across devices
- **Activity Logging**: Complete audit trail of user actions

### Team Collaboration
- **Team Creation**: Organize users into teams for better collaboration
- **Member Invitations**: Invite team members with role assignments
- **Content Sharing**: Share and collaborate on content within teams
- **Team Analytics**: Track team performance and contributions

### Audit & Compliance
- **Comprehensive Logging**: Track all authentication and authorization events
- **Security Monitoring**: Monitor failed login attempts and suspicious activities
- **Permission Audits**: Log all permission checks and decisions
- **Export Capabilities**: Export audit logs for compliance requirements

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [User Guides](#user-guides)
- [API Documentation](#api-documentation)
- [Architecture](#architecture)
- [Development](#development)
- [Deployment](#deployment)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Quick Start

### Prerequisites

- **Node.js**: 18.x or higher
- **npm**: 9.x or higher
- **Supabase Account**: For authentication and database
- **PostgreSQL**: (via Supabase)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/social-autopilot.git
cd social-autopilot
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Optional: Email notifications (Resend)
RESEND_API_KEY=re_your_resend_api_key
# RESEND_FROM=Social Autopilot <notifications@yourdomain.com>

# Optional: Third-party Integrations
TWITTER_CLIENT_ID=your-twitter-client-id
TWITTER_CLIENT_SECRET=your-twitter-client-secret
```

4. **Set up the database**
```bash
npm run setup-database
```

5. **Start the development server**
```bash
npm run dev
```

6. **Open your browser**
Navigate to [http://localhost:3000](http://localhost:3000)

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |
| `NEXT_PUBLIC_APP_URL` | Your application URL | Yes |
| `NODE_ENV` | Environment (development/production) | Yes |
| `RESEND_API_KEY` | Resend API key for email notifications | No (email notifications disabled if missing) |
| `RESEND_FROM` | Sender address (e.g. `App <notifications@yourdomain.com>`). Defaults to Resend onboarding domain for testing. | No |

### Database Setup

The application uses Supabase PostgreSQL database with the following tables:

- `user_profiles` - User profile information
- `user_roles` - Role assignments
- `user_permissions` - Custom permission grants
- `user_sessions` - Active user sessions
- `account_settings` - User preferences and settings
- `audit_logs` - System audit trail
- `permission_audit_logs` - Permission check logs
- `teams` - Team information
- `team_members` - Team membership

Run the setup script to create all required tables:

```bash
npm run setup-database
```

Or manually run the SQL scripts:

```bash
psql -h your-db-host -U your-username -d your-database -f setup-auth-tables.sql
psql -h your-db-host -U your-username -d your-database -f supabase/migrations/20250102000002_team_collaboration.sql
```

## 📚 User Guides

### For End Users
- [Getting Started Guide](docs/USER_GUIDE.md)
- [Profile Management](docs/USER_GUIDE.md#profile-management)
- [Account Settings](docs/USER_GUIDE.md#account-settings)
- [Team Collaboration](docs/USER_GUIDE.md#team-collaboration)

### For Administrators
- [Admin Guide](docs/ADMIN_GUIDE.md)
- [User Management](docs/ADMIN_GUIDE.md#user-management)
- [Role Configuration](docs/ADMIN_GUIDE.md#role-configuration)
- [Security Settings](docs/ADMIN_GUIDE.md#security-settings)
- [Audit Logs](docs/ADMIN_GUIDE.md#audit-logs)

### For Developers
- [API Documentation](docs/API_DOCUMENTATION.md)
- [Authentication System Architecture](docs/authentication-system-architecture.md)
- [RBAC Framework](docs/rbac-framework-architecture.md)
- [Session Management](docs/session-management-architecture.md)

## 🔌 API Documentation

Full API documentation is available in [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md).

### Quick Reference

**Authentication Endpoints**
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/reset-password` - Request password reset
- `POST /api/auth/reset-password/confirm` - Confirm password reset

**User Management**
- `GET /api/profile` - Get user profile
- `PUT /api/profile` - Update user profile
- `GET /api/account-settings` - Get account settings
- `PUT /api/account-settings` - Update account settings

**Role & Permission Management**
- `GET /api/auth/roles` - List all roles
- `GET /api/auth/permissions` - List all permissions
- `POST /api/auth/users/roles` - Assign role to user

**Team Management**
- `GET /api/teams` - List all teams
- `POST /api/teams` - Create new team
- `GET /api/teams/:id` - Get team details
- `POST /api/teams/:id/members` - Add team member

## 🏗️ Architecture

The application is built with a modern, scalable architecture:

### Technology Stack

- **Frontend**: React 18 with Next.js 15.2.0 (App Router)
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth
- **UI Framework**: Shadcn/ui with Tailwind CSS
- **State Management**: React Context API
- **Form Handling**: React Hook Form with Zod validation

### Key Components

```text
social-autopilot/
├── app/                      # Next.js App Router
│   ├── api/                  # API routes
│   │   ├── auth/            # Authentication endpoints
│   │   ├── profile/         # Profile management
│   │   └── teams/           # Team management
│   ├── auth/                # Auth pages
│   ├── dashboard/           # Main dashboard
│   └── profile/             # Profile pages
├── components/              # React components
│   ├── auth/               # Auth-related components
│   └── ui/                 # UI components
├── hooks/                   # Custom React hooks
├── lib/                     # Utility libraries
│   ├── auth-utils.ts       # Auth utilities
│   ├── auth-types.ts       # Type definitions
│   └── supabase.ts         # Supabase client
└── docs/                    # Documentation
```

### Authentication Flow

1. User submits credentials
2. Server validates with Supabase Auth
3. JWT tokens issued and stored in HTTP-only cookies
4. Session created in database
5. User profile and role loaded
6. Permission checks on protected routes

### Permission System

The system uses a hierarchical permission model:

- **Roles**: Define broad access levels (ADMIN, EDITOR, VIEWER)
- **Permissions**: Granular action rights (CREATE_POST, VIEW_ANALYTICS, etc.)
- **Explicit Grants**: Override role-based permissions for specific users
- **Resource-Based**: Permissions can be scoped to specific resources

## 🛠️ Development

### Project Structure

```typescript
// Type Definitions (lib/auth-types.ts)
export enum UserRole {
  ADMIN = 'ADMIN',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER'
}

export enum Permission {
  CREATE_POST = 'CREATE_POST',
  EDIT_POST = 'EDIT_POST',
  // ... 30+ permissions
}
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Code Quality

```bash
# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run type-check
```

### Database Migrations

```bash
# Create new migration
npm run db:migration:create

# Run migrations
npm run db:migration:up

# Rollback migrations
npm run db:migration:down
```

## 🚢 Deployment

- **Deploying a fork to Vercel?** See **[docs/VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md)** for required env vars (including `SUPABASE_SERVICE_ROLE_KEY` for sign-up), Supabase URL configuration, and troubleshooting account creation errors.

### Prerequisites

- Production Supabase project
- Node.js hosting (Vercel, Netlify, or custom server)
- Domain with SSL certificate

### Deployment Steps

1. **Prepare production database**
```bash
# Run migrations on production
npm run db:migration:up -- --env=production
```

2. **Configure environment variables**
Set all required environment variables in your hosting platform.

3. **Build the application**
```bash
npm run build
```

4. **Deploy to hosting platform**

**Vercel:**
```bash
vercel --prod
```

**Custom Server:**
```bash
npm run start
```

### Post-Deployment Checklist

- ✅ Verify database connection
- ✅ Test authentication flow
- ✅ Check permission system
- ✅ Verify email delivery (password reset)
- ✅ Test session management
- ✅ Review security headers
- ✅ Enable monitoring and logging

For detailed deployment instructions, see [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md).

## 🔒 Security

### Security Features

- **Password Security**: Secure hashing via Supabase Auth
- **Session Security**: HTTP-only cookies with secure flags
- **Token Security**: JWT tokens with expiration and refresh
- **Rate Limiting**: Protection against brute force attacks
- **Audit Logging**: Comprehensive security event tracking
- **Row Level Security**: Database-level access control

### Security Best Practices

1. **Environment Variables**: Never commit `.env` files
2. **API Keys**: Rotate keys regularly
3. **Password Policy**: Enforce strong passwords
4. **Session Management**: Implement session timeout
5. **Audit Logs**: Regular review of security events
6. **Updates**: Keep dependencies up to date

### Reporting Security Issues

If you discover a security vulnerability, please email [security@example.com](mailto:security@example.com). Do not open a public issue.

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass (`npm test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Supabase](https://supabase.com) - Authentication and database
- [Next.js](https://nextjs.org) - React framework
- [Shadcn/ui](https://ui.shadcn.com) - UI components
- [Tailwind CSS](https://tailwindcss.com) - Styling

## 📞 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/yourusername/social-autopilot/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/social-autopilot/discussions)
- **Email**: [support@example.com](mailto:support@example.com)

---

Built with ❤️ by the Social Autopilot Team

