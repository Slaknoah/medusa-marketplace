import { Invite } from "../models/invite";
import { dataSource } from "@medusajs/medusa/dist/loaders/database";

export const InviteRepository = dataSource.getRepository(Invite)

export default InviteRepository;
