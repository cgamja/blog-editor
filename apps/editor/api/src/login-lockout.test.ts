import { describeLoginLockoutContract } from "./login-lockout.contract";
import { createLoginLockout } from "./login-lockout";

describeLoginLockoutContract("MemoryLoginLockout", async () => createLoginLockout());
