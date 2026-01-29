# Timer Modal API Implementation - Summary

## Overview
This implementation adds 3 new API endpoints for the timer modal to fetch database-driven dropdowns instead of using hardcoded values.

## Changes Made

### 1. Database Schema (`database/migrations/001_add_rooms_and_update_timers.sql`)

**New Table: `rooms`**
- `id` - Primary key
- `branch_id` - Foreign key to branches
- `name` - Room/Sofa name (e.g., "Room 1", "Sofa A")
- `type` - Service type (SPA, LC, etc.)
- `is_active` - Active status
- `created_at` - Timestamp

**Updated Table: `timers`**
Added columns:
- `service_id` - Foreign key to services table
- `room_id` - Foreign key to rooms table
- `branch_id` - Foreign key to branches table
- `planned_end_time` - Timestamp for timer end

**Index:**
- Created index on `timers(room_id, end_time)` for faster occupancy lookups

### 2. Backend API Endpoints

#### 2.1 GET /api/timers/therapists
**Purpose:** Fetch active therapists filtered by branch and service type

**Query Parameters:**
- `branch_id` (optional) - Uses authenticated user's branch if not provided
- `service_type` (optional) - Filter by service type

**Response:**
```json
[
  {
    "id": 1,
    "name": "Ayu",
    "grade_id": 2,
    "grade_name": "Gold"
  }
]
```

**File:** `backend/modules/timers/timer.controller.js` (exports.getTherapists)

#### 2.2 GET /api/timers/rooms
**Purpose:** Fetch available rooms by service type with real-time occupancy checking

**Query Parameters:**
- `branch_id` (optional) - Uses authenticated user's branch if not provided
- `service_type` (optional) - Filter by room type (SPA, LC, etc.)

**Response:**
```json
[
  {
    "id": 1,
    "name": "Room 1",
    "type": "SPA",
    "is_active": true,
    "is_occupied": false,
    "status": "available"
  },
  {
    "id": 4,
    "name": "Sofa 1",
    "type": "LC",
    "is_active": true,
    "is_occupied": true,
    "status": "occupied"
  }
]
```

**Occupancy Logic:**
- Checks `timers` table for active timers (WHERE `end_time IS NULL`)
- Room is occupied if it has an active timer

**File:** `backend/modules/timers/timer.controller.js` (exports.getRooms)

#### 2.3 GET /api/services/by-type
**Purpose:** Fetch services by type to get duration_minutes

**Query Parameters:**
- `type` (required) - Service type (SPA, LC, etc.)
- `branch_id` (optional) - Uses authenticated user's branch if not provided

**Response:**
```json
[
  {
    "id": 1,
    "name": "Spa Relax 60 Menit",
    "type": "SPA",
    "base_price": 300000,
    "duration_minutes": 60,
    "is_active": true,
    "branch": "Numars Pondok Indah"
  }
]
```

**File:** `backend/modules/services/service.controller.js` (exports.getByType)

### 3. Frontend Changes

#### 3.1 StartTimerModal.vue
**Major Updates:**
- Replaced hardcoded service types with database-driven service dropdown
- Replaced text input for therapist with dropdown selection
- Replaced text input for room/sofa with dropdown selection
- Added real-time occupancy status display (✅ Free / ❌ Occupied)
- Disabled occupied rooms in dropdown
- Auto-fills duration from selected service
- Added loading states for all API calls
- Added comprehensive error handling
- Improved validation to require dropdown selections

**New State Variables:**
- `services` - List of available services
- `therapists` - List of active therapists
- `rooms` - List of rooms with occupancy status
- `selectedServiceId` - Selected service ID
- `selectedTherapistId` - Selected therapist ID
- `selectedRoomId` - Selected room ID
- Loading states and error messages

**API Integration:**
```javascript
// Fetches services on component mount
fetchServices() -> GET /api/services

// Fetches therapists when service type changes
fetchTherapists() -> GET /api/timers/therapists?service_type=SPA

// Fetches rooms when service type changes
fetchRooms() -> GET /api/timers/rooms?service_type=SPA
```

**Event Emitted:**
```javascript
{
  service_id: number,
  service_type: string,
  therapist_id: number,
  room_id: number,
  duration_minutes: number
}
```

#### 3.2 KasirDashboard.vue
**Updates:**
- Modified `createManualTimer` function to handle new data format
- Uses `duration_minutes` instead of `duration`
- Uses IDs (`therapist_id`, `room_id`, `service_id`) instead of names
- Added error handling for API calls
- Reverts slot status on error

## Migration Instructions

### Database Migration
Run the migration script to create the rooms table and update the timers table:

