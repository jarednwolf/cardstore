import { supabase, supabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import { devAuthService } from './devAuthService';
import { logger } from '../config/logger';
import { User } from '../types';

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
  session?: any;
}

export interface SignUpData {
  email: string;
  password: string;
  fullName?: string;
  tenantName?: string;
  tenantSubdomain?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export class AuthService {
  /**
   * Sign up a new user and optionally create a tenant
   */
  async signUp(data: SignUpData): Promise<AuthResult> {
    try {
      if (!isSupabaseConfigured() || !supabase) {
        logger.info('Using development authentication service for signup');
        return await devAuthService.signUp(data);
      }

      const { email, password, fullName, tenantName, tenantSubdomain } = data;

      // Sign up user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName || '',
          }
        }
      });

      if (authError) {
        logger.error('Supabase auth signup error', { error: authError });
        return { success: false, error: authError.message };
      }

      if (!authData.user) {
        return { success: false, error: 'User creation failed' };
      }

      // If tenant information is provided, create tenant
      if (tenantName && tenantSubdomain) {
        try {
          if (!supabaseAdmin) {
            logger.error('Supabase admin client not available for tenant creation');
          } else {
            const { error: tenantError } = await supabaseAdmin
              .rpc('create_tenant_with_owner', {
              tenant_name: tenantName,
              tenant_subdomain: tenantSubdomain,
              owner_email: email,
              owner_full_name: fullName || null
              });

            if (tenantError) {
              logger.error('Tenant creation error', { error: tenantError });
              // Don't fail the signup if tenant creation fails
            }
          }
        } catch (tenantError) {
          logger.error('Tenant creation exception', { error: tenantError });
        }
      }

      // Get user data
      const user = await this.getUserById(authData.user.id);
      
      if (!user) {
        return { success: false, error: 'User data not found' };
      }

      return {
        success: true,
        user,
        session: authData.session
      };

    } catch (error) {
      logger.error('Auth service signup error', { error });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Sign in an existing user
   */
  async signIn(data: SignInData): Promise<AuthResult> {
    try {
      if (!isSupabaseConfigured() || !supabase) {
        logger.info('Using development authentication service for signin');
        return await devAuthService.signIn(data);
      }

      const { email, password } = data;

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        logger.error('Supabase auth signin error', { error: authError });
        return { success: false, error: authError.message };
      }

      if (!authData.user) {
        return { success: false, error: 'Sign in failed' };
      }

      // Update last login
      await this.updateLastLogin(authData.user.id);

      // Get user data
      const user = await this.getUserById(authData.user.id);
      
      if (!user) {
        return { success: false, error: 'User data not found' };
      }

      return {
        success: true,
        user,
        session: authData.session
      };

    } catch (error) {
      logger.error('Auth service signin error', { error });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Sign out user
   */
  async signOut(accessToken?: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!isSupabaseConfigured() || !supabase) {
        logger.info('Using development authentication service for signout');
        return await devAuthService.signOut(accessToken);
      }

      const { error } = await supabase.auth.signOut();
      
      if (error) {
        logger.error('Supabase auth signout error', { error });
        return { success: false, error: error.message };
      }

      return { success: true };

    } catch (error) {
      logger.error('Auth service signout error', { error });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthResult> {
    try {
      if (!isSupabaseConfigured() || !supabase) {
        logger.info('Using development authentication service for token refresh');
        return await devAuthService.refreshToken(refreshToken);
      }

      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken
      });

      if (error) {
        logger.error('Token refresh error', { error });
        return { success: false, error: error.message };
      }

      if (!data.user) {
        return { success: false, error: 'Token refresh failed' };
      }

      const user = await this.getUserById(data.user.id);
      
      if (!user) {
        return { success: false, error: 'User data not found' };
      }

      return {
        success: true,
        user,
        session: data.session
      };

    } catch (error) {
      logger.error('Auth service refresh error', { error });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      if (!isSupabaseConfigured() || !supabaseAdmin) {
        logger.info('Using development authentication service for getUserById');
        return await devAuthService.getUserById(userId);
      }

      const { data, error } = await supabaseAdmin
        .from('users')
        .select(`
          *,
          user_roles (
            role,
            permissions,
            tenant_id
          )
        `)
        .eq('id', userId)
        .single();

      if (error) {
        logger.error('Get user error', { error, userId });
        return null;
      }

      if (!data) {
        return null;
      }

      // Transform to our User type
      return {
        id: data.id,
        email: data.email,
        name: data.full_name || data.email,
        role: data.user_roles?.[0]?.role || 'staff',
        tenantId: data.tenant_id,
        lastLoginAt: data.last_login_at ? new Date(data.last_login_at) : new Date(),
        isActive: data.is_active,
        createdAt: data.created_at ? new Date(data.created_at) : new Date(),
        updatedAt: data.updated_at ? new Date(data.updated_at) : new Date()
      };

    } catch (error) {
      logger.error('Auth service getUserById error', { error, userId });
      return null;
    }
  }

  /**
   * Verify access token and get user
   */
  async verifyToken(accessToken: string): Promise<User | null> {
    try {
      if (!isSupabaseConfigured() || !supabase) {
        logger.info('Using development authentication service for token verification');
        return await devAuthService.verifyToken(accessToken);
      }

      const { data, error } = await supabase.auth.getUser(accessToken);

      if (error || !data.user) {
        logger.debug('Token verification failed', { error });
        return null;
      }

      return await this.getUserById(data.user.id);

    } catch (error) {
      logger.error('Token verification error', { error });
      return null;
    }
  }

  /**
   * Update user's last login timestamp
   */
  private async updateLastLogin(userId: string): Promise<void> {
    try {
      if (!supabaseAdmin) {
        return;
      }

      await supabaseAdmin
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', userId);
    } catch (error) {
      logger.error('Update last login error', { error, userId });
    }
  }

  /**
   * Create tenant invitation
   */
  async createTenantInvitation(
    tenantId: string,
    email: string,
    role: string,
    invitedBy: string
  ): Promise<{ success: boolean; token?: string; error?: string }> {
    try {
      const token = this.generateInvitationToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      if (!supabaseAdmin) {
        return { success: false, error: 'Authentication service not configured' };
      }

      const { error } = await supabaseAdmin
        .from('tenant_invitations')
        .insert({
          tenant_id: tenantId,
          email,
          role,
          invited_by: invitedBy,
          token,
          expires_at: expiresAt.toISOString()
        });

      if (error) {
        logger.error('Create invitation error', { error });
        return { success: false, error: error.message };
      }

      return { success: true, token };

    } catch (error) {
      logger.error('Auth service createTenantInvitation error', { error });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Accept tenant invitation
   */
  async acceptInvitation(token: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!supabaseAdmin) {
        return { success: false, error: 'Authentication service not configured' };
      }

      const { data, error } = await supabaseAdmin
        .rpc('accept_tenant_invitation', { invitation_token: token });

      if (error) {
        logger.error('Accept invitation error', { error });
        return { success: false, error: error.message };
      }

      if (!data) {
        return { success: false, error: 'Invalid or expired invitation' };
      }

      return { success: true };

    } catch (error) {
      logger.error('Auth service acceptInvitation error', { error });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Generate a secure invitation token
   */
  private generateInvitationToken(): string {
    return require('crypto').randomBytes(32).toString('hex');
  }
}

export const authService = new AuthService();