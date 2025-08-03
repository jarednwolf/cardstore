# CardStore Operations Layer - Frontend

A modern web interface for managing the CardStore Operations Layer setup, monitoring, and administration.

## Features

### 🚀 Setup Wizard
- **Interactive Onboarding**: Step-by-step guided setup process
- **Prerequisites Checking**: Automatic validation of system requirements
- **Environment Configuration**: User-friendly configuration of environment variables
- **Database Setup**: Automated database and service initialization
- **Progress Tracking**: Visual progress indicators and step completion

### 📊 Health Dashboard
- **Real-time Monitoring**: Live system health and service status
- **Comprehensive Diagnostics**: Detailed health checks across all components
- **Visual Health Score**: Easy-to-understand health percentage and metrics
- **Categorized Results**: Organized health checks by system components
- **Auto-refresh**: Automatic updates every 30 seconds

### ⚙️ System Management
- **Service Control**: Start, stop, and restart Docker services
- **Environment Management**: View and edit environment variables
- **Database Operations**: Run migrations and access Prisma Studio
- **Log Viewing**: Real-time log access for all services
- **Configuration Validation**: Verify environment setup

### 📈 Real-time Monitoring
- **WebSocket Integration**: Live updates for system changes
- **Activity Logging**: Track all user actions and system events
- **Service Status Updates**: Real-time service health notifications
- **Connection Management**: Automatic reconnection handling

## Technology Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Styling**: Custom CSS with CSS Variables for theming
- **Icons**: Font Awesome 6
- **Communication**: Fetch API for HTTP requests, WebSocket for real-time updates
- **Architecture**: Modular JavaScript with separation of concerns

## File Structure

```
frontend/
├── index.html              # Main application HTML
├── styles/
│   ├── main.css            # Core styles and layout
│   └── components.css      # Component-specific styles
├── js/
│   ├── api.js             # API communication layer
│   ├── app.js             # Main application controller
│   ├── wizard.js          # Onboarding wizard logic
│   ├── health.js          # Health dashboard functionality
│   └── management.js      # System management features
└── README.md              # This file
```

## Key Components

### API Module (`js/api.js`)
- Centralized API communication
- Error handling and timeout management
- WebSocket connection management
- Activity logging system

### Onboarding Wizard (`js/wizard.js`)
- Multi-step setup process
- Form validation and data collection
- Progress tracking and navigation
- Integration with backend setup APIs

### Health Dashboard (`js/health.js`)
- Real-time health monitoring
- Categorized health check display
- Auto-refresh functionality
- Health report export

### System Management (`js/management.js`)
- Service lifecycle management
- Environment configuration
- Log viewing and downloading
- System metrics display

### Main Application (`js/app.js`)
- Navigation and view management
- Module coordination
- Event handling and routing
- Error handling and recovery

## Usage

### Accessing the Interface

1. Start the CardStore Operations Layer backend
2. Open your browser and navigate to `http://localhost:3000`
3. The frontend will automatically load and connect to the backend

### First-Time Setup

1. Click "Setup Wizard" or navigate to the onboarding view
2. Follow the step-by-step instructions
3. The wizard will guide you through:
   - Prerequisites checking
   - Environment configuration
   - Database setup
   - Final verification

### Monitoring System Health

1. Navigate to the "Health Check" view
2. Click "Run Health Check" for comprehensive diagnostics
3. View categorized results and health score
4. Enable auto-refresh for continuous monitoring

### Managing Services

1. Go to the "Management" view
2. Use the service control buttons to start/stop/restart services
3. View and edit environment configuration
4. Access logs and system metrics

## Browser Compatibility

- **Chrome**: 80+
- **Firefox**: 75+
- **Safari**: 13+
- **Edge**: 80+

## Features in Detail

### Responsive Design
- Mobile-first approach
- Adaptive layouts for different screen sizes
- Touch-friendly interface elements
- Optimized for both desktop and mobile use

### Real-time Updates
- WebSocket connection for live data
- Automatic reconnection on connection loss
- Real-time service status updates
- Live activity feed

### Error Handling
- Graceful degradation on API failures
- User-friendly error messages
- Retry mechanisms for failed operations
- Offline detection and handling

### Accessibility
- Semantic HTML structure
- ARIA labels and roles
- Keyboard navigation support
- High contrast color scheme

## Development

### Local Development
The frontend is served directly by the backend server, so no separate development server is needed.

### Customization
- Modify CSS variables in `styles/main.css` for theming
- Extend functionality by adding new modules
- Customize API endpoints in `js/api.js`

### Adding New Features
1. Create new JavaScript modules following the existing pattern
2. Add corresponding CSS in `styles/components.css`
3. Update the main application controller in `js/app.js`
4. Add new views to `index.html` if needed

## Security Considerations

- All API calls include proper error handling
- Sensitive data is masked in the UI
- CORS is properly configured on the backend
- No sensitive information is stored in localStorage

## Performance

- Lazy loading of data
- Efficient DOM manipulation
- Minimal external dependencies
- Optimized for fast loading and smooth interactions

## Support

For issues or questions about the frontend interface:
1. Check the browser console for error messages
2. Verify backend connectivity
3. Review the activity log for recent actions
4. Consult the troubleshooting guide in the main documentation