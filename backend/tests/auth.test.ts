import request from "supertest";
import { createApp } from "../src/app";
import { User } from "../src/models/User";
import { hashPassword } from "../src/services/authService";
import { Types } from "mongoose";

const app = createApp();

describe("POST /api/v1/auth/login", () => {
  beforeEach(async () => {
    await User.create({
      orgId: new Types.ObjectId(),
      email: "test@deploywatch.dev",
      passwordHash: await hashPassword("password123"),
      name: "Test User",
      role: "sre",
    });
  });

  it("logs in with valid credentials and returns tokens", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "test@deploywatch.dev", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe("test@deploywatch.dev");
  });

  it("rejects invalid password", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "test@deploywatch.dev", password: "wrongpassword" });

    expect(res.status).toBe(401);
  });

  it("rejects malformed email with a validation error", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "not-an-email", password: "password123" });

    expect(res.status).toBe(422);
  });
});

describe("GET /api/v1/auth/me", () => {
  it("rejects requests with no token", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
  });
});
