# Salon Backend API Automation

## Overview
Jest and Supertest API tests for a Salon Booking backend built with Express, TypeScript, and Mongoose.

## Requirements
- Node.js 18 or compatible
- npm

## Installation
Run `npm install` from the project root.

## Environment Variables
Create a `.env` file if required by your local server:
- `PORT`
- `JWT_SECRET`
- `MONGO_URI`

Never commit real credentials or secrets.

## Running Tests
Run `npm test` to execute the Jest suite.
Run `npm run build` to compile the TypeScript project.

## Endpoints Covered
- POST /api/register
- POST /api/login
- POST /api/bookings
- POST /api/bookings/:bookingId/cancel

## Test Coverage
The suite covers registration, duplicate email, login, invalid credentials, missing and invalid tokens, booking validation, missing services, booking creation, overlapping bookings, cancellation, unauthorized cancellation, missing bookings, repeated cancellation, and tokens for nonexistent users.

## Testing Approach and Limitations
Jest runs the tests and Supertest sends requests through the Express application. Mongoose models are mocked, so a running MongoDB server is not required for this test suite. The tests validate API route, middleware, and controller behavior but do not verify persistence against a real MongoDB database.

## Assumptions
- API routes use the `/api` prefix.
- Protected endpoints require a Bearer JWT.
- The application's default JWT secret is for development only and should not be used in production.

## Jest Configuration and Test Setup
- Jest configuration is defined in `jest.config.js`.
- Tests are written in TypeScript and run using `ts-jest`.
- Supertest sends requests to the Express app without requiring a separate server process.
- The test suite mocks Mongoose models; therefore, no database setup or teardown is required for the current tests.
- Test data is created within the test suite, and mocked state should be reset between tests where necessary.
- The application server uses `index.ts`; the test suite imports the Express app from `app.ts`.

## Dependencies
Main dependencies include Express, Mongoose, JSON Web Token, bcryptjs, and dotenv. Development dependencies include Jest, ts-jest, Supertest, TypeScript, and their type definitions.

## Limitations
These tests validate API behavior with mocked models. They do not validate actual database persistence, MongoDB connectivity, or database-level constraints.
