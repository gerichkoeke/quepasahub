import request from 'supertest';
import app from '../index';

describe('Health Endpoints', () => {
  it('GET /health should return health status', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('ok');
    expect(response.body).toHaveProperty('db');
    expect(response.body).toHaveProperty('time');
  });
});
