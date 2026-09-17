// Roles giờ được xác định theo context workspace, không lưu trên user.
// OWNER = user nằm trong tenant_owners cho tenant hiện tại
// STAFF = user nằm trong store_staff cho store hiện tại
export const WORKSPACE_TYPES = Object.freeze({
  TENANT: 'TENANT',  // User đang thao tác với tư cách Owner
  STORE: 'STORE',    // User đang thao tác với tư cách Staff (hoặc Owner vào store)
});
