// Jest setup file
import '@testing-library/jest-dom';

// Mock Firebase
jest.mock('./src/lib/firebase', () => ({
  auth: {},
  firestore: {},
  storage: {},
  functions: {},
}));

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
  usePathname: () => '',
}));
