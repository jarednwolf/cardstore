/**
 * Shared authentication types and interfaces
 * Used across all authentication services and implementations
 */

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
  session?: AuthSession;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface SignUpData {
  email: string;
  password: string;
  fullName?: string;
  tenantName?: string;
  tenantSubdomain?: string;
  metadata?: Record<string, any>;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'manager' | 'staff' | 'fulfillment' | 'admin';
  tenantId: string;
  lastLoginAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthServiceInterface {
  signUp(data: SignUpData): Promise<AuthResult>;
  signIn(data: SignInData): Promise<AuthResult>;
  signOut(accessToken?: string): Promise<{ success: boolean; error?: string }>;
  refreshToken(refreshToken: string): Promise<AuthResult>;
  verifyToken(accessToken: string): Promise<User | null>;
  getUserById(userId: string): Promise<User | null>;
}

export interface TenantInvitationResult {
  success: boolean;
  token?: string;
  error?: string;
}