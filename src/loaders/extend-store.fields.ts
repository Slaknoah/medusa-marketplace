export default async function () {
  const imports = (await import(
    "@medusajs/medusa/dist/api/routes/admin/store/index"
  )) as any;
  imports.allowedFields = [
    ...(imports.allowedFields || []),
    "store_id",
  ];
  imports.defaultRelationsExtended = [
    ...(imports.defaultRelationsExtended || []),
    "members",
    "currencies",
  ];
}
