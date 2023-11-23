export default async function () {
  const imports = (await import(
    "@medusajs/medusa/dist/api/routes/store/products/index"
  )) as any;
  imports.allowedStoreProductsFields = [
    ...imports.allowedStoreProductsFields,
    "store_id",
  ];
  (imports.defaultStoreProductsFields = [
    ...imports.defaultStoreProductsFields,
    "store_id",
  ]),
    (imports.allowedStoreProductsRelations = [
      ...imports.allowedStoreProductsRelations,
      "store",
    ]);
}
