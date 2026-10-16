import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from '../app';
import User from '../models/User';
import Booking from '../models/Booking';
import Service from '../models/Service';

jest.mock('../models/User', () => {
  const users: any[] = [];

  const MockUser: any = jest.fn().mockImplementation((data: any) => ({
    ...data,
    _id: 'user-123',
    save: jest.fn(async function (this: any) {
      users.push(this);
    }),
  }));

  MockUser.findOne = jest.fn(async ({ email }: any) =>
    users.find((u) => u.email === email) ?? null
  );

  MockUser.findById = jest.fn(async (id: string) =>
    users.find((u) => String(u._id) === String(id)) ?? null
  );

  MockUser.__users = users;

  return { __esModule: true, default: MockUser };
});

jest.mock('../models/Service', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));

jest.mock('../models/Booking', () => {
  const bookings: any[] = [];

  const MockBooking: any = jest.fn().mockImplementation((data: any) => ({
    ...data,
    _id: 'booking-123',
    status: 'booked',
    save: jest.fn(async function (this: any) {
      const existing = bookings.find(
        (b) => String(b._id) === String(this._id)
      );

      if (!existing) {
        bookings.push(this);
      }

      return this;
    }),
  }));

  MockBooking.find = jest.fn(async () => bookings);
  MockBooking.findById = jest.fn(async (id: string) =>
    bookings.find((b) => String(b._id) === String(id)) ?? null
  );

  MockBooking.__bookings = bookings;

  return { __esModule: true, default: MockBooking };
});

const MockUser = User as any;
const MockBooking = Booking as any;
const MockService = Service as any;

const email = 'aby.test@example.com';
const password = 'TestPassword123!';
const userId = 'user-123';

const bookingPayload = {
  salonId: 'salon-123',
  stylistId: 'stylist-123',
  serviceId: 'service-123',
  slotTime: '10:00',
  date: '2026-11-10',
};

let token: string;

beforeEach(async () => {
  MockUser.__users.length = 0;
  MockBooking.__bookings.length = 0;

  MockUser.findOne.mockClear();
  MockUser.findById.mockClear();
  MockUser.mockClear();

  MockBooking.find.mockClear();
  MockBooking.findById.mockClear();
  MockBooking.mockClear();

  MockService.findById.mockReset();

  token = jwt.sign(
    { userId, role: 'customer' },
    process.env.JWT_SECRET || 'supersecretjwtkey_12345',
    { expiresIn: '1h' }
  );

  // Register a test user for authenticated requests.
  MockUser.__users.push({
    _id: userId,
    name: 'Aby',
    email,
    password: await bcrypt.hash(password, 10),
    role: 'customer',
  });

  MockService.findById.mockResolvedValue({
    _id: 'service-123',
    duration: 30,
    price: 500,
  });
});

