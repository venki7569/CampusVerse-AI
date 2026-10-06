import type { Application } from 'express';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createApp } from '../../app';
import { createPrismaClient } from '../../database/prisma.client';
import { initializeMongoConnection } from '../../modules/database/mongodb/connection';
import { initAuthorizationService } from '../../modules/admin/authorization.service';

export interface LoginResult {
  accessToken: string;
  refreshToken?: string;
  user: { id: string; email: string; roles: string[] };
}

export class IntegrationHarness {
  readonly db: PrismaClient;
  readonly app: Application;

  constructor(db: PrismaClient, existingApp?: Application) {
    this.db = db;
    initAuthorizationService(db);
    this.app = existingApp ?? createApp(db);
  }

  static async create(): Promise<IntegrationHarness> {
    await initializeMongoConnection();
    const db = createPrismaClient();
    return new IntegrationHarness(db);
  }

  agent() {
    return request(this.app);
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const res = await this.agent()
      .post('/api/v1/auth/login')
      .send({ email, password });
    if (res.status !== 200) {
      throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return {
      accessToken: res.body.data.tokens.accessToken,
      refreshToken: res.body.data.tokens.refreshToken,
      user: res.body.data.user,
    };
  }

  authGet(token: string, path: string) {
    return this.agent().get(path).set('Authorization', `Bearer ${token}`);
  }

  authPost(token: string, path: string, body?: unknown) {
    return this.agent().post(path).set('Authorization', `Bearer ${token}`).send(body ?? {});
  }

  authPatch(token: string, path: string, body?: unknown) {
    return this.agent().patch(path).set('Authorization', `Bearer ${token}`).send(body ?? {});
  }
}
