# Integrador Waha-Typebot - Frontend

A modern React frontend for managing Waha-Typebot integrations with a clean, responsive, and professional UI.

## Features

- **Authentication**: Secure token-based authentication
- **Dashboard**: Overview with metrics and recent activity
- **Sessions Management**: View and manage Waha sessions, create integrations
- **Logs Viewer**: Filter and view webhook event logs with detailed payloads
- **Settings**: Configure Waha and Typebot connections with test functionality

## Tech Stack

- **React 18** with TypeScript
- **React Router** for navigation
- **Zustand** for state management
- **Axios** for API calls
- **TailwindCSS** for styling
- **Lucide React** for icons
- **React Hot Toast** for notifications
- **Vite** for build tooling

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Button.tsx      # Button component with variants
│   ├── Card.tsx        # Card container component
│   ├── Layout.tsx      # Main layout with sidebar
│   ├── Modal.tsx       # Modal dialog component
│   └── Table.tsx       # Table component with loading states
├── hooks/              # Custom React hooks
│   └── useAuth.ts      # Authentication hook with Zustand
├── pages/              # Page components
│   ├── Dashboard.tsx   # Dashboard with metrics
│   ├── Login.tsx       # Login page
│   ├── Logs.tsx        # Event logs viewer
│   ├── Sessions.tsx    # Sessions management
│   └── Settings.tsx    # Settings configuration
├── services/           # API services
│   └── api.ts          # Axios API client
├── types/              # TypeScript type definitions
│   └── index.ts        # All interfaces and types
├── App.tsx             # Main app with routing
├── main.tsx            # App entry point
└── index.css           # Global styles
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Update the `.env` file with your API URL:
```env
VITE_API_URL=http://localhost:3000/api
```

### Development

Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## Features Detail

### Authentication
- Token-based authentication
- Automatic token persistence in localStorage
- Protected routes with automatic redirect
- Token verification on app load

### Dashboard
- Total sessions count
- Active integrations count
- Messages processed count
- Recent activity feed
- Quick action links

### Sessions Page
- List all Waha sessions
- Real-time status badges (WORKING, STOPPED, FAILED, etc.)
- Search/filter sessions
- Create Typebot integrations
- Send test messages
- View session integrations
- Toggle integration status
- Delete integrations

### Logs Page
- View all webhook events
- Filter by:
  - Session name
  - Direction (incoming/outgoing)
  - Provider (Waha/Typebot)
- Pagination support
- View detailed JSON payloads
- Event type display

### Settings Page
- Configure Waha base URL and API key
- Configure Typebot base URL
- Test connections independently
- Visual connection status indicators
- Form validation

## Components

### Button
Reusable button component with variants:
- `primary` - Blue primary button
- `secondary` - Gray secondary button
- `danger` - Red danger button
- `ghost` - Transparent ghost button

Sizes: `sm`, `md`, `lg`

Props include `isLoading` for loading states.

### Card
Container component with optional title and action buttons.

### Table
Generic table component with:
- Column configuration
- Loading states
- Empty states
- Custom cell renderers

### Modal
Accessible modal dialog with:
- Backdrop click to close
- Escape key to close
- Customizable footer
- Multiple sizes

### Layout
Main application layout with:
- Responsive sidebar navigation
- Mobile menu toggle
- Active route highlighting
- Logout functionality

## API Integration

The API client (`src/services/api.ts`) provides:
- Automatic token injection
- Request/response interceptors
- Error handling with automatic logout on 401
- TypeScript typed methods for all endpoints

### Available Methods
- `login(data)` - Authenticate user
- `verifyToken()` - Verify token validity
- `getSettings()` - Get settings
- `updateSettings(settings)` - Update settings
- `testWahaConnection()` - Test Waha connection
- `testTypebotConnection()` - Test Typebot connection
- `getSessions()` - Get all sessions
- `getMappings()` - Get all mappings
- `getMappingsBySession(sessionName)` - Get session mappings
- `createMapping(data)` - Create new mapping
- `updateMapping(id, data)` - Update mapping
- `deleteMapping(id)` - Delete mapping
- `toggleMapping(id)` - Toggle mapping status
- `getLogs(params)` - Get event logs
- `getMetrics()` - Get dashboard metrics
- `sendTestMessage(data)` - Send test message

## State Management

Using Zustand for authentication state:
- Persists token in localStorage
- Global authentication state
- Login/logout actions
- Token verification

## Styling

Using TailwindCSS with:
- Responsive design (mobile-first)
- Consistent color palette
- Hover and focus states
- Smooth transitions
- Custom utility classes

## Development Guidelines

1. **TypeScript**: All files use TypeScript with proper types
2. **Components**: Reusable components in `/components`
3. **Pages**: Route components in `/pages`
4. **API Calls**: Use the API client service
5. **State**: Use Zustand for global state, React state for local
6. **Styling**: Use TailwindCSS utility classes
7. **Icons**: Use Lucide React icons
8. **Notifications**: Use React Hot Toast

## Error Handling

- API errors show toast notifications
- 401 errors trigger automatic logout
- Loading states prevent duplicate requests
- Form validation prevents invalid submissions

## Responsive Design

- Mobile-first approach
- Sidebar collapses on mobile
- Touch-friendly button sizes
- Responsive tables with horizontal scroll
- Grid layouts adjust to screen size

## License

MIT
