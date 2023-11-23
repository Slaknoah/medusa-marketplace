import { Role } from "../models/role";
import { dataSource } from "@medusajs/medusa/dist/loaders/database";

export const RoleRepository = dataSource.getRepository(Role);

export default RoleRepository;