describe('Authentication API', () => {
  test('registers a new user', async () => {
    MockUser.__users.length = 0;

    const response = await request(app)
      .post('/api/register')
      .send({ name: 'New User', email: 'new@example.com', password });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('User registered successfully');
  });

  test('rejects an already registered email', async () => {
    const response = await request(app)
      .post('/api/register')
      .send({ name: 'Aby', email, password });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Email already in use');
  });

  test('logs in with valid credentials', async () => {
    const response = await request(app)
      .post('/api/login')
      .send({ email, password });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined();
    expect(response.body.role).toBe('customer');
    expect(response.body.userId).toBe(userId);
  });

  test('rejects an incorrect password', async () => {
    const response = await request(app)
      .post('/api/login')
      .send({ email, password: 'wrong-password' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid credentials');
  });
});

describe('Booking API', () => {
  test('rejects booking without an authentication token', async () => {
    const response = await request(app)
      .post('/api/bookings')
      .send(bookingPayload);

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authentication required');
  });

  test('rejects an invalid token', async () => {
    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', 'Bearer invalid-token')
      .send(bookingPayload);

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid token');
  });

  test('requires a booking date', async () => {
    const { date, ...payloadWithoutDate } = bookingPayload;

    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send(payloadWithoutDate);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('date is required');
  });

  test('rejects a nonexistent service', async () => {
    MockService.findById.mockResolvedValueOnce(null);

    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send(bookingPayload);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Service not found');
  });

  test('creates a booking and calculates its end time', async () => {
    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send(bookingPayload);

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Booking created successfully');
    expect(response.body.booking.startTime).toBe('10:00');
    expect(response.body.booking.endTime).toBe('10:30');
  });

  test('cancels a booking owned by the customer', async () => {
    const booking = {
      _id: 'booking-123',
      customerId: userId,
      status: 'booked',
      save: jest.fn(async function (this: any) {
        return this;
      }),
    };

    MockBooking.findById.mockResolvedValueOnce(booking);

    const response = await request(app)
      .post('/api/bookings/booking-123/cancel')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Booking cancelled successfully');
    expect(booking.status).toBe('cancelled');
    expect(booking.save).toHaveBeenCalled();
  });

  test('rejects cancellation by another customer', async () => {
    const booking = {
      _id: 'booking-123',
      customerId: 'another-user',
      status: 'booked',
      save: jest.fn(),
    };

    MockBooking.findById.mockResolvedValueOnce(booking);

    const response = await request(app)
      .post('/api/bookings/booking-123/cancel')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toBe(
      'Not authorized to cancel this booking'
    );
    expect(booking.save).not.toHaveBeenCalled();
  });
  
  test('returns 404 when the booking does not exist', async () => {
    MockBooking.findById.mockResolvedValueOnce(null);

    const response = await request(app)
      .post('/api/bookings/missing-booking/cancel')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Booking not found');
  });
});

describe('Additional edge cases', () => {
  test('rejects a booking that overlaps an existing booking', async () => {
    MockBooking.__bookings.push({
      _id: 'existing-booking',
      salonId: bookingPayload.salonId,
      stylistId: bookingPayload.stylistId,
      customerId: 'another-user',
      serviceId: bookingPayload.serviceId,
      date: bookingPayload.date,
      startTime: '10:15',
      endTime: '10:45',
      status: 'booked',
    });

    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send(bookingPayload);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Time slot is no longer available');
  });

  test('rejects a booking that has already been cancelled', async () => {
    MockBooking.findById.mockResolvedValueOnce({
      _id: 'booking-123',
      customerId: userId,
      status: 'cancelled',
      save: jest.fn(),
    });

    const response = await request(app)
      .post('/api/bookings/booking-123/cancel')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Booking is already cancelled');
  });

  test('rejects a validly signed token for a nonexistent user', async () => {
    const unknownUserToken = jwt.sign(
      { userId: 'unknown-user', role: 'customer' },
      process.env.JWT_SECRET || 'supersecretjwtkey_12345'
    );

    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${unknownUserToken}`)
      .send(bookingPayload);

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('User not found');
  });
});

describe('End-to-end booking workflow', () => {
  test('registers, logs in, creates a booking, and cancels it', async () => {
    const newEmail = `e2e-${Date.now()}@example.com`;
    const password = 'E2EPassword123!';

    // 1. Register
    const registerResponse = await request(app)
      .post('/api/register')
      .send({
        name: 'E2E Test User',
        email: newEmail,
        password,
      });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.message).toBe(
      'User registered successfully'
    );

    // 2. Login
    const loginResponse = await request(app)
      .post('/api/login')
      .send({ email: newEmail, password });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.token).toBeDefined();

    const authToken = loginResponse.body.token;

    // 3. Create booking
    const bookingResponse = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        salonId: 'salon-123',
        stylistId: 'stylist-123',
        serviceId: 'service-123',
        slotTime: '11:00',
        date: '2026-11-10',
      });

    expect(bookingResponse.status).toBe(201);
    expect(bookingResponse.body.booking.startTime).toBe('11:00');
    expect(bookingResponse.body.booking.endTime).toBe('11:30');

    const bookingId = bookingResponse.body.booking._id;

    // 4. Cancel booking
    const cancelResponse = await request(app)
      .post(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.body.message).toBe(
      'Booking cancelled successfully'
    );
  });
});

