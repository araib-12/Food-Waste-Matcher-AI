import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    window.localStorage.clear();
    TestBed.resetTestingModule();
    // Unit tests exercise the safe no-database path. They must not depend on
    // whichever Supabase project happens to be configured for a real build.
    TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: { client: null } }] });
    service = TestBed.inject(AuthService);
  });

  it('requires the shared database before signing in', async () => {
    const result = await service.signIn('partner@example.org', 'password123', 'partner');
    expect(result.success).toBeFalse();
    expect(result.message).toContain('database');
  });

  it('does not create a local fallback session', async () => {
    const result = await service.signIn('ngo@example.org', 'password123', 'partner');
    expect(result.success).toBeFalse();
    expect(service.session()).toBeNull();
  });

  it('does not trust an application session injected into local storage', async () => {
    window.localStorage.setItem('mealping.session.v3', JSON.stringify({ role: 'admin' }));
    TestBed.resetTestingModule();
    service = TestBed.inject(AuthService);
    await service.ready();
    expect(service.session()).toBeNull();
  });

  it('clears the verified in-memory session on logout', async () => {
    await service.signOut();
    expect(service.session()).toBeNull();
  });
});