```bash
# Using psql
psql -U your_username -d your_database -f database/migrations/001_add_rooms_and_update_timers.sql

# Or from psql prompt
\i database/migrations/001_add_rooms_and_update_timers.sql
```

### Sample Data
The migration includes sample room data for branches 1 and 2:
- Branch 1: Room 1-3, Sofa 1-3
- Branch 2: Room A-B, Sofa A-B

You can customize this data or add more rooms as needed.

## Testing Checklist

### Backend Testing
- [ ] Test GET /api/timers/therapists endpoint
  - [ ] Without query parameters (uses auth user's branch)
  - [ ] With branch_id parameter
  - [ ] With service_type parameter
  - [ ] Verify only active therapists are returned

- [ ] Test GET /api/timers/rooms endpoint
  - [ ] Without query parameters
  - [ ] With service_type parameter
  - [ ] Verify occupancy status is correct
  - [ ] Create an active timer and verify room shows as occupied

- [ ] Test GET /api/services/by-type endpoint
  - [ ] With valid type parameter
  - [ ] Verify only active services are returned
  - [ ] Verify duration_minutes is included

### Frontend Testing
- [ ] Open StartTimerModal and verify service dropdown loads
- [ ] Select a service and verify:
  - [ ] Therapists dropdown loads
  - [ ] Rooms dropdown loads
  - [ ] Duration auto-fills correctly
  - [ ] Room occupancy status displays correctly
- [ ] Try to select an occupied room (should be disabled)
- [ ] Submit the form and verify timer is created
- [ ] Verify error handling for API failures
- [ ] Verify loading states display correctly

### Integration Testing
- [ ] Create a timer and verify the room becomes occupied
- [ ] Stop the timer and verify the room becomes available again
- [ ] Test with multiple branches
- [ ] Test with different service types (SPA, LC)

## Security Notes

The CodeQL security scanner identified that the new endpoints lack rate limiting. This is a pre-existing issue affecting all routes in the application, not specific to these new endpoints. Consider adding rate-limiting middleware to all API routes as a future enhancement.

## Future Enhancements

1. **Rate Limiting:** Add rate-limiting middleware to prevent abuse
2. **Caching:** Cache therapist and room lists to reduce database queries
3. **WebSocket Updates:** Real-time room occupancy updates using WebSockets
4. **Room Availability Calendar:** Visual calendar showing room availability
5. **Therapist Scheduling:** Integration with therapist schedules to show availability
6. **Multi-language Support:** Internationalization for labels and messages

## Files Modified

### Backend
- `backend/modules/timers/timer.controller.js` - Added getTherapists and getRooms
- `backend/modules/timers/timer.route.js` - Added routes for new endpoints
- `backend/modules/services/service.controller.js` - Added getByType
- `backend/modules/services/service.route.js` - Added route for by-type endpoint

### Frontend
- `frontend/src/components/StartTimerModal.vue` - Complete rewrite with API integration
- `frontend/src/views/kasir/KasirDashboard.vue` - Updated to use new data format

### Database
- `database/migrations/001_add_rooms_and_update_timers.sql` - Schema changes
- `database/migrations/README.md` - Migration documentation

### Other
- `.gitignore` - Added to exclude build artifacts and dependencies

## Frontend Deployment Instructions

To build and deploy frontend changes to the production server:

### 1. Build the Frontend
```bash
# Navigate to frontend directory
cd /home/numarsadmin/fullnumars/frontend

# Install dependencies (if needed) - run as root or with sudo
sudo -u numarsadmin npm install --no-audit --no-fund

# Build the production bundle - run as root or with sudo
sudo -u numarsadmin npm run build
```

### 2. Fix Ownership
```bash
# Ensure dist directory has correct ownership - run as root or with sudo
sudo chown -R numarsadmin:numarsadmin /home/numarsadmin/fullnumars/frontend/dist
```

### 3. Reload Nginx
```bash
# Reload nginx to pick up new files - run as root or with sudo
sudo systemctl reload nginx
```

### 4. Verify Deployment
```bash
# Clear browser cache and visit with cache-busting parameter
# Visit: http://your-server/kasir?v=<timestamp>
```

**Important Notes:**
- Commands above use `sudo -u numarsadmin` to run as the numarsadmin user (execute these as root or a user with sudo privileges)
- If you're already logged in as `numarsadmin`, omit the `sudo -u numarsadmin` prefix from npm commands
- Ensure the `dist` directory ownership is correct before reloading nginx
- Use cache-busting parameter (`?v=`) to force browser to load new bundle
- Check browser console for build tag: `__FRONTEND_BUILD__ v20260129-PR`
