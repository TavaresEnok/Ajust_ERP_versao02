export function requiresTwoFactor(role: string) {
  return (process.env.REQUIRE_2FA_ROLES ?? 'super_admin,gerente')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(role);
}
