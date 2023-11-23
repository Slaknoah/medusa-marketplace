import { Lifetime } from "awilix";
import { MedusaError } from "medusa-core-utils";
import { ConfigModule, User, UserRoles } from "@medusajs/medusa";
import MedusaInviteService from "@medusajs/medusa/dist/services/invite";
import InviteRepository from "@medusajs/medusa/dist/repositories/invite";
import UserService from "./user";
import UserRepository from "@medusajs/medusa/dist/repositories/user";
import { getConfigFile } from "medusa-core-utils";
import { ListInvite } from "@medusajs/medusa/dist/types/invites";

// 7 days
const DEFAULT_VALID_DURATION = 1000 * 60 * 60 * 24 * 7;

class InviteService extends MedusaInviteService {
  static LIFE_TIME = Lifetime.SCOPED;
  
  private userService__: UserService;
  protected readonly loggedInUser_: User | null;
  protected readonly configModule_: ConfigModule = null;

  constructor(container) {
    // @ts-expect-error prefer-rest-params
    // eslint-disable-next-line prefer-rest-params
    super(...arguments);
    this.userService__ = container.userService;

    const { configModule } = getConfigFile(
      __dirname,
      "../../medusa-config"
    ) as {
      configModule: ConfigModule;
    };
    this.configModule_ = configModule;

    try {
      this.loggedInUser_ = container.loggedInUser;
    } catch (e) {
      // avoid errors when backend first runs
    }
  }

  async list(selector, config = {}): Promise<ListInvite[]> {
    if (!selector.store_id && this.loggedInUser_?.store_id) {
      selector.store_id = this.loggedInUser_.store_id;
    }
    console.log(selector);

    return await super.list(selector, config);
  }

  /**
   * Updates an account_user.
   * @param user - user emails
   * @param role - role to assign to the user
   * @param validDuration - role to assign to the user
   * @return the result of create
   */
  create = async (
    user: string,
    role: UserRoles,
    validDuration = DEFAULT_VALID_DURATION
  ): Promise<void> => {
    return await this.atomicPhase_(async (manager) => {
      const inviteRepository =
        this.activeManager_.withRepository(InviteRepository);

      const userRepo = this.activeManager_.withRepository(UserRepository);

      const userEntity = await userRepo.findOne({
        where: { email: user },
      });

      if (userEntity) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Can't invite a user with an existing account"
        );
      }

      console.log(this.loggedInUser_, "invite logged in user");
      if (!this.loggedInUser_?.store_id) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Can't invite a user without a store"
        );
      }
      // throw new MedusaError(MedusaError.Types.INVALID_DATA, "Testing");

      let invite = await inviteRepository.findOne({
        where: { user_email: user },
      });
      // if user is trying to send another invite for the same account + email, but with a different role
      // then change the role on the invite as long as the invite has not been accepted yet
      const storeId = this.loggedInUser_?.store_id || null;
      if (
        invite &&
        !invite.accepted &&
        (invite.role !== role || invite.store_id !== storeId)
      ) {
        invite.role = role;
        invite.store_id = storeId;

        invite = await inviteRepository.save(invite);
      } else if (!invite) {
        // if no invite is found, create a new one
        const created = inviteRepository.create({
          role,
          token: "",
          user_email: user,
          store_id: storeId,
        });

        invite = await inviteRepository.save(created);
      }

      invite.token = this.generateToken({
        invite_id: invite.id,
        role,
        user_email: user,
      });

      invite.expires_at = new Date();
      invite.expires_at.setMilliseconds(
        invite.expires_at.getMilliseconds() + validDuration
      );

      invite = await inviteRepository.save(invite);

      await this.eventBus_
        .withTransaction(manager)
        .emit(InviteService.Events.CREATED, {
          id: invite.id,
          token: invite.token,
          user_email: invite.user_email,
        });
    });
  };

  async accept(token: any, user_: any): Promise<User> {
    let decoded;
    try {
      decoded = this.verifyToken(token);
    } catch (err) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Token is not valid"
      );
    }

    const { invite_id, user_email } = decoded;

    return await this.atomicPhase_(async (m) => {
      const userRepo = m.withRepository(this.userRepo_);
      const inviteRepo: typeof InviteRepository = m.withRepository(
        this.inviteRepository_
      );

      const invite = await inviteRepo.findOne({ where: { id: invite_id } });

      if (
        !invite ||
        invite?.user_email !== user_email ||
        new Date() > invite.expires_at
      ) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, `Invalid invite`);
      }

      const exists = await userRepo.findOne({
        where: { email: user_email.toLowerCase() },
        select: ["id"],
      });

      if (exists) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "User already joined"
        );
      }

      // use the email of the user who actually accepted the invite
      if (invite.store_id) {
        console.log("Invited store", invite.store_id);
      }
      console.log(invite);
      const user = await this.userService__.withTransaction(m).create(
        {
          email: invite.user_email,
          role: invite.role,
          first_name: user_.first_name,
          last_name: user_.last_name,
          store_id: invite.store_id,
        },
        user_.password
      );

      await inviteRepo.delete({ id: invite.id });

      return user;
    }, "SERIALIZABLE");
  }
}

export default InviteService;
