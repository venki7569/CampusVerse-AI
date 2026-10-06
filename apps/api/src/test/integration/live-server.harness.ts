import http from 'http';
import type { AddressInfo } from 'net';
import type { Application } from 'express';
import type { PrismaClient } from '@prisma/client';
import { createApp } from '../../app';
import { createPrismaClient } from '../../database/prisma.client';
import { initializeMongoConnection } from '../../modules/database/mongodb/connection';
import { initSocketServer, shutdownSocketServer } from '../../modules/realtime/socket.server';
import { registerEventBridge } from '../../modules/realtime/event-bridge';
import { connectRedis, disconnectRedis } from '../../services/redis.service';
import { IntegrationHarness, type LoginResult } from './harness';

/**
 * Live HTTP + Socket.IO harness for Phase 24 integration verification.
 */
export class LiveServerHarness extends IntegrationHarness {
  readonly httpServer: http.Server;
  readonly baseUrl: string;
  readonly socketPath: string;

  private constructor(db: PrismaClient, app: Application, httpServer: http.Server, port: number) {
    super(db, app);
    this.httpServer = httpServer;
    this.baseUrl = `http://127.0.0.1:${port}`;
    this.socketPath = process.env['SOCKET_PATH'] ?? '/socket.io';
  }

  static async create(): Promise<LiveServerHarness> {
    await initializeMongoConnection();
    await connectRedis();
    const db = createPrismaClient();
    const app = createApp(db);
    const httpServer = http.createServer(app);
    initSocketServer(httpServer);
    registerEventBridge();

    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => resolve());
    });

    const port = (httpServer.address() as AddressInfo).port;
    return new LiveServerHarness(db, app, httpServer, port);
  }

  async shutdown(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.httpServer.close((err) => (err ? reject(err) : resolve()));
    });
    await shutdownSocketServer();
    await disconnectRedis();
  }

  socketUrl(): string {
    return this.baseUrl;
  }

  async login(email: string, password: string): Promise<LoginResult> {
    return super.login(email, password);
  }
}
