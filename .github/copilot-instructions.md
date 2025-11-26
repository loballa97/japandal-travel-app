# JAPANDAL Copilot Instructions

AI agents should understand the following about this codebase:

## Project Overview
**JAPANDAL** is an intelligent travel companion app built with Next.js 14, Firebase, and Google Maps integration. It supports multiple user roles (customer, driver, manager, admin) with role-based access control. The app handles ride reservations, driver management, payment processing (Stripe), and real-time location tracking.

## Architecture & Data Flow

### Tech Stack
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, TailwindCSS
- **Backend**: Firebase (Auth, Firestore, Cloud Functions, Storage)
- **AI**: Genkit with Google AI (Gemini 2.0 Flash)
- **Payments**: Stripe integration via `@stripe/react-stripe-js`
- **Maps**: Google Maps API (`@react-google-maps/api` with places & routes libraries)
- **UI**: Radix UI + shadcn/ui components
- **Forms**: React Hook Form + Zod validation

### Key Directory Structure
- `src/app/` - Next.js pages/routes (use `"use client"` for interactivity)
- `src/components/` - Reusable UI components and feature components
- `src/contexts/` - Global state: `AuthContext` (user/auth), `GoogleMapsContext` (maps loading)
- `src/lib/` - Firebase initialization, utility functions, role mappings
- `src/types/` - TypeScript interfaces, especially `firestore.ts` for document schemas
- `src/ai/` - Genkit AI flow definitions
- `dataconnect/` - Firebase Data Connect schemas and mutations

### Critical Initialization Pattern
The app uses a **two-tier provider setup** in `src/app/layout.tsx` (Server Component) → `AppProviders.tsx` (Client Component):
1. **AppProviders** wraps with: `ThemeProvider` → `AuthProvider` → `GoogleMapsProvider` → `Elements` (Stripe) → `PwaRegistry` + `Toaster`
2. All Stripe, Google Maps, and authentication initialization happens in `AppProviders`
3. **Never** add `"use client"` to `layout.tsx` - this breaks SSR and metadata

### Authentication Flow
- Firebase Auth handles user state via `onAuthStateChanged()` listener in `AuthContext`
- User roles stored in Firestore at `/userProfiles/{userId}` with `role` field
- Helper functions in `firestore.rules`: `isOwner()`, `getRole()`, `isAdmin()`, `isManager()`
- Always check `useAuth()` hook for current user before rendering protected content

### Firestore Security Model
- **Admins/Sub-admins**: Full read/write access to most collections
- **Managers**: Can read all reservations and driver info
- **Users**: Can only read/write their own documents (unless allowed by rules)
- **Drivers**: Can update their own driver profile; can update reservations they're assigned to
- Key collections: `userProfiles`, `reservations`, `drivers`, `driverTipsAndAnnouncements`, `adminActionLogs`

## Development Workflows

### Getting Started
```bash
npm install
npm run dev          # Run on http://localhost:3000
npm run build        # Build for production
npm start            # Start production server
npm run lint         # Run ESLint (currently ignores build errors/warnings)
```

### Environment Variables (`.env.local` required)
```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=...
```

### Build & Deployment
- **TypeScript**: Strict mode enabled; `ignoreBuildErrors: true` in `next.config.js` for compatibility
- **ESLint**: Currently set to ignore during builds (see `next.config.js`)
- **Recommended hosting**: Vercel (Next.js native) or Firebase Hosting with Cloud Functions
- **Firebase setup**: See `firebase.json` for Firestore location (eur3) and Functions config
- **Webpack config**: Server-side OpenTelemetry instrumentation excluded to prevent issues

## Project-Specific Patterns & Conventions

### Component Patterns
- **UI Components** in `src/components/ui/` use Radix UI + TailwindCSS (use `cn()` utility for merging classes)
- **Feature Components** use `"use client"` when needing hooks (AuthContext, useToast, etc.)
- **TypeScript required**: All components fully typed; no `any` without justification
- **Client vs Server**: Minimize `"use client"` usage; keep layouts and providers SSR-safe

### Form Handling
- Use **React Hook Form** with **Zod** for validation (see `LocationInputForm.tsx` pattern)
- Define validation schemas with Zod, then use `useForm()` hook
- Export form data types as `z.infer<typeof formSchema>` for type safety

