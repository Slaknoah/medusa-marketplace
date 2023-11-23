import { Permission } from "../models/permission";
import { dataSource } from "@medusajs/medusa/dist/loaders/database";

export const PermissionRepository = dataSource.getRepository(Permission);

export default PermissionRepository;
