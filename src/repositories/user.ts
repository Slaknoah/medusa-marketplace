import { User } from "../models/user";
import { dataSource } from "@medusajs/medusa/dist/loaders/database";

export const UserRepository = dataSource.getRepository(User);

export default UserRepository;
