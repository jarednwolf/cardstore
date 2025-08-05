/**
 * Authentication Service Tests
 * Tests for the authentication system including both Supabase and dev auth services
 */

import { devAuthService } from '../services/devAuthService';
import { AuthResult, SignUpData, SignInData } from '../types/auth';

describe('Authentication Service', () => {
  describe('DevAuthService', () => {
    const testUser: SignUpData = {
      email: 'test@example.com',
      password: 'testpassword123',
      fullName: 'Test User',
      tenantName: 'Test Company'
    };

    const adminUser: SignInData = {
      email: 'admin@deckstack.com',
      password: 'admin123'
    };

    test('should sign up a new user', async () => {
      const result: AuthResult = await devAuthService.signUp(testUser);
      
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe(testUser.email);
      expect(result.user?.name).toBe(testUser.fullName);
      expect(result.session).toBeDefined();
      expect(result.session?.access_token).toBeDefined();
      expect(result.session?.refresh_token).toBeDefined();
    });

    test('should not allow duplicate user signup', async () => {
      // Try to sign up the same user again
      const result: AuthResult = await devAuthService.signUp(testUser);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('User already exists');
    });

    test('should sign in with valid credentials', async () => {
      const result: AuthResult = await devAuthService.signIn(adminUser);
      
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe(adminUser.email);
      expect(result.session).toBeDefined();
    });

    test('should fail sign in with invalid credentials', async () => {
      const invalidUser: SignInData = {
        email: 'admin@deckstack.com',
        password: 'wrongpassword'
      };
      
      const result: AuthResult = await devAuthService.signIn(invalidUser);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    test('should verify valid token', async () => {
      // First sign in to get a token
      const signInResult = await devAuthService.signIn(adminUser);
      expect(signInResult.success).toBe(true);
      expect(signInResult.session?.access_token).toBeDefined();
      
      // Then verify the token
      const user = await devAuthService.verifyToken(signInResult.session!.access_token);
      
      expect(user).toBeDefined();
      expect(user?.email).toBe(adminUser.email);
    });

    test('should fail to verify invalid token', async () => {
      const user = await devAuthService.verifyToken('invalid-token');
      
      expect(user).toBeNull();
    });

    test('should get user by ID', async () => {
      // First sign in to get user data
      const signInResult = await devAuthService.signIn(adminUser);
      expect(signInResult.success).toBe(true);
      expect(signInResult.user?.id).toBeDefined();
      
      // Then get user by ID
      const user = await devAuthService.getUserById(signInResult.user!.id);
      
      expect(user).toBeDefined();
      expect(user?.email).toBe(adminUser.email);
    });

    test('should sign out successfully', async () => {
      const result = await devAuthService.signOut();
      
      expect(result.success).toBe(true);
    });

    test('should refresh token', async () => {
      // First sign in to get tokens
      const signInResult = await devAuthService.signIn(adminUser);
      expect(signInResult.success).toBe(true);
      expect(signInResult.session?.refresh_token).toBeDefined();
      
      // Then refresh the token
      const refreshResult = await devAuthService.refreshToken(signInResult.session!.refresh_token);
      
      expect(refreshResult.success).toBe(true);
      expect(refreshResult.user).toBeDefined();
      expect(refreshResult.session).toBeDefined();
    });
  });
});