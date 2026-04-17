# iF Fleet — User Guide

This guide covers all three roles in the iF Fleet platform: **Admin**, **Driver**, and **Employee**. Each section is self-contained — share only the relevant section with each user group.

---

## Table of Contents

- [Getting Started — All Roles](#getting-started--all-roles)
- [Employee Guide](#employee-guide)
- [Driver Guide](#driver-guide)
- [Admin Guide](#admin-guide)
- [Frequently Asked Questions](#frequently-asked-questions)

---

## Getting Started — All Roles

### Accessing the App

| Surface | URL / Download |
|---------|---------------|
| Web App | `https://fleet.yourcompany.com` |
| Mobile App | Distributed via EAS / internal TestFlight or Play Store link |

### Login Methods

#### Email OTP (Employees & Admins)

1. Open the app and select the **Email OTP** tab on the login screen.
2. Enter your **company email address** (e.g., `yourname@yourcompany.com`).
3. Tap **Send OTP** — a 6-digit code is emailed to you (valid for 10 minutes).
4. Enter the code and tap **Sign In**.

> If you do not receive the OTP within 2 minutes, check your spam folder. The code expires after 10 minutes and allows up to 5 attempts.

#### Driver PIN (Drivers — Mobile Only)

1. Open the mobile app and select the **Driver PIN** tab.
2. Enter your **registered mobile number** (e.g., `+919876543210`).
3. Tap **Continue**, then enter your **6-digit PIN**.
4. Tap **Sign In**.

> On first login, you will be required to change your PIN immediately. Your admin sets the initial PIN when creating your driver profile.

### Profile Completion

New accounts are prompted to complete their profile (name, department, etc.) on first login. This is a one-time step.

### Session Management

Access tokens expire after 15 minutes. The app automatically refreshes your session in the background — you will not normally be logged out. If your refresh token expires (after 30 days of inactivity) you will be redirected to the login screen.

---

## Employee Guide

Employees can **submit transport requests**, **track their active bookings**, and **view booking history** from both the web app and mobile app.

### Mobile App — Tab Structure

| Tab | Purpose |
|-----|---------|
| **Home** | Dashboard showing your recent and active bookings |
| **Book** | Submit a new transport request (4-step wizard) |
| **Track** | Live status of your active bookings |
| **History** | All completed, cancelled, and rejected bookings |
| **Profile** | Your account details |

---

### Submitting a Booking (Mobile — 4 Steps)

#### Step 1 — Transport Type

Choose what you need to transport:

| Option | Use When |
|--------|---------|
| **Person** | You and/or other passengers need a ride |
| **Person + Material** | Passengers plus cargo/equipment |
| **Material Only** | Cargo/equipment with no passengers |

- For **Person** bookings: enter the number of passengers.
- For **Material** bookings: enter a brief description of the material.

Tap **Next** to proceed.

#### Step 2 — Pickup, Drop & Time

**Pickup Location**
- Choose from the preset location list (office buildings, depots, field sites) **or** tap **Other** to type a custom address.

**Dropoff Location**
- Same process as pickup.

**Date & Time**
- Use the date/time picker to select your departure time.
- Quick shortcuts: **+1h**, **+2h**, **+4h**, **+8h** add that offset from the current time.

Tap **Next** when done.

#### Step 3 — Available Vehicles

This screen shows fleet-assigned vehicles whose drivers are currently located at your selected pickup point.

- **Select a vehicle** by tapping a card — it highlights in blue. Each card shows:
  - Vehicle type and registration number
  - Driver name and contact number
  - Driver's current location
- **No Preference** (always shown at the top) — proceeds without reserving a specific vehicle; the admin will assign one later.
- If **no vehicles are available** at your pickup location, you will see an informational message. Tap **Continue without vehicle selection** to still submit your request.

> Selecting a preferred vehicle does not guarantee that vehicle — it is a preference that the admin can honour or override during assignment.

Tap **Next**.

#### Step 4 — Review & Submit

Review your complete booking summary:
- Transport type and passenger/material details
- Pickup and dropoff locations
- Requested date and time
- Preferred vehicle and driver (if selected)

Tap **Submit Booking** to send the request.

**What happens next?**
- If your organisation uses **Manual Approval**: your booking shows as *Pending Approval* until an admin reviews it.
- If **Auto Approval** is enabled: your booking is immediately *Approved* (or *Assigned* if you selected a preferred vehicle).

---

### Submitting a Booking (Web App)

The web booking form mirrors the mobile 4-step process on a single scrollable page divided into sections. Fill in each section and click **Submit Booking**.

---

### Tracking Your Booking (Mobile — Track Tab)

The **Track** tab shows all your active bookings (status: Approved, Assigned, or In Trip).

| Booking Status | What It Means |
|---------------|--------------|
| **Pending Approval** | Waiting for admin review |
| **Approved** | Approved; admin is arranging a driver and vehicle |
| **Assigned** | Driver and vehicle confirmed; driver has accepted |
| **In Trip** | Your driver is currently on the way or trip is in progress |
| **Completed** | Trip finished successfully |
| **Cancelled** | Booking was cancelled (by you or admin) |
| **Rejected** | Admin rejected the request (reason shown) |

For **In Trip** bookings, you can see:
- Vehicle registration number
- Driver name and mobile number
- Driver's last known location

---

### Cancelling a Booking

You can cancel a booking that is in **Pending Approval**, **Approved**, or **Assigned** status.

**Mobile:**
1. Go to **Home** or **Track** tab.
2. Tap the booking card.
3. Tap **Cancel Booking** and confirm.

**Web:**
1. Go to **My Bookings**.
2. Click the booking row.
3. Click **Cancel** and confirm.

> Bookings cannot be cancelled once the trip has started (status: In Trip or Completed).

---

### Booking History

The **History** tab (mobile) or **My Bookings** page (web) shows all your past bookings with their final status, assigned driver/vehicle, and trip details.

---

## Driver Guide

Drivers manage their fleet vehicle assignment, set their current location, accept or decline trip assignments, and execute trips — all from the mobile app.

### Mobile App — Tab Structure

| Tab | Purpose |
|-----|---------|
| **Home** | Active assignment cards and quick actions |
| **Fleet** | Your assigned vehicle and location management |
| **Track** | Active trip controls (start, complete, fuel log) |
| **History** | Completed and past trips |
| **Alerts** | In-app notifications |
| **Profile** | Your account and PIN management |

---

### Fleet Tab — Managing Your Vehicle

#### Viewing Your Assigned Vehicle

When an admin assigns you to a vehicle, you receive an in-app alert (Alerts tab) and the **Fleet** tab shows:
- Vehicle registration number, type, make and model
- Your current set location (or a warning if location not set)

#### Setting Your Current Location

Your location must be set before you appear as **available** in the employee booking flow.

1. Go to **Fleet** tab.
2. Tap **Set My Location**.
3. Choose from the **preset location list** (office, depot, field site) **or** enter a **custom address**.
4. Tap **Save Location**.

Your location is now visible to employees booking from that preset location.

> Update your location whenever you move to a different site. This ensures employees at the correct location can see you as available.

#### Self-Assigning a Vehicle (when admin has not pre-assigned)

If no vehicle has been assigned to you by the admin:

1. Go to **Fleet** tab.
2. Tap **Take a Vehicle**.
3. Select an available vehicle from the list.
4. Tap **Confirm**.

> You must be **shift-ready** (toggled on by your admin) to self-assign a vehicle.

#### Leaving a Vehicle

When you are done with a shift or need to release the vehicle:

1. Go to **Fleet** tab.
2. Tap **Leave Vehicle**.
3. Confirm the release.

The vehicle returns to **Available** status and can be reassigned.

> You cannot leave a vehicle while a trip is active (In Trip status). Complete or cancel the trip first.

---

### Home Tab — Managing Assignments

When a booking is assigned to you (or your vehicle via the preferred-vehicle flow), a card appears on your **Home** tab.

Each assignment card shows:
- Booking reference number
- Requester name
- Pickup and dropoff locations
- Requested date and time
- Transport type

#### Accepting an Assignment

Tap **Accept** on the assignment card. The booking moves to **Assigned** status and the employee is notified.

#### Declining an Assignment

Tap **Decline**, enter a reason, and confirm. The vehicle is freed and the admin is notified to reassign.

#### Cancelling an Accepted Assignment

If you have accepted but need to cancel before the trip starts:

1. Tap the assignment card.
2. Tap **Cancel Assignment**.
3. Enter a reason and confirm.

The booking returns to admin queue for reassignment.

---

### Track Tab — Executing a Trip

Once you have accepted an assignment and are ready to depart:

#### Starting a Trip

1. Go to **Track** tab.
2. Tap **Start Trip**.
3. Enter the **starting odometer reading** (optional — leave blank if not applicable).
4. Tap **Confirm Start**.

The booking status changes to **In Trip** and the vehicle status changes to **In Trip**.

#### During the Trip

The Track tab shows:
- Trip duration (live timer)
- Current booking and route details
- Quick access to the fuel log

#### Logging Fuel

Fuel logs are optional — add one if you refuel during the trip.

1. Tap **Add Fuel Log** on the Track tab.
2. Enter: fuel volume (litres), cost (optional), current odometer reading (optional).
3. Add receipt reference if required.
4. Tap **Save**.

#### Completing a Trip

1. Tap **Complete Trip** on the Track tab.
2. Enter the **ending odometer reading** (optional — leave blank if not applicable).
3. Add any remarks (optional).
4. Tap **Confirm Complete**.

The vehicle returns to **Assigned** status (still linked to you at fleet level). The booking moves to **Completed**.

---

### Alerts Tab — Notifications

All in-app notifications appear here:
- Vehicle assignment by admin
- New booking assigned to your vehicle (preferred-vehicle bookings)
- System announcements

- **Unread** notifications are highlighted.
- Tap a notification to mark it as read.
- The badge count on the tab icon shows unread count.

---

### Changing Your PIN

1. Go to **Profile** tab.
2. Tap **Change PIN**.
3. Enter your current PIN, new PIN, and confirm new PIN.
4. Tap **Set New PIN**.

PIN requirements: 6 digits, no all-same digits (e.g., `111111`), no simple sequences (e.g., `123456`).

---

## Admin Guide

Admins have full visibility and control over the entire fleet — approvals, assignments, master data, reports, and settings — from both the web app and mobile app.

### Web App — Navigation

| Section | Purpose |
|---------|---------|
| **Dashboard** | KPI tiles, quick actions, recent activity |
| **Booking Queue** | Pending approval requests |
| **Fleet Map** | Live fleet status (vehicle, driver, location) |
| **Fleet Master** | Vehicle and driver master data |
| **Users** | User management |
| **Reports** | Trip history, utilisation, fuel |
| **Settings** | Approval mode, session timeout, SMTP, company config |

### Mobile App — Tab Structure (7 Tabs)

| Tab | Purpose |
|-----|---------|
| **Home** | Dashboard stats and quick actions |
| **Book** | Booking approval queue |
| **Fleet** | Fleet Master — vehicle/driver assignment |
| **Track** | Live fleet map with driver locations |
| **History** | Completed booking and trip history |
| **Admin** | App settings |
| **Profile** | Account details |

---

### Managing Users

#### Creating a User Account

1. Go to **Users** (web) or **Admin > Users** (mobile).
2. Click/tap **Add User**.
3. Fill in: First Name, Last Name, Company Email, Employee ID, Department, Role (Employee / Driver / Admin).
4. Save.

The user receives an email and can log in via OTP on first access.

#### Suspending / Activating a User

1. Find the user in the Users list.
2. Click **Suspend** or **Activate** as needed.

Suspended users cannot log in.

---

### Fleet Master — Vehicles

#### Adding a Vehicle

1. Go to **Fleet Master** (web) or **Fleet** tab (mobile).
2. Click **Add Vehicle**.
3. Fill in: Registration Number, Type, Make, Model, Year, Capacity, Ownership (Owned / Leased / Hired).
4. Optionally set Maintenance Due date.
5. Save.

#### Editing a Vehicle

Click the vehicle row, update fields, and save.

#### Vehicle Statuses

| Status | Meaning |
|--------|---------|
| **Available** | No driver assigned, free to assign |
| **Assigned** | Driver assigned (fleet level) or booking assigned |
| **In Trip** | Currently on an active trip — cannot reassign |
| **Maintenance** | Under maintenance, unavailable for bookings |
| **Inactive** | Retired/decommissioned |

#### Assigning a Driver to a Vehicle (Fleet Level)

This is the permanent fleet-level assignment — separate from booking assignment.

1. In Fleet Master, find the vehicle row.
2. Click **Assign Driver**.
3. Select a driver from the dropdown (only **shift-ready** drivers are shown).
4. Confirm.

The driver receives an in-app notification: *"You have been assigned to vehicle [reg]. Please set your current location."*

> A vehicle can only have one fleet-assigned driver at a time. You must unassign the current driver before assigning a new one.

#### Unassigning a Driver from a Vehicle

1. Find the vehicle row (must not be **In Trip**).
2. Click **Unassign**.
3. Confirm.

The vehicle returns to **Available** status.

#### Current Location Column

The Fleet Master table shows each vehicle's current location (the vehicle's own location record, which is always kept in sync):
- If the vehicle has a preset location set → shows the preset name
- If a custom address was entered → shows that address
- If no location has been set yet → shows `—`

Location is updated automatically when: the assigned driver updates their location, a trip starts (set to pickup point), or a trip ends (set to dropoff point).

#### Setting a Vehicle's Location (Admin — Unassigned Vehicles Only)

For vehicles with **no fleet-assigned driver** that are not `ASSIGNED` or `In Trip`:

1. Find the vehicle row in Fleet Master.
2. Click **Set Location** (appears only when eligible).
3. Choose a preset location from the dropdown, or enter a custom address.
4. Click **Save**.

> This option is hidden when a driver is assigned to the vehicle — in that case, location is managed by the driver from the Fleet tab.

---

### Fleet Master — Drivers

#### Creating a Driver Profile

A user must exist before a driver profile can be created.

1. Go to **Fleet Master > Drivers**.
2. Click **Add Driver**.
3. Select the existing user from the dropdown.
4. Enter: License Number, License Expiry, initial PIN.
5. Toggle **Shift Ready** on if the driver is active.
6. Save.

The user's role is automatically upgraded to **Driver**.

#### Toggling Shift Ready

Drivers must be **shift-ready** to accept self-assignments and appear in admin assignment dropdowns.

1. Find the driver in the Drivers list.
2. Toggle **Shift Ready** on or off.

#### Resetting a Driver PIN

1. Find the driver.
2. Click **Reset PIN**.
3. Enter a temporary 6-digit PIN.
4. Save.

The driver will be forced to change the PIN on their next login.

---

### Booking Management

#### Approval Queue

The **Book** tab / **Booking Queue** page shows all bookings in **Pending Approval** status.

Each row shows:
- Booking number and requester name
- Transport type and passenger/material details
- Pickup → Dropoff route
- Requested date and time
- Preferred vehicle (if selected by employee)

**To Approve:**
1. Click/tap the booking.
2. Click **Approve**.

The booking moves to **Approved** (or directly to **Assigned** if a preferred vehicle was selected and has a fleet-assigned driver).

**To Reject:**
1. Click the booking.
2. Click **Reject**, enter a reason, and confirm.

The employee sees the rejection reason on their booking.

#### Assigning a Vehicle and Driver (Manual Assignment)

For **Approved** bookings without an assignment:

1. Click the booking in the queue.
2. Click **Assign**.
3. Select a **Vehicle** — the dropdown shows `AVAILABLE` vehicles plus `ASSIGNED` vehicles that have no conflicting active booking, filtered to the booking's pickup location. Each option shows the vehicle's current location.
4. Select a **Driver** (only shift-ready drivers shown).
5. Confirm.

> Cross-validation rules:
> - If the vehicle has a fleet-assigned driver, that driver must be used (or unassign them first).
> - If the driver is fleet-assigned to a different vehicle, they cannot be assigned to another vehicle's booking.

The driver receives an assignment notification and must Accept or Decline.

#### Reassigning a Booking

If a driver declines or cancels an accepted assignment:

1. Find the booking (status remains **Assigned**, assignment decision: **Declined**).
2. Click **Reassign**.
3. Select a new vehicle and/or driver.
4. Confirm.

The new driver receives the assignment notification.

#### Cancelling a Booking (Admin)

Admins can cancel any booking in Pending Approval, Approved, or Assigned state.

1. Find the booking.
2. Click **Cancel** and confirm.

---

### Approval Mode Settings

#### Switching Between Manual and Auto Approval

1. Go to **Settings** (web) or **Admin** tab (mobile).
2. Find **Approval Mode**.
3. Toggle between **Manual** and **Auto**.

| Mode | Behaviour |
|------|-----------|
| **Manual** | Every booking waits in the Pending Approval queue |
| **Auto** | Bookings are immediately approved; preferred-vehicle bookings jump to Assigned |

---

### Live Fleet Map (Web)

The **Fleet Map** page shows all active vehicles on a map:
- Vehicle pins coloured by status (green = Available, orange = Assigned, red = In Trip)
- Click a pin to see vehicle number, driver name, and last location

---

### Reports (Web)

The **Reports** section provides:
- **Trip History** — all completed trips with odometer readings and duration
- **Fuel Logs** — refuelling records per vehicle/trip
- **Booking Summary** — counts by status, transport type, requester

Export options are available for CSV download.

---

## Frequently Asked Questions

**Q: I didn't receive my OTP.**
A: Check your spam/junk folder. OTPs expire after 10 minutes. If still missing, ensure you are using your registered company email address.

**Q: My session expired mid-use.**
A: The app automatically refreshes your session. If you are logged out, your refresh token has expired (after 30 days of inactivity) — log in again.

**Q: I selected a preferred vehicle but got a different one assigned.**
A: Preferred vehicle is a preference, not a guarantee. The admin may assign a different vehicle based on operational needs.

**Q: I can't see any vehicles on the Available Vehicles screen.**
A: Vehicles only appear if a fleet-assigned driver has set their current location to match your pickup preset. Try selecting "No Preference" or contact admin.

**Q: I accidentally accepted an assignment I can't fulfil.**
A: Go to Home tab → assignment card → Cancel Assignment. Enter a reason. The booking returns to admin for reassignment.

**Q: I can't leave my vehicle.**
A: You cannot leave a vehicle while a trip is active. Complete or cancel the active trip first.

**Q: The Complete Trip button gives an error.**
A: Ensure your internet connection is stable — the app will retry automatically once connected. Odometer readings are optional, so leaving them blank is fine. If the error persists, check the Alerts tab for a system message or contact your admin.

**Q: As admin, the "Assign Driver" dropdown is empty.**
A: Only drivers with **Shift Ready = On** and no existing vehicle assignment appear. Check the driver's shift-ready status in Fleet Master.

**Q: Can an employee cancel a booking after the trip has started?**
A: No. Cancellation is only available in Pending Approval, Approved, and Assigned states.
