import { Request } from 'express';

export interface AuthPayload {
  userId: string;
  email: string;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

export interface ESIOSPrice {
  date: string;
  value: number;
  geo_id: number;
}

export interface BestOffer {
  provider: string;
  costPerKwh: number;
  estimatedMonthly: number;
  savings: number;
}