### Role & Permission Management
- Import role utilities from `src/lib/roles.ts`: `ROLE_DISPLAY_NAMES`, `ROLE_COLORS`
- Always check roles server-side (Firestore rules) and client-side (for UI decisions only)
- Never trust client-side role checks for security-sensitive operations

### Styling Approach
- **TailwindCSS** with custom theme extending HSL CSS variables (see `tailwind.config.ts`)
- Color system: `primary`, `secondary`, `accent`, `destructive`, `muted`, `sidebar`, etc.
- Fonts: `font-body` (PT Sans), `font-headline` (Poppins)
- Dark mode: Handled via `ThemeProvider` (next-themes) with `class` strategy

### Google Maps Integration
- Maps API loaded once via `GoogleMapsContext` with libraries: `['places', 'routes']`
- Use `useGoogleMaps()` hook to check if maps loaded before rendering
- Key components: `MapView.tsx`, `LocationInputForm.tsx`, `LiveDriversMap.tsx` (admin)

### Payment Processing
- Stripe loaded via `getStripe()` singleton in `AppProviders`
- Wrap payment UI in `<Elements stripe={stripe}>` for access to Stripe context
- If Stripe key missing, component gracefully renders without payment UI

### AI/Genkit Integration
- Genkit model: `googleai/gemini-2.0-flash`
- Flows defined in `src/ai/flows/` (e.g., `real-time-update.ts`)
- Use `ai.run()` to invoke flows; always handle async properly

### Error Handling
- Use toast notifications from `use-toast` hook for user feedback (see `AuthContext.tsx`)
- Console logging present in service worker and some components (OK for now per audit)
- Firestore errors should be caught and displayed via toast, never silently ignored

### PWA & Service Worker
- Service worker at `public/sw.js`; registered via `PwaRegistry.tsx`
- Manifest at `public/manifest.json` with theme color `#4ECDC4`
- Cache strategy includes offline page fallback (see sw.js caching logic)

## Testing & Quality

### Current State
- **No unit tests** currently set up; consider adding Jest + React Testing Library if testing is needed
- **TypeScript strict mode**: Enabled; violations will fail builds (unless ignored)
- **Linting**: ESLint configured but not strictly enforced during build
- **Audit logs**: Tracked in `audit_logs/` (auto-generated inspection reports)

### Code Quality Checks
- Run `npm run lint` to check for violations
- Watch for console.log statements (intentional in sw.js and PwaRegistry)
- Firestore rule changes should be tested with emulator before deployment

## Common Tasks & Examples

### Adding a New Page
1. Create file at `src/app/{path}/page.tsx`
2. Use `"use client"` if needing auth or hooks
3. Import `useAuth()` and check loading state before rendering protected content
4. Example in `src/app/page.tsx`

### Adding a Protected Component
1. Import `useAuth()` from `AuthContext`
2. Check `user` and `loading` state
3. Render content conditionally (handle loading spinner)
4. See `src/app/profile/page.tsx` pattern

### Querying Firestore
1. Import from Firebase: `getDoc()`, `collection()`, `query()`, `where()`, etc.
2. Always handle async with try/catch and display errors via toast
3. Security rules enforce client-side filtering; server-side rules apply on read/write
4. Use Firestore indexes for complex queries (defined in `firestore.indexes.json`)

### Adding a Radix UI Component
1. Check `src/components/ui/` for existing components
2. If not exists, copy from shadcn/ui registry, adjust as needed
3. Import and use in feature components with TailwindCSS classes
4. Example: `Button`, `Dialog`, `Dropdown`, `Toast`

## Known Constraints & Technical Debt
- **Build errors ignored**: `ignoreBuildErrors: true` for compatibility (review before production)
- **Linting lenient**: ESLint warnings not enforced; should tighten for quality
- **Firestore rules manually reviewed**: Auto-updated during deep-clean; verify against actual data model
- **No error boundary**: Consider adding React error boundary for graceful error handling
- **Limited logging**: Service worker has console.log; consider structured logging for production
- **Fallback Firebase config**: Used if env vars missing (development only; never in production)

## External Resources & Dependencies
- [Firebase JS SDK Docs](https://firebase.google.com/docs/reference/js)
- [Next.js 14 Docs](https://nextjs.org/docs)
- [TailwindCSS](https://tailwindcss.com)
- [Radix UI](https://radix-ui.com)
- [React Hook Form](https://react-hook-form.com)
- [Zod Validation](https://zod.dev)
- [Genkit Docs](https://firebase.google.com/docs/genkit)
