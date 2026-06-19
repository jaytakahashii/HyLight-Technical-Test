-- Insert seed users into auth.users
-- password: example (for example@example.com)
-- password: testtest (for test@test.com)
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at
  )
VALUES (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated',
    'authenticated',
    'example@example.com',
    crypt('example', gen_salt('bf')),
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated',
    'authenticated',
    'test@test.com',
    crypt('testtest', gen_salt('bf')),
    now(),
    now(),
    now()
  ) ON CONFLICT (id) DO NOTHING;
-- Insert corresponding identities into auth.identities
INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    created_at,
    updated_at
  )
VALUES (
    gen_random_uuid(),
    '11111111-1111-1111-1111-111111111111',
    format(
      '{"sub":"%s","email":"%s"}',
      '11111111-1111-1111-1111-111111111111',
      'example@example.com'
    )::jsonb,
    'email',
    '11111111-1111-1111-1111-111111111111',
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    '22222222-2222-2222-2222-222222222222',
    format(
      '{"sub":"%s","email":"%s"}',
      '22222222-2222-2222-2222-222222222222',
      'test@test.com'
    )::jsonb,
    'email',
    '22222222-2222-2222-2222-222222222222',
    now(),
    now()
  ) ON CONFLICT (id) DO NOTHING;
