import { Request } from 'express';
import { AuthContext } from './auth-context';

export type RequestWithAuth = Request & {
  auth?: AuthContext;
  rawBody?: Buffer;
};
