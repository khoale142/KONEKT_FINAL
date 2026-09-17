export function toPublicUser(row) {
  if (!row) return null;

  return {
    id: row.id,
    username: row.username,
    email: row.email,
    fullName: row.full_name,
    status: row.status,
    lastLoginAt: row.last_login_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}
